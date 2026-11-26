#!/usr/bin/env python3
"""Small, Git-free inventory for source reviews in a BuildOS instance."""

from __future__ import annotations

import argparse
import copy
import csv
import datetime as dt
try:
    import fcntl
except ImportError:  # Windows: lock a per-directory file in the temp folder instead.
    fcntl = None
    import msvcrt
    import tempfile
import hashlib
import json
import os
import re
import sys
import time
from collections import Counter, defaultdict
from pathlib import Path

REF_ID = re.compile(r"REF-([0-9]+)$")
ENTITY_PREFIX = {
    "requirement": "REQ",
    "capability": "CAP",
    "persona": "PER",
    "test-case": "TC",
    "result": "RES",
    "run": "RUN",
    "finding": "FIND",
}
REF_OUTCOMES = {"pending", "reviewed", "no-new-rows", "blocked"}
CHECK_RESULTS = {"unverified", "matched", "repaired", "partial"}
APPLY_ACTIONS = {"minted", "referenced", "updated"}
REVIEW_DECISIONS = {"pending", "approved", "held"}
DATA_FILES = {
    "requirement": "requirements.jsonl", "capability": "capabilities.jsonl",
    "persona": "personas.jsonl", "test-case": "test-cases.jsonl",
    "result": "results.jsonl", "run": "runs.jsonl", "finding": "findings.jsonl",
}
COMMON_MEANINGS = {
    "key": "Local candidate key; unique within this review",
    "action": "minted=new row, referenced=reuse without change, updated=correct saved row",
    "review_state": "pending in extraction; approved or held only in separate review",
    "row.status": "BuildOS lifecycle: draft, active, superseded, archived; not review state",
    "row.title": "Nonempty text",
    "row.summary": "Nonempty text",
    "row.source_anchor": "This source's converted assets/path#Lnumber or #row-number",
    "row.source_refs": "List of supporting path#anchor values or entity IDs",
    "row.related": "List of entity IDs",
    "row.doc_anchor": "Null for a draft, docs/path.md#anchor otherwise",
    "row.created_at": "ISO 8601 date or datetime, or null",
    "row.updated_at": "ISO 8601 date or datetime, or null",
    "unresolved": "Open questions belong in the review's unresolved list, not a row reference field",
}
TYPE_FIELDS = {
    "requirement": {"statement": "text", "rationale": "text", "acceptance_refs": "references"},
    "capability": {"description": "text", "supports": "references", "limits": "text list"},
    "persona": {"description": "text", "goals": "text list", "needs": "text list"},
    "test-case": {"verifies": "IDs", "preconditions": "text list", "steps": "text list", "expected": "text"},
    "result": {"target_id": "ID", "outcome": "pass|fail|blocked|inconclusive", "evidence_refs": "references"},
    "run": {"playbook_id": "PB ID or null", "started_at": "ISO date", "ended_at": "ISO date or null", "inputs": "object", "outputs": "object or list"},
    "finding": {"observed": "text", "basis_refs": "references", "confidence": "low|medium|high", "implications": "related IDs or narrative references"},
}
ENTITY_ID = re.compile(r"(?:REQ|CAP|PER|TC|RES|RUN|FIND|EXT|PB)-[0-9]{3,}$")
REQUIRED_LIST_FIELDS = {
    "requirement": ("acceptance_refs",),
    "capability": ("supports", "limits"),
    "persona": ("goals", "needs"),
    "test-case": ("verifies", "preconditions", "steps"),
    "result": ("evidence_refs",),
    "run": (),
    "finding": ("basis_refs", "implications"),
}
OPTIONAL_LIST_FIELDS = ("systems", "environments", "owners", "tags")
SCOPED_FIELDS = ("systems", "environments", "owners")
# `buildos validate` (PRD 13): `both` is a reserved sentinel, never a scoped ID,
# and the legacy scoped fields are not allowed in an entity row.
RESERVED_SCOPED_VALUES = ("both",)
LEGACY_SCOPED_FIELDS = ("env", "for", "envs", "target_systems")
# The RFC 3339 UTC profile that `buildos validate` requires for `extracted_at`.
# Every ID, target-ID, and timestamp pattern in this file uses the ASCII class
# [0-9], never \d: in Python, \d also matches other scripts' digits (full-width
# digits, for example), which `buildos validate` rejects.
UTC_DATETIME = re.compile(r"([0-9]{4})-([0-9]{2})-([0-9]{2})T([0-9]{2}):([0-9]{2}):([0-9]{2})(?:\.[0-9]+)?Z")
URI_SCHEME = re.compile(r"[A-Za-z][A-Za-z0-9+.-]+:")


def normalize_anchor_path(path: str) -> str | None:
    """The anchor path with . and .. folded, or None when it is absolute or leaves the project folder."""
    if path == "":
        return ""
    if re.match(r"[/\\]", path) or re.match(r"[A-Za-z]:", path):
        return None
    parts: list[str] = []
    for part in re.split(r"[/\\]", path):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                return None
            parts.pop()
            continue
        parts.append(part)
    return "/".join(parts)


def saved_anchor_issue(value: object, under: str | None = None) -> str | None:
    """The `buildos validate` rules for a saved path#anchor (PRD 13; toolkits/buildos/src/core/validate/checks.ts).

    The path ends at the first #, and the fragment after it is not empty. The
    path is not a URI, is relative, stays inside the project folder, does not
    fold to the folder itself, does not start with system/, and names a file,
    not a folder. With `under`, the folded path starts with that folder.
    """
    if not isinstance(value, str) or not value:
        return "needs a path#anchor reference"
    path, sep, fragment = value.partition("#")
    if not sep or not fragment:
        return "needs a path#anchor reference with text after the first #"
    if URI_SCHEME.match(path):
        return "must name a file in the project folder, not a web address or other URI"
    normalized = normalize_anchor_path(path)
    if path == "" or normalized is None or normalized == "":
        return "must name a file inside the project folder, relative to it, before the #"
    raw = re.split(r"[/\\]", path)
    first = next((part for part in raw if part != "."), "")
    if normalized == "system" or normalized.startswith("system/") or first == "system":
        return "must not start with system/, the source-package folder"
    if raw[-1] in ("", ".", ".."):
        return "must name a file before the #, not a folder"
    if under and not (normalized or path).startswith(under):
        return f"must point under {under}"
    return None


def utc_datetime_ok(value: object) -> bool:
    """True for a real UTC time in the profile `buildos validate` requires (YYYY-MM-DDTHH:MM:SS[.f]Z)."""
    match = UTC_DATETIME.fullmatch(value) if isinstance(value, str) else None
    if not match:
        return False
    year, month, day, hour, minute, second = (int(group) for group in match.groups())
    try:
        dt.datetime(year, month, day)
    except ValueError:
        return False
    return year >= 1 and hour <= 23 and minute <= 59 and second <= 59


def extraction_row_issues(ext: dict) -> list[str]:
    """The `buildos validate` extraction-row checks, run before the helper writes the row."""
    issues = []
    if not isinstance(ext.get("id"), str) or not re.fullmatch(r"EXT-[0-9]{3,}", ext["id"]):
        issues.append(f"id {ext.get('id')!r} does not match the extraction ID pattern EXT-NNN")
    for value in ext.get("minted", []):
        if not isinstance(value, str) or not ENTITY_ID.fullmatch(value):
            issues.append(f"minted ID {value!r} does not match the ID pattern")
    if not isinstance(ext.get("extracted_by"), str) or not ext["extracted_by"].strip():
        issues.append("extracted_by needs nonempty text")
    if not utc_datetime_ok(ext.get("extracted_at")):
        issues.append(f"extracted_at {ext.get('extracted_at')!r} is not a UTC time such as 2026-01-31T09:30:00Z")
    if "dataset_refs" in ext and not isinstance(ext["dataset_refs"], list):
        issues.append("dataset_refs must be a list or left out, never null")
    problem = saved_anchor_issue(ext.get("source_anchor"), "assets/")
    if problem:
        issues.append(f"source_anchor {problem}")
    return issues


def file_at(root: Path, relative: str) -> Path:
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError(f"Invalid repo-relative path: {relative!r}")
    path = (root / relative).resolve()
    if not path.is_relative_to(root):
        raise ValueError(f"Path leaves repo: {relative}")
    return path


def groups_from_index(root: Path) -> list[dict]:
    index = json.loads((root / ".os/indexes/references.json").read_text())
    if not isinstance(index, dict):
        raise ValueError("Reference index has no references list")
    references = index.get("references")
    # `buildos intake index references` writes `"references": null` for an index
    # with no converted source (the Go tools' form). That is an empty queue.
    if "references" in index and references is None:
        references = []
    if not isinstance(references, list):
        raise ValueError("Reference index has no references list")
    by_source: dict[str, list[dict]] = defaultdict(list)
    seen: set[str] = set()
    for ref in references:
        if not isinstance(ref, dict) or not REF_ID.fullmatch(str(ref.get("id", ""))):
            raise ValueError(f"Invalid reference record: {ref!r}")
        if ref["id"] in seen:
            raise ValueError(f"Duplicate reference ID: {ref['id']}")
        seen.add(ref["id"])
        file_at(root, ref.get("source"))
        file_at(root, ref.get("converted"))
        by_source[ref["source"]].append(ref)
    groups = []
    for source, refs in by_source.items():
        refs.sort(key=lambda item: int(REF_ID.fullmatch(item["id"]).group(1)))
        hashes = {ref.get("sha256") for ref in refs}
        if len(hashes) != 1 or not re.fullmatch(r"[0-9a-f]{64}", str(next(iter(hashes)))):
            raise ValueError(f"Inconsistent source hashes: {source}")
        key = refs[0]["id"]
        slug = re.sub(r"[^a-z0-9]+", "-", Path(source).stem.lower()).strip("-")[:56]
        groups.append({"key": key, "source": source, "sha256": refs[0]["sha256"],
                       "refs": refs, "filename": f"{key}-{slug or 'source'}.json"})
    return sorted(groups, key=lambda group: int(REF_ID.fullmatch(group["key"]).group(1)))


def group_for(groups: list[dict], ref_id: str) -> dict:
    for group in groups:
        if any(ref["id"] == ref_id for ref in group["refs"]):
            return group
    raise ValueError(f"Unknown reference ID: {ref_id}")


def review_path(root: Path, group: dict) -> Path:
    return root / "extractions" / group["filename"]


def staged_path(root: Path, group: dict) -> Path:
    # Old reviews can still be checked, but new reviews never use this path.
    return root / "extractions/staging" / group["filename"]


def row_hash(row: dict) -> str:
    return hashlib.sha256(json.dumps(row, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def canonical_records(root: Path) -> dict[str, dict]:
    records: dict[str, dict] = {}
    for path in sorted((root / ".os/data").glob("*.jsonl")):
        for number, line in enumerate(path.read_text().splitlines(), 1):
            if not line.strip():
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL in {path}:{number}: {exc}") from exc
            row_id = row.get("id") if isinstance(row, dict) else None
            if not isinstance(row_id, str) or row_id in records:
                raise ValueError(f"Missing or duplicate ID in {path}:{number}: {row_id!r}")
            records[row_id] = row
    return records


def digest(path: Path) -> str:
    checksum = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            checksum.update(block)
    return checksum.hexdigest()


def list_field_issues(row: dict, kind: str, label: str) -> list[str]:
    issues = []
    required = ("source_refs", "related") + REQUIRED_LIST_FIELDS[kind]
    for field in required + tuple(name for name in OPTIONAL_LIST_FIELDS if name in row):
        value = row.get(field)
        if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
            issues.append(f"{label} {field} must be a list of strings")
        elif field in SCOPED_FIELDS:
            for item in value:
                if item in RESERVED_SCOPED_VALUES:
                    issues.append(f"{label} {field} holds the reserved value {item!r}; list each configured ID instead")
    for field in LEGACY_SCOPED_FIELDS:
        if field in row:
            issues.append(f"{label} {field} is an old scoped field; use systems, environments, and owners")
    return issues


def is_date(value: object) -> bool:
    if not isinstance(value, str) or not value:
        return False
    try:
        dt.datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def is_reference(value: str) -> bool:
    return bool(ENTITY_ID.fullmatch(value) or
                (value.startswith(("assets/", "docs/")) and "#" in value))


def is_narrative_reference(value: str) -> bool:
    return bool(value.strip() and not value.strip().endswith("?") and
                not re.match(r"(?i)^(what|why|how|which|whether|should|could|need to)\b", value.strip()))


def row_field_issues(row: dict, kind: str, label: str) -> list[str]:
    issues = list_field_issues(row, kind, label)
    for field in ("created_at", "updated_at"):
        if field not in row:
            issues.append(f"{label} needs {field} (ISO date or null)")
    statuses = {"draft", "active", "superseded", "archived"}
    if kind == "finding":
        statuses.add("qualified")
    if kind == "run":
        statuses.update({"running", "closed", "aborted"})
    if row.get("status") not in statuses:
        issues.append(f"{label} status is not valid for {kind}")
    if row.get("status") == "superseded" and not isinstance(row.get("redirect"), dict):
        issues.append(f"{label} superseded row needs a redirect")
    if row.get("status") != "superseded" and "redirect" in row:
        issues.append(f"{label} redirect is only for a superseded row")
    for field in ("title", "summary"):
        if not isinstance(row.get(field), str) or not row[field].strip():
            issues.append(f"{label} {field} needs nonempty text")
    for field in ("created_at", "updated_at"):
        if field in row and row[field] is not None and not is_date(row[field]):
            issues.append(f"{label} {field} needs an ISO date or null")
    doc_anchor = row.get("doc_anchor")
    doc_problem = saved_anchor_issue(doc_anchor, "docs/") if doc_anchor is not None else None
    if doc_problem:
        issues.append(f"{label} doc_anchor {doc_problem}; use docs/path.md#anchor, or null")
    if row.get("status") != "draft" and not doc_anchor:
        issues.append(f"{label} non-draft row needs doc_anchor")
    if isinstance(row.get("related"), list):
        for value in row["related"]:
            if isinstance(value, str) and not ENTITY_ID.fullmatch(value):
                issues.append(f"{label} related needs entity IDs: {value!r}")
    if isinstance(row.get("source_refs"), list):
        for value in row["source_refs"]:
            if isinstance(value, str) and not is_reference(value):
                issues.append(f"{label} source_refs needs path#anchor or entity ID: {value!r}")
    for field, meaning in TYPE_FIELDS[kind].items():
        value = row.get(field)
        if meaning in {"text", "ID", "ISO date", "pass|fail|blocked|inconclusive", "low|medium|high"}:
            if not isinstance(value, str) or not value.strip():
                issues.append(f"{label} {field} needs {meaning}")
        if meaning in {"references", "text list", "IDs", "related IDs or narrative references"}:
            if not isinstance(value, list) or any(not isinstance(x, str) or not x.strip() for x in value):
                issues.append(f"{label} {field} needs a list of nonempty strings")
    if kind == "finding":
        if row.get("confidence") not in {"low", "medium", "high"}:
            issues.append(f"{label} confidence needs low, medium, or high")
        for value in row.get("implications", []) if isinstance(row.get("implications"), list) else []:
            if isinstance(value, str) and not (re.fullmatch(r"(?:REQ|CAP|TC)-[0-9]+", value) or is_narrative_reference(value)):
                issues.append(f"{label} implications is for related IDs or narrative references; put questions in unresolved: {value!r}")
        for value in row.get("basis_refs", []) if isinstance(row.get("basis_refs"), list) else []:
            if isinstance(value, str) and not (re.fullmatch(r"(?:RUN|RES|EXT)-[0-9]+", value) or
                                               value.startswith(("assets/", "docs/"))):
                issues.append(f"{label} basis_refs needs a RUN, RES, EXT, or file reference: {value!r}")
    if kind == "result":
        if not re.fullmatch(r"(?:TC|REQ|CAP|RUN|FIND)-[0-9]+", str(row.get("target_id", ""))):
            issues.append(f"{label} target_id has the wrong ID type")
        if row.get("outcome") not in {"pass", "fail", "blocked", "inconclusive"}:
            issues.append(f"{label} outcome is invalid")
        for value in row.get("evidence_refs", []) if isinstance(row.get("evidence_refs"), list) else []:
            if isinstance(value, str) and not (re.fullmatch(r"(?:RUN|FIND)-[0-9]+", value) or
                                               value.startswith(("assets/", "docs/"))):
                issues.append(f"{label} evidence_refs needs a RUN, FIND, or file reference: {value!r}")
    if kind == "run":
        if row.get("playbook_id") is not None and not re.fullmatch(r"PB-[0-9]+", str(row.get("playbook_id"))):
            issues.append(f"{label} playbook_id needs a PB ID or null")
        if not is_date(row.get("started_at")) or (row.get("ended_at") is not None and not is_date(row.get("ended_at"))):
            issues.append(f"{label} run dates need ISO dates")
        if not isinstance(row.get("inputs"), dict) or not isinstance(row.get("outputs"), (dict, list)):
            issues.append(f"{label} inputs and outputs have the wrong types")
    for field, allowed in (("acceptance_refs", r"(?:TC|RES|FIND)-[0-9]+"),
                           ("verifies", r"(?:REQ|CAP)-[0-9]+")):
        values = row.get(field)
        if isinstance(values, list):
            for value in values:
                if isinstance(value, str) and not (re.fullmatch(allowed, value) or
                                                  (field == "acceptance_refs" and value.startswith("docs/"))):
                    issues.append(f"{label} {field} has an invalid reference: {value!r}")
    return issues


def candidate_template(kind: str) -> dict:
    if kind not in ENTITY_PREFIX:
        raise ValueError(f"Unknown candidate type: {kind}")
    row = {"type": kind, "title": "", "status": "draft", "summary": "", "source_anchor": "",
           "doc_anchor": None, "source_refs": [], "related": [], "created_at": None, "updated_at": None}
    for field, meaning in TYPE_FIELDS[kind].items():
        row[field] = [] if meaning in {"references", "text list", "IDs", "related IDs or narrative references"} else \
                     {} if meaning == "object" else None if "or null" in meaning else ""
    if kind == "finding":
        row["confidence"] = "medium"
    if kind == "result":
        row["outcome"] = "inconclusive"
    if kind == "run":
        row["inputs"], row["outputs"] = {}, {}
    return {"key": "", "type": kind, "action": "minted", "review_state": "pending", "row": row}


def converted_anchor_issue(root: Path, anchor: object, paths: set[str], counts: dict[str, int], resolve: bool) -> str | None:
    if not isinstance(anchor, str) or "#" not in anchor:
        return "needs a converted path#anchor"
    saved = saved_anchor_issue(anchor, "assets/")
    if saved:
        return saved
    relative, _, fragment = anchor.partition("#")
    if relative not in paths:
        return f"points outside this source group: {relative}"
    if not fragment:
        return "needs a converted path#anchor"
    suffix = Path(relative).suffix.lower()
    pattern = r"L([1-9][0-9]*)" if suffix in {".md", ".txt"} else r"row-([1-9][0-9]*)" if suffix == ".csv" else None
    match = re.fullmatch(pattern, fragment) if pattern else None
    if not match:
        return f"cannot resolve #{fragment} in {relative}"
    if not resolve:
        return None
    if relative not in counts:
        path = file_at(root, relative)
        if not path.is_file():
            return f"converted file is missing: {relative}"
        try:
            with path.open(encoding="utf-8", newline="") as stream:
                counts[relative] = sum(1 for _ in csv.reader(stream)) if suffix == ".csv" else sum(1 for _ in stream)
        except (UnicodeError, csv.Error) as exc:
            return f"cannot read converted file {relative}: {exc}"
    number = int(match.group(1))
    if number > counts[relative]:
        return f"#{fragment} is outside {relative} ({counts[relative]} lines or rows)"
    return None


def legacy_review_state(root: Path, group: dict, records: dict[str, dict] | None = None, verify_hash: bool = False) -> tuple[str, list[str]]:
    path = review_path(root, group)
    is_staged = path == staged_path(root, group)
    if not path.exists():
        return "pending", []
    try:
        review = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return "needs-repair", [f"Cannot read review JSON: {exc}"]
    if not isinstance(review, dict):
        return "needs-repair", ["Review must be a JSON object"]
    is_modern = is_staged or "publication_review" in review
    issues: list[str] = []
    if review.get("source") != group["source"] or review.get("source_sha256") != group["sha256"]:
        issues.append("Source or source hash differs from reference index")
    source_path = file_at(root, group["source"])
    if not source_path.exists():
        issues.append(f"Original source is missing: {group['source']}")
    elif verify_hash and source_path.is_file() and digest(source_path) != group["sha256"]:
        issues.append("Original source hash differs from reference index")
    for ref in group["refs"]:
        if not file_at(root, ref["converted"]).is_file():
            issues.append(f"Converted file is missing: {ref['converted']}")
    coverage = review.get("references")
    expected = {ref["id"]: ref["converted"] for ref in group["refs"]}
    outcomes: dict[str, str] = {}
    if not isinstance(coverage, list):
        issues.append("references must be a list")
    else:
        for entry in coverage:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                issues.append("A reference entry is invalid")
                continue
            ref_id = entry["id"]
            if ref_id in outcomes:
                issues.append(f"Duplicate reference entry: {ref_id}")
            outcomes[ref_id] = entry.get("outcome")
            if expected.get(ref_id) != entry.get("converted"):
                issues.append(f"Wrong converted path: {ref_id}")
            if entry.get("outcome") not in REF_OUTCOMES:
                issues.append(f"Invalid outcome: {ref_id}")
            if entry.get("outcome") in {"no-new-rows", "blocked"} and not str(entry.get("note", "")).strip():
                issues.append(f"Add a reason for {ref_id}")
        if set(outcomes) != set(expected):
            issues.append("Review does not cover exactly the source's reference IDs")
    source_check = review.get("source_check")
    check_result = None
    if not isinstance(source_check, dict):
        issues.append("source_check must be an object")
    else:
        check_result = source_check.get("result")
        if check_result not in CHECK_RESULTS:
            issues.append("Invalid source_check result")
        if not isinstance(source_check.get("notes"), str) or not isinstance(source_check.get("repairs"), list):
            issues.append("source_check needs notes and repairs")
        elif check_result == "repaired" and not source_check["repairs"]:
            issues.append("Record the conversion repair")
        if check_result in {"matched", "repaired"} and not str(source_check.get("notes", "")).strip():
            issues.append("Describe the source comparison")
    candidates = review.get("candidates")
    keys: set[str] = set()
    anchor_paths = set(expected.values())
    anchor_counts: dict[str, int] = {}
    candidate_paths: set[str] = set()
    if not isinstance(candidates, list):
        issues.append("candidates must be a list")
        candidates = []
    for candidate in candidates:
        if not isinstance(candidate, dict):
            issues.append("A candidate is invalid")
            continue
        key, kind, row = candidate.get("key"), candidate.get("type"), candidate.get("row")
        if not isinstance(key, str) or not key or key in keys:
            issues.append(f"Missing or duplicate candidate key: {key!r}")
            continue
        keys.add(key)
        if kind not in ENTITY_PREFIX or not isinstance(row, dict):
            issues.append(f"Invalid candidate type or row: {key}")
            continue
        anchor = row.get("source_anchor")
        anchor_issue = converted_anchor_issue(root, anchor, anchor_paths, anchor_counts, verify_hash)
        if anchor_issue:
            issues.append(f"Candidate {key} source_anchor {anchor_issue}")
        if isinstance(anchor, str) and "#" in anchor and anchor.split("#", 1)[0] in anchor_paths:
            candidate_paths.add(anchor.split("#", 1)[0])
        if row.get("type") != kind:
            issues.append(f"Candidate {key} row type differs from candidate type")
        if is_modern:
            action, decision = candidate.get("action"), candidate.get("review_state")
            target = candidate.get("target_id")
            if action not in APPLY_ACTIONS or decision not in REVIEW_DECISIONS:
                issues.append(f"Candidate {key} needs an action and review_state")
            if decision == "held" and not str(candidate.get("review_note", "")).strip():
                issues.append(f"Candidate {key} held claim needs a review_note")
            if action == "minted":
                if target is not None or row.get("id") is not None or row.get("status") != "draft":
                    issues.append(f"Candidate {key} minted row needs draft status and no global ID")
            elif action in {"referenced", "updated"}:
                if not isinstance(target, str) or not re.fullmatch(rf"{ENTITY_PREFIX[kind]}-[0-9]{{3,}}", target):
                    issues.append(f"Candidate {key} needs a matching target_id")
                elif records is not None and (target not in records or records[target].get("type") != kind):
                    issues.append(f"Candidate {key} target_id is absent or has the wrong type")
                if action == "referenced" and (row.get("id") is not None or row.get("status") != "draft"):
                    issues.append(f"Candidate {key} referenced row needs draft status and no global ID")
                if action == "updated":
                    if row.get("id") != target or not re.fullmatch(r"[0-9a-f]{64}", str(candidate.get("base_sha256", ""))):
                        issues.append(f"Candidate {key} updated row needs its target ID and base_sha256")
                    if records is not None and target in records and set(records[target]) - set(row):
                        issues.append(f"Candidate {key} updated row dropped original fields")
            issues.extend(row_field_issues(row, kind, f"Candidate {key}"))
        else:
            if row.get("id") is not None or row.get("status") != "draft":
                issues.append(f"Candidate {key} needs draft status without a global ID")
            if not all(isinstance(row.get(field), str) and row[field].strip() for field in ("title", "summary")):
                issues.append(f"Candidate {key} needs title and summary")
            issues.extend(list_field_issues(row, kind, f"Candidate {key}"))
        if isinstance(row.get("source_refs"), list):
            for support in row["source_refs"]:
                if isinstance(support, str) and "#" in support:
                    support_path = support.split("#", 1)[0]
                    if support_path in anchor_paths:
                        candidate_paths.add(support_path)
                        support_issue = converted_anchor_issue(root, support, anchor_paths, anchor_counts, verify_hash)
                        if support_issue:
                            issues.append(f"Candidate {key} source_refs {support_issue}")
    for ref_id, converted in expected.items():
        if outcomes.get(ref_id) == "reviewed" and converted not in candidate_paths:
            issues.append(f"Reviewed {ref_id} has no candidate")
        if outcomes.get(ref_id) != "reviewed" and converted in candidate_paths:
            issues.append(f"Candidate cites {ref_id} without a reviewed outcome")
    unresolved = review.get("unresolved")
    if not isinstance(unresolved, list) or any(not isinstance(item, str) or not item.strip() for item in unresolved):
        issues.append("unresolved must be a list of nonempty notes")
        unresolved = []
    applied = review.get("applied")
    if not isinstance(applied, dict):
        issues.append("applied must be an object")
        applied = {}
    if set(applied) - keys:
        issues.append("applied contains an unknown candidate key")
    expected_outcomes: dict[str, set[str]] = defaultdict(set)
    for candidate in candidates:
        if not isinstance(candidate, dict) or candidate.get("key") not in applied:
            continue
        key = candidate["key"]
        item = applied[key]
        if not isinstance(item, dict) or item.get("action") not in APPLY_ACTIONS or not isinstance(item.get("id"), str):
            issues.append(f"Invalid applied result: {key}")
            continue
        if is_modern and item["action"] != candidate.get("action"):
            issues.append(f"Applied action differs from candidate action: {key}")
        if is_modern and candidate.get("review_state") != "approved":
            issues.append(f"Applied candidate is no longer approved: {key}")
        if is_modern and item.get("candidate_sha256") != row_hash(candidate.get("row")):
            issues.append(f"Applied candidate {key} changed after publication; stage a new correction")
        row_id = item["id"]
        if not re.fullmatch(rf"{ENTITY_PREFIX.get(candidate.get('type'), 'INVALID')}-[0-9]+", row_id):
            issues.append(f"Wrong applied ID type: {key}")
        if records is not None and row_id not in records:
            issues.append(f"Applied ID is absent from .os/data: {row_id}")
        elif records is not None and item["action"] in {"minted", "updated"} and candidate.get("type") in REQUIRED_LIST_FIELDS:
            saved = records[row_id]
            if saved.get("type") != candidate["type"]:
                issues.append(f"Saved {row_id} has the wrong type")
            else:
                issues.extend(list_field_issues(saved, candidate["type"], f"Saved {row_id}"))
        expected_outcomes[item["action"]].add(row_id)
    extraction_ids = review.get("extraction_ids")
    if not isinstance(extraction_ids, list):
        issues.append("extraction_ids must be a list")
        extraction_ids = []
    observed_outcomes: dict[str, set[str]] = defaultdict(set)
    for ext_id in extraction_ids:
        if not isinstance(ext_id, str) or not re.fullmatch(r"EXT-[0-9]+", ext_id):
            issues.append(f"Invalid extraction ID: {ext_id!r}")
            continue
        if records is None:
            continue
        ext = records.get(ext_id)
        if ext is None:
            issues.append(f"Extraction ID is absent from .os/data: {ext_id}")
            continue
        anchor_issue = converted_anchor_issue(root, ext.get("source_anchor"), anchor_paths, anchor_counts, verify_hash)
        if anchor_issue:
            issues.append(f"Extraction {ext_id} source_anchor {anchor_issue}")
        ext_source_refs = ext.get("source_refs")
        for support in ext_source_refs if isinstance(ext_source_refs, list) else []:
            if isinstance(support, str) and "#" in support and support.split("#", 1)[0] in anchor_paths:
                support_issue = converted_anchor_issue(root, support, anchor_paths, anchor_counts, verify_hash)
                if support_issue:
                    issues.append(f"Extraction {ext_id} source_refs {support_issue}")
        for action in APPLY_ACTIONS:
            values = ext.get(action, [])
            if not isinstance(values, list):
                issues.append(f"Extraction {ext_id} has an invalid {action} list")
            else:
                observed_outcomes[action].update(values)
    if records is not None and applied and any(expected_outcomes[action] != observed_outcomes[action] for action in APPLY_ACTIONS):
        issues.append("Extraction outcomes differ from the applied candidate list")
    if is_modern and (review.get("publication_review") is not None or
                      any(c.get("review_state") == "approved" for c in candidates if isinstance(c, dict))):
        if not valid_publication_review(review):
            issues.append("Review decisions need a separate named, dated publication_review")
    if review.get("reviewed_at") and not is_date(review["reviewed_at"]):
        issues.append("reviewed_at needs an ISO date")
    if issues:
        return "needs-repair", issues
    if is_staged and review.get("publication"):
        return "publishing", []
    if unresolved or "blocked" in outcomes.values() or check_result == "partial":
        return "blocked", list(unresolved)
    if (check_result not in {"matched", "repaired"} or "pending" in outcomes.values() or
            not str(review.get("reviewed_by", "")).strip() or not str(review.get("reviewed_at", "")).strip()):
        return "in-progress", []
    if is_staged:
        if any(c.get("review_state") == "held" for c in candidates if isinstance(c, dict)):
            return "held", []
        if any(c.get("review_state") == "approved" and c.get("key") not in applied
               for c in candidates if isinstance(c, dict)):
            return "reviewed", []
        return "staged", []
    if not candidates:
        if set(outcomes.values()) == {"no-new-rows"}:
            return "complete", []
        return "needs-repair", ["A reviewed reference has no candidate or no-new-rows reason"]
    if len(applied) == len(keys) and extraction_ids:
        return "complete", []
    return "ready", []


def replace_file(temp: Path, path: Path) -> None:
    # Windows can briefly deny a replace while antivirus or indexing holds a new file.
    attempts = 1 if fcntl is not None else 10
    for attempt in range(attempts):
        try:
            os.replace(temp, path)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(0.1 * (attempt + 1))


def save_json(path: Path, value: dict, ref_id: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".workpy-{ref_id}-{path.name}.tmp")
    if temp.exists():
        temp.unlink()
    try:
        with temp.open("w", encoding="utf-8") as stream:
            json.dump(value, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        replace_file(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def save_bytes(path: Path, value: bytes, ref_id: str) -> None:
    temp = path.with_name(f".workpy-{ref_id}-{path.name}.tmp")
    if temp.exists():
        temp.unlink()
    try:
        with temp.open("wb") as stream:
            stream.write(value)
            stream.flush()
            os.fsync(stream.fileno())
        replace_file(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def json_line(row: dict) -> bytes:
    return (json.dumps(row, ensure_ascii=False) + "\n").encode("utf-8")


# The most bytes one row may have, per reader (`buildos` PRD 20, W1 R7 P7 review
# round 4): `buildos discovery` and `buildos design` read runs.jsonl and
# findings.jsonl line by line with a 64 KiB line limit; every `buildos entities`
# command reads each data file with a 16 MiB line limit. A row of that many
# bytes or more could not be read back, so the helper refuses it before writing.
ROW_LIMITS = {"runs.jsonl": 64 * 1024, "findings.jsonl": 64 * 1024}
DEFAULT_ROW_LIMIT = 16 * 1024 * 1024


def row_limit_issues(relative: str, operations: dict) -> list[str]:
    """Each new or replaced row of `relative` that its reader could not read back."""
    limit = ROW_LIMITS.get(Path(relative).name, DEFAULT_ROW_LIMIT)
    rows = list(operations.get("replace", {}).values()) + list(operations.get("append", []))
    issues = []
    for row in rows:
        size = len(json_line(row)) - 1
        if size >= limit:
            issues.append(f"{relative}: row {row.get('id')!r} would be {size} bytes; BuildOS reads at most {limit - 1} bytes in one line of this file")
    return issues


def apply_operations(before: bytes, operations: dict) -> bytes:
    replacements = operations.get("replace", {})
    appended = operations.get("append", [])
    output = bytearray()
    seen: set[str] = set()
    for line in before.splitlines(keepends=True):
        if not line.strip():
            output.extend(line)
            continue
        row = json.loads(line)
        row_id = row.get("id") if isinstance(row, dict) else None
        if row_id in replacements:
            if row_id in seen:
                raise ValueError(f"Duplicate replacement ID: {row_id}")
            output.extend(json_line(replacements[row_id]))
            seen.add(row_id)
        else:
            output.extend(line)
    if set(replacements) != seen:
        raise ValueError(f"Replacement IDs are absent: {sorted(set(replacements) - seen)}")
    if output and not output.endswith(b"\n"):
        output.extend(b"\n")
    for row in appended:
        output.extend(json_line(row))
    return bytes(output)


def next_id(records: dict[str, dict], prefix: str) -> str:
    numbers = [int(value.split("-", 1)[1]) for value in records
               if re.fullmatch(rf"{prefix}-[0-9]+", value)]
    return f"{prefix}-{max(numbers, default=0) + 1:03d}"


def valid_publication_review(review: dict) -> bool:
    marker = review.get("publication_review")
    return (isinstance(marker, dict) and
            isinstance(marker.get("reviewed_by"), str) and bool(marker["reviewed_by"].strip()) and
            marker["reviewed_by"] != review.get("reviewed_by") and
            is_date(marker.get("reviewed_at")))




def stage_file(root: Path, kind: str) -> Path:
    return root / "extractions/staging" / DATA_FILES[kind]


def read_stage(root: Path, kind: str) -> list[dict]:
    path = stage_file(root, kind)
    if not path.exists():
        return []
    rows = []
    for number, line in enumerate(path.read_text().splitlines(), 1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid staged JSONL in {path}:{number}: {exc}") from exc
        if not isinstance(row, dict) or not isinstance(row.get("_stage"), dict):
            raise ValueError(f"Missing _stage block in {path}:{number}")
        if row.get("type") != kind:
            raise ValueError(f"Wrong row type in {path}:{number}")
        rows.append(row)
    return rows


def all_stage_rows(root: Path) -> dict[tuple[str, str], tuple[str, dict]]:
    found = {}
    for kind in DATA_FILES:
        for row in read_stage(root, kind):
            meta = row["_stage"]
            token = (meta.get("ref_id"), meta.get("key"))
            if not all(isinstance(value, str) and value for value in token) or token in found:
                raise ValueError(f"Missing or duplicate staged source/key: {token}")
            found[token] = (kind, row)
    return found


def write_stage(root: Path, kind: str, rows: list[dict], ref_id: str) -> None:
    path = stage_file(root, kind)
    path.parent.mkdir(parents=True, exist_ok=True)
    body = b"".join(json_line(row) for row in rows)
    if path.exists() and path.read_bytes() == body:
        return
    save_bytes(path, body, ref_id)


def pure_row(row: dict) -> dict:
    return {key: copy.deepcopy(value) for key, value in row.items() if key != "_stage"}


def lock_directory(path: Path, message: str) -> int:
    path.mkdir(parents=True, exist_ok=True)
    if fcntl is None:
        key = hashlib.sha256(str(path.resolve()).lower().encode("utf-8")).hexdigest()[:32]
        lock_path = Path(tempfile.gettempdir()) / f"buildos-bulk-extract-{key}.lock"
        fd = os.open(lock_path, os.O_RDWR | os.O_CREAT)
        try:
            msvcrt.locking(fd, msvcrt.LK_LOCK, 1)
        except OSError as exc:
            os.close(fd)
            raise ValueError(f"{message}: {exc}") from exc
        return fd
    fd = os.open(path, os.O_RDONLY)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
    except OSError as exc:
        os.close(fd)
        raise ValueError(f"{message}: {exc}") from exc
    return fd


def unlock_directory(fd: int) -> None:
    if fcntl is None:
        os.lseek(fd, 0, os.SEEK_SET)
        msvcrt.locking(fd, msvcrt.LK_UNLCK, 1)
        os.close(fd)
        return
    fcntl.flock(fd, fcntl.LOCK_UN)
    os.close(fd)


def source_issues(root: Path, group: dict, review: dict, verify_hash: bool) -> tuple[list[str], dict[str, str], dict[str, str]]:
    issues = []
    if review.get("source") != group["source"] or review.get("source_sha256") != group["sha256"]:
        issues.append("Source or source hash differs from reference index")
    source = file_at(root, group["source"])
    if not source.is_file():
        issues.append(f"Original source is missing: {group['source']}")
    elif verify_hash and digest(source) != group["sha256"]:
        issues.append("Original source hash differs from reference index")
    expected = {ref["id"]: ref["converted"] for ref in group["refs"]}
    for converted in expected.values():
        if not file_at(root, converted).is_file():
            issues.append(f"Converted file is missing: {converted}")
    outcomes = {}
    coverage = review.get("references")
    if not isinstance(coverage, list):
        issues.append("references must be a list")
    else:
        for entry in coverage:
            if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
                issues.append("A reference entry is invalid")
                continue
            ref_id = entry["id"]
            if ref_id in outcomes:
                issues.append(f"Duplicate reference entry: {ref_id}")
            outcomes[ref_id] = entry.get("outcome")
            if expected.get(ref_id) != entry.get("converted"):
                issues.append(f"Wrong converted path: {ref_id}")
            if entry.get("outcome") not in REF_OUTCOMES:
                issues.append(f"Invalid outcome: {ref_id}")
            if entry.get("outcome") in {"no-new-rows", "blocked"} and not str(entry.get("note", "")).strip():
                issues.append(f"Add a reason for {ref_id}")
        if set(outcomes) != set(expected):
            issues.append("Review does not cover exactly the source's reference IDs")
    check = review.get("source_check")
    if not isinstance(check, dict) or check.get("result") not in CHECK_RESULTS:
        issues.append("source_check needs a valid result")
    else:
        if not isinstance(check.get("notes"), str) or not isinstance(check.get("repairs"), list):
            issues.append("source_check needs notes and repairs")
        if check["result"] == "repaired" and not check.get("repairs"):
            issues.append("Record the conversion repair")
        if check["result"] in {"matched", "repaired", "partial"} and not str(check.get("notes", "")).strip():
            issues.append("Describe the source comparison")
    if review.get("reviewed_at") and not is_date(review["reviewed_at"]):
        issues.append("reviewed_at needs an ISO date")
    unresolved = review.get("unresolved")
    if not isinstance(unresolved, list) or any(not isinstance(item, str) or not item.strip() for item in unresolved):
        issues.append("unresolved must be a list of nonempty notes")
    return issues, expected, outcomes


def candidate_issues(root: Path, group: dict, candidate: dict, row: dict, records: dict[str, dict] | None,
                     verify_hash: bool, anchor_counts: dict[str, int]) -> list[str]:
    issues = []
    key, kind = candidate.get("key"), candidate.get("type")
    if kind not in DATA_FILES or not isinstance(row, dict):
        return [f"Invalid candidate type or row: {key}"]
    label = f"Candidate {key}"
    for field in ("authored_by", "reviewed_by"):
        if field in candidate and (not isinstance(candidate[field], str) or not candidate[field].strip()):
            issues.append(f"{label} {field} must be a nonblank name")
    if "reviewed_at" in candidate and not is_date(candidate["reviewed_at"]):
        issues.append(f"{label} reviewed_at must be a date")
    anchor_paths = {ref["converted"] for ref in group["refs"]}
    anchor_issue = converted_anchor_issue(root, row.get("source_anchor"), anchor_paths, anchor_counts, verify_hash)
    if anchor_issue:
        issues.append(f"{label} source_anchor {anchor_issue}")
    for support in row.get("source_refs", []) if isinstance(row.get("source_refs"), list) else []:
        if isinstance(support, str) and "#" in support and support.split("#", 1)[0] in anchor_paths:
            problem = converted_anchor_issue(root, support, anchor_paths, anchor_counts, verify_hash)
            if problem:
                issues.append(f"{label} source_refs {problem}")
    if row.get("type") != kind:
        issues.append(f"{label} row type differs from candidate type")
    if "_stage" in row:
        issues.append(f"{label} row must not contain a nested _stage block")
    action, decision = candidate.get("action"), candidate.get("review_state")
    if action not in APPLY_ACTIONS or decision not in REVIEW_DECISIONS:
        issues.append(f"{label} needs an action and review_state")
    if decision == "held" and not str(candidate.get("review_note", "")).strip():
        issues.append(f"{label} held claim needs a review_note")
    target = candidate.get("target_id")
    if action == "minted":
        if target is not None or row.get("id") is not None or row.get("status") != "draft":
            issues.append(f"{label} minted row needs draft status and no global ID")
    elif action in {"referenced", "updated"}:
        if not isinstance(target, str) or not re.fullmatch(rf"{ENTITY_PREFIX[kind]}-[0-9]{{3,}}", target):
            issues.append(f"{label} needs a matching target_id")
        elif records is not None and (target not in records or records[target].get("type") != kind):
            issues.append(f"{label} target_id is absent or has the wrong type")
        if action == "referenced" and (row.get("id") is not None or row.get("status") != "draft"):
            issues.append(f"{label} referenced row needs draft status and no global ID")
        if action == "updated":
            if row.get("id") != target or not re.fullmatch(r"[0-9a-f]{64}", str(candidate.get("base_sha256", ""))):
                issues.append(f"{label} updated row needs its target ID and base_sha256")
            if records is not None and target in records and set(records[target]) - set(row):
                issues.append(f"{label} updated row dropped original fields")
    issues.extend(row_field_issues(row, kind, label))
    return issues


def modern_review_state(root: Path, group: dict, review: dict, records: dict[str, dict] | None,
                        verify_hash: bool) -> tuple[str, list[str]]:
    if records is None and review.get("extraction_ids"):
        records = canonical_records(root)
    issues, expected, outcomes = source_issues(root, group, review, verify_hash)
    candidates = review.get("candidates")
    if not isinstance(candidates, list):
        issues.append("candidates must be a list")
        candidates = []
    staged = all_stage_rows(root)
    keys = set()
    cited_paths = set()
    draft = False
    counts = {}
    applied = review.get("applied")
    if not isinstance(applied, dict):
        issues.append("applied must be an object")
        applied = {}
    for candidate in candidates:
        if not isinstance(candidate, dict):
            issues.append("A candidate is invalid")
            continue
        key, kind = candidate.get("key"), candidate.get("type")
        if not isinstance(key, str) or not key or key in keys:
            issues.append(f"Missing or duplicate candidate key: {key!r}")
            continue
        keys.add(key)
        if kind not in DATA_FILES:
            issues.append(f"Invalid candidate type: {key}")
            continue
        staged_pair = staged.get((group["key"], key))
        if "row" in candidate:
            draft = True
            if staged_pair:
                expected_stage = copy.deepcopy(candidate["row"])
                expected_stage["_stage"] = {name: copy.deepcopy(candidate[name]) for name in
                                            ("key", "action", "review_state", "target_id", "base_sha256", "review_note")
                                            if name in candidate}
                expected_stage["_stage"]["ref_id"] = group["key"]
                # A partial write can precede the root review's final stage save.
                author = candidate.get("authored_by", staged_pair[1]["_stage"].get("authored_by"))
                if "authored_by" in staged_pair[1]["_stage"]:
                    expected_stage["_stage"]["authored_by"] = author
                if staged_pair != (kind, expected_stage):
                    issues.append(f"Candidate {key} draft differs from its partial staged write")
            if key in applied:
                issues.append(f"Candidate {key} is both draft and published")
            row = candidate["row"]
            meta = candidate
        elif staged_pair:
            if key in applied:
                issues.append(f"Candidate {key} is both staged and published")
            staged_kind, full = staged_pair
            if staged_kind != kind:
                issues.append(f"Candidate {key} staged type differs from review link")
            row = pure_row(full)
            meta = full["_stage"]
            if meta.get("ref_id") != group["key"] or meta.get("key") != key:
                issues.append(f"Candidate {key} has the wrong stage link")
        elif key in applied:
            item = applied[key]
            if not isinstance(item, dict) or item.get("action") not in APPLY_ACTIONS or not isinstance(item.get("id"), str):
                issues.append(f"Invalid applied result: {key}")
            else:
                if not re.fullmatch(rf"{ENTITY_PREFIX[kind]}-[0-9]+", item["id"]):
                    issues.append(f"Applied {key} has an ID of the wrong type")
                if records is not None and (item["id"] not in records or records[item["id"]].get("type") != kind):
                    issues.append(f"Applied ID is absent or has the wrong type in .os/data: {item['id']}")
            continue
        else:
            issues.append(f"Candidate {key} has no staged row or applied result")
            continue
        issues.extend(candidate_issues(root, group, {"key": key, "type": kind, **meta}, row,
                                       records, verify_hash, counts))
        anchors = [row.get("source_anchor"), *(row.get("source_refs") if isinstance(row.get("source_refs"), list) else [])]
        for anchor in anchors:
            if isinstance(anchor, str) and "#" in anchor and anchor.split("#", 1)[0] in expected.values():
                cited_paths.add(anchor.split("#", 1)[0])
    if set(applied) - keys:
        issues.append("applied contains an unknown candidate key")
    if {key for ref_id, key in staged if ref_id == group["key"]} - keys:
        issues.append("A staged row has no link in the source review")
    observed_outcomes = {action: set() for action in APPLY_ACTIONS}
    for ext_id in review.get("extraction_ids", []):
        ext = records.get(ext_id) if records is not None else None
        if records is not None and (not isinstance(ext_id, str) or not re.fullmatch(r"EXT-[0-9]+", ext_id) or ext is None):
            issues.append(f"Invalid or missing extraction ID: {ext_id}")
        if isinstance(ext, dict):
            for action in APPLY_ACTIONS:
                values = ext.get(action)
                if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
                    issues.append(f"Extraction {ext_id} has an invalid {action} list")
                else:
                    observed_outcomes[action].update(values)
            for anchor in [ext.get("source_anchor"), *(ext.get("source_refs") or [])]:
                if isinstance(anchor, str) and "#" in anchor and anchor.split("#", 1)[0] in expected.values():
                    cited_paths.add(anchor.split("#", 1)[0])
    if records is not None:
        expected_outcomes = {action: {item["id"] for item in applied.values() if isinstance(item, dict) and
                                      item.get("action") == action and isinstance(item.get("id"), str)}
                             for action in APPLY_ACTIONS}
        if expected_outcomes != observed_outcomes:
            issues.append("Extraction outcomes differ from the applied candidate list")
    if not isinstance(review.get("extraction_ids"), list):
        issues.append("extraction_ids must be a list")
    for ref_id, converted in expected.items():
        if outcomes.get(ref_id) == "reviewed" and converted not in cited_paths:
            issues.append(f"Reviewed {ref_id} has no candidate evidence")
        if outcomes.get(ref_id) != "reviewed" and converted in cited_paths:
            issues.append(f"Candidate cites {ref_id} without a reviewed outcome")
    if review.get("publication_review") is not None and not valid_publication_review(review):
        issues.append("Review decisions need a separate named, dated publication_review")
    if issues:
        return "needs-repair", issues
    if review.get("publication"):
        return "publishing", []
    complete_source = (bool(str(review.get("reviewed_by", "")).strip()) and is_date(review.get("reviewed_at")) and
                       review.get("source_check", {}).get("result") in {"matched", "repaired", "partial"} and
                       "pending" not in outcomes.values())
    if not complete_source:
        return "in-progress", []
    if draft or not review.get("staged_at"):
        return "ready-to-stage", []
    remaining = [staged[(group["key"], key)][1]["_stage"] for key in keys
                 if (group["key"], key) in staged]
    if not remaining and not review.get("unresolved") and "blocked" not in outcomes.values() and valid_publication_review(review):
        return "complete", []
    if any(meta.get("review_state") == "approved" for meta in remaining):
        return "reviewed", []
    if any(meta.get("review_state") == "held" for meta in remaining):
        return "held", []
    if review.get("unresolved") or "blocked" in outcomes.values():
        return "blocked", list(review.get("unresolved", []))
    return "staged", []


def review_state(root: Path, group: dict, records: dict[str, dict] | None = None,
                 verify_hash: bool = False) -> tuple[str, list[str]]:
    path = review_path(root, group)
    if not path.is_file():
        return "pending", []
    try:
        review = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        return "needs-repair", [f"Cannot read review JSON: {exc}"]
    if not isinstance(review, dict):
        return "needs-repair", ["Review must be a JSON object"]
    if review.get("format_version") != 2:
        return legacy_review_state(root, group, records, verify_hash)
    return modern_review_state(root, group, review, records, verify_hash)


def require_modern(root: Path, group: dict) -> dict:
    path = review_path(root, group)
    if not path.is_file():
        raise ValueError(f"Start a review first: {group['key']}")
    review = json.loads(path.read_text())
    if not isinstance(review, dict) or review.get("format_version") != 2:
        raise ValueError("This is an older completed review; start a new source for new work")
    return review


def stage(root: Path, group: dict, author: str | None = None) -> str:
    if author is not None and (not isinstance(author, str) or not author.strip()):
        raise ValueError("Give a nonblank author name")
    if author is not None:
        author = author.strip()
    fd = lock_directory(root / "extractions/staging", "Another staged write is active; retry after it ends")
    try:
        review = require_modern(root, group)
        records = canonical_records(root)
        state, issues = modern_review_state(root, group, review, records, True)
        if state == "needs-repair":
            raise ValueError("Review needs repair: " + "; ".join(issues))
        if state == "in-progress":
            raise ValueError("Finish the named, dated source review before staging")
        if review.get("publication"):
            raise ValueError("Finish the pending publication before staging new rows")
        additions = defaultdict(list)
        existing = all_stage_rows(root)
        drafted = 0
        for candidate in review["candidates"]:
            if "row" not in candidate:
                continue
            if candidate.get("review_state") != "pending":
                raise ValueError(f"Stage 1 candidate {candidate['key']} must be pending")
            kind, key = candidate["type"], candidate["key"]
            row = copy.deepcopy(candidate["row"])
            row["_stage"] = {name: copy.deepcopy(candidate[name]) for name in
                             ("key", "action", "review_state", "target_id", "base_sha256", "review_note")
                             if name in candidate}
            row["_stage"]["ref_id"] = group["key"]
            prior = existing.get((group["key"], key))
            saved_author = candidate.get("authored_by")
            if saved_author is None and prior:
                saved_author = prior[1]["_stage"].get("authored_by", review["reviewed_by"])
            if saved_author is not None:
                if author is not None and author != saved_author:
                    raise ValueError(f"Keep the original author for partial staged candidate {key}")
                candidate_author = saved_author
            elif author is not None:
                candidate_author = author
            elif not review.get("staged_at"):
                candidate_author = review["reviewed_by"]
            else:
                raise ValueError(f"New candidate {key} needs stage --author NAME after the source was staged")
            if not isinstance(candidate_author, str) or not candidate_author.strip():
                raise ValueError(f"Candidate {key} needs a nonblank author")
            row["_stage"]["authored_by"] = candidate_author
            if prior:
                # Old partial staged rows can lack author fields. Do not backfill them.
                comparison = copy.deepcopy(row)
                if "authored_by" not in prior[1]["_stage"]:
                    comparison["_stage"].pop("authored_by")
                if prior != (kind, comparison):
                    raise ValueError(f"Staged candidate {key} differs from its draft; settle the partial write")
            else:
                additions[kind].append(row)
            candidate["authored_by"] = candidate_author
            drafted += 1
        if drafted:
            # Save authors for all validated drafts before any typed stage write.
            # A retry must also retain authors for rows not yet written.
            save_json(review_path(root, group), review, group["key"])
        for kind, rows in additions.items():
            write_stage(root, kind, read_stage(root, kind) + rows, group["key"])
        if drafted:
            review["publication_review"] = None
        review["candidates"] = [{"key": item["key"], "type": item["type"]} for item in review["candidates"]]
        review["staged_at"] = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        save_json(review_path(root, group), review, group["key"])
        return f"Staged {drafted} candidates; review: {review_path(root, group).relative_to(root)}"
    finally:
        unlock_directory(fd)


def stage_update(root: Path, group: dict, row_id: str, key: str) -> str:
    fd = lock_directory(root / "extractions/staging", "Another staged write is active; retry after it ends")
    try:
        review = require_modern(root, group)
        if review.get("publication"):
            raise ValueError("Finish the pending publication first")
        if any(candidate.get("key") == key for candidate in review.get("candidates", [])):
            raise ValueError(f"Candidate key already exists: {key}")
        row = canonical_records(root).get(row_id)
        if row is None or row.get("type") not in ENTITY_PREFIX:
            raise ValueError(f"No supported row with ID {row_id}")
        review["candidates"].append({"key": key, "type": row["type"], "action": "updated",
                                      "review_state": "pending", "target_id": row_id,
                                      "base_sha256": row_hash(row), "row": copy.deepcopy(row)})
        save_json(review_path(root, group), review, group["key"])
        return f"Copied {row_id} into {review_path(root, group).relative_to(root)}; edit this draft, then run stage"
    finally:
        unlock_directory(fd)


def replace_row(root: Path, group: dict, key: str, new_row: dict) -> str:
    if not isinstance(new_row, dict) or "_stage" in new_row:
        raise ValueError("Pass one BuildOS row object without _stage on standard input")
    fd = lock_directory(root / "extractions/staging", "Another staged write is active; retry after it ends")
    try:
        review = require_modern(root, group)
        if review.get("publication"):
            raise ValueError("Finish the pending publication first")
        links = [item for item in review["candidates"] if item.get("key") == key]
        if len(links) != 1:
            raise ValueError(f"No unique candidate link: {key}")
        kind = links[0]["type"]
        rows = read_stage(root, kind)
        matches = [number for number, row in enumerate(rows) if row["_stage"].get("ref_id") == group["key"]
                   and row["_stage"].get("key") == key]
        if len(matches) != 1:
            raise ValueError(f"No unique staged row: {key}")
        number = matches[0]
        meta = rows[number]["_stage"]
        if meta.get("review_state") == "approved":
            raise ValueError("Reset an approved decision before changing its row")
        problems = candidate_issues(root, group, {"key": key, "type": kind, **meta}, new_row,
                                    canonical_records(root), True, {})
        if problems:
            raise ValueError("Row needs repair: " + "; ".join(problems))
        meta["review_state"] = "pending"
        meta.pop("review_note", None)
        meta.pop("reviewed_by", None)
        meta.pop("reviewed_at", None)
        rows[number] = {**copy.deepcopy(new_row), "_stage": meta}
        write_stage(root, kind, rows, group["key"])
        return f"Replaced staged {key} in {stage_file(root, kind).relative_to(root)}"
    finally:
        unlock_directory(fd)


def decide(root: Path, group: dict, reviewer: str, decisions: list[dict]) -> str:
    if not reviewer.strip() or not isinstance(decisions, list):
        raise ValueError("Give a reviewer name and a JSON list of decisions")
    fd = lock_directory(root / "extractions/staging", "Another staged write is active; retry after it ends")
    try:
        review = require_modern(root, group)
        if review.get("publication"):
            raise ValueError("Finish the pending publication first")
        if reviewer == review.get("reviewed_by"):
            raise ValueError("The Stage 2 reviewer must differ from the extraction reviewer")
        state, issues = modern_review_state(root, group, review, canonical_records(root), True)
        if state == "needs-repair":
            raise ValueError("Review needs repair: " + "; ".join(issues))
        if state in {"in-progress", "ready-to-stage"}:
            raise ValueError("Stage 1 is not finished")
        linked = {item["key"]: item["type"] for item in review["candidates"]}
        seen = set()
        changes = defaultdict(list)
        timestamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
        for decision in decisions:
            if not isinstance(decision, dict) or decision.get("key") not in linked or decision["key"] in seen:
                raise ValueError("Each decision needs a distinct linked candidate key")
            key = decision["key"]
            seen.add(key)
            choice = decision.get("review_state")
            if choice not in {"approved", "held", "pending"}:
                raise ValueError(f"Invalid review_state for {key}")
            note = decision.get("review_note", "")
            if not isinstance(note, str) or (choice == "held" and not note.strip()):
                raise ValueError(f"Held candidate {key} needs a review_note")
            if key in review["applied"]:
                raise ValueError(f"Candidate {key} is already published")
            changes[linked[key]].append((key, choice, note))
        for kind, kind_changes in changes.items():
            rows = read_stage(root, kind)
            for key, choice, note in kind_changes:
                matches = [row for row in rows if row["_stage"].get("ref_id") == group["key"] and
                           row["_stage"].get("key") == key]
                if len(matches) != 1:
                    raise ValueError(f"Missing or duplicate staged row: {key}")
                matches[0]["_stage"]["review_state"] = choice
                matches[0]["_stage"]["reviewed_by"] = reviewer
                matches[0]["_stage"]["reviewed_at"] = timestamp
                if note:
                    matches[0]["_stage"]["review_note"] = note
                else:
                    matches[0]["_stage"].pop("review_note", None)
            write_stage(root, kind, rows, group["key"])
        review["publication_review"] = {"reviewed_by": reviewer,
                                         "reviewed_at": timestamp}
        save_json(review_path(root, group), review, group["key"])
        return f"Recorded {len(decisions)} Stage 2 decisions for {group['key']}"
    finally:
        unlock_directory(fd)


def pending_publications(root: Path) -> list[Path]:
    pending = []
    for path in (root / "extractions").glob("REF-*.json"):
        review = json.loads(path.read_text())
        if isinstance(review, dict) and review.get("format_version") == 2 and review.get("publication"):
            pending.append(path)
    return pending


def publication_plan(root: Path, group: dict, review: dict, records: dict[str, dict],
                     approved: list[tuple[str, dict]]) -> dict:
    if not approved:
        raise ValueError("No approved, unpublished candidates")
    timestamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")
    known = dict(records)
    operations: dict[str, dict] = {}
    outcomes = {name: [] for name in APPLY_ACTIONS}
    assignments = {}
    anchors = []
    authors = []
    remove = []
    for kind, staged in approved:
        meta = staged["_stage"]
        key, action = meta["key"], meta["action"]
        row = pure_row(staged)
        if action == "minted":
            row_id = next_id(known, ENTITY_PREFIX[kind])
            row["id"] = row_id
            if row.get("created_at") is None:
                row["created_at"] = timestamp
            row["updated_at"] = timestamp
            known[row_id] = row
            operations.setdefault(f".os/data/{DATA_FILES[kind]}", {"replace": {}, "append": []})["append"].append(row)
        else:
            row_id = meta["target_id"]
            if row_id not in records:
                raise ValueError(f"Missing target row: {row_id}")
            if action == "updated":
                if row_hash(records[row_id]) != meta["base_sha256"]:
                    raise ValueError(f"Source row changed after staging: {row_id}; review the update again")
                row["updated_at"] = timestamp
                operations.setdefault(f".os/data/{DATA_FILES[kind]}", {"replace": {}, "append": []})["replace"][row_id] = row
        author = meta.get("authored_by", review["reviewed_by"])
        if author not in authors:
            authors.append(author)
        publication_review = review["publication_review"]
        assignments[key] = {"id": row_id, "action": action, "candidate_sha256": row_hash(pure_row(staged)),
                            "authored_by": author,
                            "reviewed_by": meta.get("reviewed_by", publication_review["reviewed_by"]),
                            "reviewed_at": meta.get("reviewed_at", publication_review["reviewed_at"])}
        outcomes[action].append(row_id)
        remove.append({"kind": kind, "key": key, "sha256": row_hash(staged)})
        for anchor in [staged.get("source_anchor"), *(staged.get("source_refs") or [])]:
            if isinstance(anchor, str) and anchor not in anchors:
                anchors.append(anchor)
    outcome_ids = [value for values in outcomes.values() for value in values]
    if len(outcome_ids) != len(set(outcome_ids)):
        raise ValueError("One entity cannot be both referenced and updated in one extraction; keep only the updated candidate")
    ext_id = next_id(known, "EXT")
    ext = {"id": ext_id, "type": "extraction", "title": f"{group['key']} source extraction",
           "status": "draft", "summary": f"Reviewed source-backed rows from {group['key']}.",
           "source_anchor": approved[0][1]["source_anchor"], "doc_anchor": None,
           "source_refs": anchors, "related": [], "created_at": timestamp, "updated_at": timestamp,
           "outcome_contract": "extraction-outcomes-v1", **outcomes,
           "extracted_by": "; ".join(authors), "extracted_at": timestamp}
    ext_issues = extraction_row_issues(ext)
    if ext_issues:
        raise ValueError("The extraction row would not pass buildos validate: " + "; ".join(ext_issues))
    operations.setdefault(".os/data/extractions.jsonl", {"replace": {}, "append": []})["append"].append(ext)
    too_long = [issue for relative, change in operations.items() for issue in row_limit_issues(relative, change)]
    if too_long:
        raise ValueError("A row would be too long for BuildOS to read back; nothing was written: " + "; ".join(too_long))
    files = {}
    for relative, change in operations.items():
        before = file_at(root, relative).read_bytes()
        after = apply_operations(before, change)
        files[relative] = {"before_sha256": hashlib.sha256(before).hexdigest(),
                           "after_sha256": hashlib.sha256(after).hexdigest(), "operations": change}
    return {"version": 2, "review_sha256": row_hash(review), "assignments": assignments,
            "extraction_id": ext_id, "files": files, "remove": remove, "created_at": timestamp}


def resume_publication(root: Path, group: dict, review: dict) -> str:
    path = review_path(root, group)
    intent = review.get("publication")
    if not isinstance(intent, dict) or intent.get("version") != 2:
        raise ValueError("Invalid pending publication")
    unchanged = dict(review)
    unchanged.pop("publication")
    if intent.get("review_sha256") != row_hash(unchanged):
        raise ValueError("Review changed during publication; resolve the pending write first")
    files = intent.get("files")
    allowed = {f".os/data/{name}" for name in DATA_FILES.values()} | {".os/data/extractions.jsonl"}
    if not isinstance(files, dict) or ".os/data/extractions.jsonl" not in files or set(files) - allowed:
        raise ValueError("Pending publication has invalid system data files")
    ordered = sorted(name for name in files if name != ".os/data/extractions.jsonl") + [".os/data/extractions.jsonl"]
    for relative in ordered:
        item = files[relative]
        target = file_at(root, relative)
        before = target.read_bytes()
        checksum = hashlib.sha256(before).hexdigest()
        if checksum == item["after_sha256"]:
            continue
        if checksum != item["before_sha256"]:
            raise ValueError(f"{relative} changed during publication; pending review remains for recovery")
        after = apply_operations(before, item["operations"])
        if hashlib.sha256(after).hexdigest() != item["after_sha256"]:
            raise ValueError(f"Pending publication does not match {relative}")
        save_bytes(target, after, group["key"])
    for kind in {item["kind"] for item in intent["remove"]}:
        rows = read_stage(root, kind)
        remove = {item["key"]: item["sha256"] for item in intent["remove"] if item["kind"] == kind}
        kept = []
        for row in rows:
            meta = row["_stage"]
            key = meta.get("key") if meta.get("ref_id") == group["key"] else None
            if key in remove:
                if row_hash(row) != remove[key]:
                    raise ValueError(f"Staged row {key} changed during publication")
                continue
            kept.append(row)
        if len(kept) != len(rows):
            write_stage(root, kind, kept, group["key"])
    for key, outcome in intent["assignments"].items():
        review["applied"][key] = outcome
    ext_id = intent["extraction_id"]
    if ext_id not in review["extraction_ids"]:
        review["extraction_ids"].append(ext_id)
    review.pop("publication")
    save_json(path, review, group["key"])
    return f"Published {len(intent['assignments'])} candidates as {ext_id}."


def publish(root: Path, group: dict) -> str:
    stage_fd = lock_directory(root / "extractions/staging", "Another staged write is active; retry after it ends")
    try:
        data_fd = lock_directory(root / ".os/data", "Another publication is active; retry after it ends")
        try:
            review = require_modern(root, group)
            pending = pending_publications(root)
            if pending and pending != [review_path(root, group)]:
                raise ValueError(f"Resume pending publication first: {pending[0].name}")
            if review.get("publication"):
                return resume_publication(root, group, review)
            records = canonical_records(root)
            state, issues = modern_review_state(root, group, review, records, True)
            if state == "needs-repair":
                raise ValueError("Review needs repair: " + "; ".join(issues))
            if state in {"pending", "in-progress", "ready-to-stage"}:
                raise ValueError("Stage 1 needs a named, dated source review and staged rows")
            if not valid_publication_review(review):
                raise ValueError("A separate named Stage 2 review is required")
            if any(ref.get("outcome") == "pending" for ref in review["references"]):
                raise ValueError("Review every converted reference before publication")
            staged = all_stage_rows(root)
            approved = []
            for link in review["candidates"]:
                pair = staged.get((group["key"], link["key"]))
                if pair and pair[1]["_stage"].get("review_state") == "approved":
                    approved.append(pair)
            if not approved:
                if state == "complete" or (not review["candidates"] and not review.get("unresolved") and
                                           all(ref["outcome"] == "no-new-rows" for ref in review["references"])):
                    return "Review complete; no rows to publish"
                return "No approved, unpublished candidates; held and pending rows remain staged"
            intent = publication_plan(root, group, review, records, approved)
            review["publication"] = intent
            save_json(review_path(root, group), review, group["key"])
            return resume_publication(root, group, review)
        finally:
            unlock_directory(data_fd)
    finally:
        unlock_directory(stage_fd)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=Path("."))
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    next_parser = sub.add_parser("next")
    next_parser.add_argument("--count", type=int, default=1)
    next_parser.add_argument("--stage", choices=("extract", "review"), default="extract")
    for command in ("show", "start", "check", "stage", "publish"):
        command_parser = sub.add_parser(command)
        command_parser.add_argument("ref_id")
        if command == "stage":
            command_parser.add_argument("--author")
    sub.add_parser("template").add_argument("type", choices=tuple(ENTITY_PREFIX))
    update_parser = sub.add_parser("stage-update")
    update_parser.add_argument("ref_id")
    update_parser.add_argument("row_id")
    update_parser.add_argument("--key", required=True)
    replace_parser = sub.add_parser("replace-row")
    replace_parser.add_argument("ref_id")
    replace_parser.add_argument("key")
    decide_parser = sub.add_parser("decide")
    decide_parser.add_argument("ref_id")
    decide_parser.add_argument("--reviewer", required=True)
    args = parser.parse_args()
    root = args.repo_root.resolve()
    try:
        groups = groups_from_index(root)
        if args.command == "template":
            print(json.dumps({"candidate": candidate_template(args.type),
                              "field_meanings": TYPE_FIELDS[args.type],
                              "common_field_meanings": COMMON_MEANINGS}, indent=2))
            return 0
        if args.command in {"status", "next"}:
            states = [(group, *review_state(root, group)) for group in groups]
            if args.command == "status":
                counts = Counter(state for _, state, _ in states)
                print(f"{len(groups)} sources; {sum(len(group['refs']) for group in groups)} converted records")
                print("Progress comes from root review files and tagged staged rows; check REF-ID verifies links.")
                for state in ("complete", "ready-to-stage", "staged", "reviewed", "held", "publishing",
                              "in-progress", "blocked", "needs-repair", "pending"):
                    print(f"{state}: {counts[state]}")
            else:
                if args.count < 1:
                    raise ValueError("--count must be positive")
                for group, state, _ in states:
                    path = review_path(root, group)
                    if args.stage == "extract" and path.exists():
                        continue
                    if args.stage == "review":
                        if not path.is_file():
                            continue
                        review = json.loads(path.read_text())
                        if review.get("format_version") != 2 or not review.get("staged_at") or state == "complete":
                            continue
                    print(f"{group['key']}\t{state}\t{len(group['refs'])} twins\t{group['source']}")
                    args.count -= 1
                    if args.count == 0:
                        break
            return 0
        group = group_for(groups, args.ref_id)
        path = review_path(root, group)
        if args.command == "show":
            candidates = []
            if path.is_file():
                review = json.loads(path.read_text())
                if review.get("format_version") == 2:
                    staged = all_stage_rows(root)
                    for link in review.get("candidates", []):
                        key, kind = link.get("key"), link.get("type")
                        pair = staged.get((group["key"], key))
                        candidates.append({"key": key, "type": kind,
                                           "location": "draft review" if "row" in link else
                                           str(stage_file(root, kind).relative_to(root)) if pair else "published",
                                           "stage": pair[1]["_stage"] if pair else None,
                                           "applied": review.get("applied", {}).get(key)})
            print(json.dumps({"key": group["key"], "source": group["source"],
                              "references": [{"id": ref["id"], "converted": ref["converted"]} for ref in group["refs"]],
                              "review": str(path.relative_to(root)), "candidates": candidates}, indent=2))
            return 0
        if args.command == "start":
            path.parent.mkdir(parents=True, exist_ok=True)
            skeleton = {"format_version": 2, "source": group["source"], "source_sha256": group["sha256"],
                        "reviewed_by": "", "reviewed_at": "",
                        "source_check": {"result": "unverified", "notes": "", "repairs": []},
                        "references": [{"id": ref["id"], "converted": ref["converted"],
                                        "outcome": "pending", "note": ""} for ref in group["refs"]],
                        "candidates": [], "unresolved": [], "applied": {}, "extraction_ids": [],
                        "publication_review": None}
            try:
                with path.open("x") as stream:
                    json.dump(skeleton, stream, indent=2)
                    stream.write("\n")
            except FileExistsError:
                print(f"Review already exists: {path}")
            else:
                print(f"Created: {path}")
            return 0
        if args.command == "stage-update":
            print(stage_update(root, group, args.row_id, args.key))
            return 0
        if args.command == "stage":
            print(stage(root, group, args.author))
            return 0
        if args.command == "replace-row":
            print(replace_row(root, group, args.key, json.load(sys.stdin)))
            return 0
        if args.command == "decide":
            print(decide(root, group, args.reviewer, json.load(sys.stdin)))
            return 0
        if args.command == "publish":
            print(publish(root, group))
            return 0
        state, issues = review_state(root, group, canonical_records(root), verify_hash=True)
        print(f"{group['key']}: {state} ({path})")
        for issue in issues:
            print(f"- {issue}")
        return 1 if state in {"needs-repair", "in-progress", "pending", "publishing"} else 0
    except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    sys.exit(main())
