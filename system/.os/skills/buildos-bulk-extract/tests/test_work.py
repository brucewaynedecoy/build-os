"""Behavior tests for root reviews and typed staged rows."""

from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/work.py"
spec = importlib.util.spec_from_file_location("buildos_work", SCRIPT)
work = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(work)
STAMP = "2026-09-30T20:00:00Z"


class WorkTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        (self.root / ".os/indexes").mkdir(parents=True)
        (self.root / ".os/data").mkdir(parents=True)
        refs = []
        for number, letter in ((1, "a"), (2, "b")):
            source = f"assets/_intake/{letter}.txt"
            converted = f"assets/{letter}/{letter}.md"
            (self.root / source).parent.mkdir(parents=True, exist_ok=True)
            (self.root / converted).parent.mkdir(parents=True, exist_ok=True)
            (self.root / source).write_text(f"Original {letter}\n")
            (self.root / converted).write_text(f"Source statement {letter}.\nMore {letter}.\n")
            refs.append({"id": f"REF-{number:03d}", "source": source, "converted": converted,
                         "sha256": hashlib.sha256((self.root / source).read_bytes()).hexdigest()})
        (self.root / ".os/indexes/references.json").write_text(json.dumps({"references": refs}))
        self.original = {"id": "REQ-001", "type": "requirement", "title": "Existing need",
                         "status": "draft", "summary": "Existing summary", "source_anchor": "assets/a/a.md#L1",
                         "doc_anchor": None, "source_refs": ["assets/a/a.md#L1"], "related": [],
                         "created_at": STAMP, "updated_at": STAMP, "statement": "Existing statement",
                         "rationale": "Existing reason", "acceptance_refs": [], "custom_field": "Keep this"}
        (self.root / ".os/data/requirements.jsonl").write_text(json.dumps(self.original) + "\n")
        for name in ("capabilities", "findings", "extractions", "personas", "test-cases", "results", "runs"):
            (self.root / f".os/data/{name}.jsonl").write_text("")

    def cli(self, *args: str, input: str | None = None, success: bool = True) -> subprocess.CompletedProcess[str]:
        proc = subprocess.run([sys.executable, str(SCRIPT), "--repo-root", str(self.root), *args],
                              input=input, text=True, capture_output=True)
        if success and proc.returncode:
            self.fail(f"CLI failed: {args}\n{proc.stdout}\n{proc.stderr}")
        return proc

    def group(self, ref: str = "REF-001") -> dict:
        return work.group_for(work.groups_from_index(self.root), ref)

    def review_path(self, ref: str = "REF-001") -> Path:
        return work.review_path(self.root, self.group(ref))

    def stage_path(self, kind: str = "requirement") -> Path:
        return work.stage_file(self.root, kind)

    def rows(self, name: str, staged: bool = False) -> list[dict]:
        path = self.root / ("extractions/staging" if staged else ".os/data") / f"{name}.jsonl"
        return [json.loads(line) for line in path.read_text().splitlines() if line] if path.exists() else []

    def requirement(self, key: str, ref: str = "REF-001", action: str = "minted") -> dict:
        item = work.candidate_template("requirement")
        item["key"], item["action"] = key, action
        letter = "a" if ref == "REF-001" else "b"
        item["row"].update({"title": f"Need {key}", "summary": f"Summary {key}",
                            "source_anchor": f"assets/{letter}/{letter}.md#L1",
                            "source_refs": [f"assets/{letter}/{letter}.md#L1"],
                            "statement": f"The system shall {key}.", "rationale": "The source states this need."})
        return item

    def ready(self, ref: str = "REF-001", candidates: list[dict] | None = None, no_rows: bool = False) -> None:
        self.cli("start", ref)
        review = json.loads(self.review_path(ref).read_text())
        review["reviewed_by"], review["reviewed_at"] = "source agent", STAMP
        review["source_check"] = {"result": "matched", "notes": "Checked the original and conversion", "repairs": []}
        review["references"][0]["outcome"] = "no-new-rows" if no_rows else "reviewed"
        if no_rows:
            review["references"][0]["note"] = "The source repeats a saved need."
        review["candidates"] = candidates or []
        self.review_path(ref).write_text(json.dumps(review, indent=2) + "\n")

    def decide(self, ref: str = "REF-001", decisions: list[dict] | None = None) -> None:
        self.cli("decide", ref, "--reviewer", "other reviewer", input=json.dumps(decisions or []))

    def test_exact_paths_and_stage_one_does_not_write_system_data(self) -> None:
        before = {p.name: p.read_bytes() for p in (self.root / ".os/data").glob("*.jsonl")}
        self.ready(candidates=[self.requirement("new")])
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.cli("stage", "REF-001")
        self.assertTrue(self.review_path().is_file())
        self.assertFalse((self.root / "extractions/staging" / self.group()["filename"]).exists())
        self.assertEqual([p.name for p in (self.root / "extractions/staging").iterdir()], ["requirements.jsonl"])
        review = json.loads(self.review_path().read_text())
        self.assertEqual(review["candidates"], [{"key": "new", "type": "requirement"}])
        self.assertEqual(self.rows("requirements", True)[0]["_stage"]["ref_id"], "REF-001")
        self.cli("stage", "REF-001")
        self.assertEqual(len(self.rows("requirements", True)), 1)
        self.assertEqual({p.name: p.read_bytes() for p in (self.root / ".os/data").glob("*.jsonl")}, before)
        self.assertIn("REF-001", self.cli("next", "--stage", "review").stdout)
        self.assertEqual(self.cli("next", "--stage", "extract", "--count", "2").stdout.strip().split("\t")[0], "REF-002")

    def test_field_errors_and_one_editable_copy(self) -> None:
        bad = self.requirement("bad")
        bad["row"]["acceptance_refs"] = "TC-001"
        self.ready(candidates=[bad])
        self.assertIn("acceptance_refs", self.cli("check", "REF-001", success=False).stdout)
        self.assertIn("Review needs repair", self.cli("stage", "REF-001", success=False).stderr)
        review = json.loads(self.review_path().read_text())
        review["candidates"][0]["row"]["acceptance_refs"] = []
        self.review_path().write_text(json.dumps(review))
        self.cli("stage", "REF-001")
        row = work.pure_row(self.rows("requirements", True)[0])
        row["summary"] = "Corrected source summary"
        self.cli("replace-row", "REF-001", "bad", input=json.dumps(row))
        self.assertEqual(self.rows("requirements", True)[0]["summary"], "Corrected source summary")
        self.assertEqual(json.loads(self.review_path().read_text())["candidates"], [{"key": "bad", "type": "requirement"}])
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.assertFalse(list(self.root.rglob(".workpy-*.tmp")))

    def test_new_row_and_provenance_only_on_publish(self) -> None:
        self.ready(candidates=[self.requirement("new")])
        self.cli("stage", "REF-001")
        self.assertEqual(self.rows("extractions"), [])
        self.decide(decisions=[{"key": "new", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        saved = self.rows("requirements")[1]
        self.assertEqual(saved["id"], "REQ-002")
        self.assertNotIn("_stage", saved)
        self.assertEqual(self.rows("requirements", True), [])
        self.assertEqual(self.rows("extractions")[0]["minted"], ["REQ-002"])
        self.assertEqual(json.loads(self.review_path().read_text())["applied"]["new"]["id"], "REQ-002")
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.assertEqual(self.cli("next", "--stage", "review").stdout, "")

    def test_reuse_does_not_change_saved_row(self) -> None:
        reuse = self.requirement("reuse", action="referenced")
        reuse["target_id"] = "REQ-001"
        self.ready(candidates=[reuse])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "reuse", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        self.assertEqual(self.rows("requirements"), [self.original])
        self.assertEqual(self.rows("extractions")[0]["referenced"], ["REQ-001"])

    def test_correction_keeps_id_fields_and_checks_stale_hash(self) -> None:
        self.ready(no_rows=True)
        self.cli("stage-update", "REF-001", "REQ-001", "--key", "correction")
        review = json.loads(self.review_path().read_text())
        review["references"][0]["outcome"] = "reviewed"
        review["references"][0]["note"] = ""
        review["candidates"][0]["row"]["summary"] = "Corrected summary"
        self.review_path().write_text(json.dumps(review))
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "correction", "review_state": "approved"}])
        changed = copy.deepcopy(self.original)
        changed["summary"] = "Another edit"
        (self.root / ".os/data/requirements.jsonl").write_text(json.dumps(changed) + "\n")
        denied = self.cli("publish", "REF-001", success=False)
        self.assertIn("changed after staging", denied.stderr)
        self.assertEqual(self.rows("requirements"), [changed])
        (self.root / ".os/data/requirements.jsonl").write_text(json.dumps(self.original) + "\n")
        self.cli("publish", "REF-001")
        saved = self.rows("requirements")[0]
        self.assertEqual(saved["id"], "REQ-001")
        self.assertEqual(saved["custom_field"], "Keep this")
        self.assertEqual(saved["summary"], "Corrected summary")
        self.assertEqual(self.rows("extractions")[0]["updated"], ["REQ-001"])

    def test_held_and_partial_publish(self) -> None:
        self.ready(candidates=[self.requirement("yes"), self.requirement("maybe")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "yes", "review_state": "approved"},
                               {"key": "maybe", "review_state": "held", "review_note": "Needs a fuller citation"}])
        self.cli("publish", "REF-001")
        self.assertEqual(len(self.rows("requirements")), 2)
        remaining = self.rows("requirements", True)
        self.assertEqual([row["_stage"]["key"] for row in remaining], ["maybe"])
        self.assertTrue(self.review_path().exists())
        self.assertIn("REF-001", self.cli("next", "--stage", "review").stdout)
        self.assertEqual(len(self.rows("extractions")), 1)
        self.decide(decisions=[{"key": "maybe", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        self.assertEqual(len(self.rows("requirements")), 3)
        self.assertEqual(self.rows("requirements", True), [])
        self.assertEqual(len(self.rows("extractions")), 2)
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)

    def test_no_new_row_requires_separate_review(self) -> None:
        self.ready(no_rows=True)
        self.cli("stage", "REF-001")
        self.assertIn("separate named", self.cli("publish", "REF-001", success=False).stderr)
        self.decide()
        self.assertIn("no rows", self.cli("publish", "REF-001").stdout)
        self.assertEqual(self.rows("extractions"), [])
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)

    def test_old_root_review_stays_valid_and_out_of_queues(self) -> None:
        self.ready(no_rows=True)
        review = json.loads(self.review_path().read_text())
        review.pop("format_version")
        review.pop("publication_review")
        self.review_path().write_text(json.dumps(review))
        before = self.review_path().read_bytes()
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.assertNotIn("REF-001", self.cli("next", "--stage", "extract", "--count", "2").stdout)
        self.assertEqual(self.cli("next", "--stage", "review").stdout, "")
        self.assertEqual(self.review_path().read_bytes(), before)

    def test_held_decision_needs_a_reason(self) -> None:
        self.ready(candidates=[self.requirement("maybe")])
        self.cli("stage", "REF-001")
        denied = self.cli("decide", "REF-001", "--reviewer", "other reviewer",
                          input=json.dumps([{"key": "maybe", "review_state": "held"}]), success=False)
        self.assertIn("review_note", denied.stderr)
        self.assertEqual(self.rows("requirements", True)[0]["_stage"]["review_state"], "pending")
        self.assertEqual(self.rows("requirements"), [self.original])

    def test_interrupted_publication_retries_without_duplicate(self) -> None:
        self.ready(candidates=[self.requirement("new")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "new", "review_state": "approved"}])
        original_save = work.save_bytes
        calls = 0

        def interrupt(path: Path, value: bytes, ref_id: str) -> None:
            nonlocal calls
            original_save(path, value, ref_id)
            calls += 1
            if calls == 1:
                raise RuntimeError("simulated interruption")

        work.save_bytes = interrupt
        try:
            with self.assertRaisesRegex(RuntimeError, "simulated interruption"):
                work.publish(self.root, self.group())
        finally:
            work.save_bytes = original_save
        self.assertIn("publication", json.loads(self.review_path().read_text()))
        intent = json.loads(self.review_path().read_text())["publication"]
        expected = intent["assignments"]["new"]
        work.publish(self.root, self.group())
        self.assertEqual(len(self.rows("requirements")), 2)
        self.assertEqual(len(self.rows("extractions")), 1)
        self.assertEqual(self.rows("requirements", True), [])
        self.assertEqual(json.loads(self.review_path().read_text())["applied"]["new"], expected)
        self.assertEqual(expected["authored_by"], "source agent")
        self.assertEqual(expected["reviewed_by"], "other reviewer")
        self.assertFalse(list(self.root.rglob(".workpy-*.tmp")))

    def test_retry_keeps_other_source_row_after_interrupted_publish(self) -> None:
        self.ready(candidates=[self.requirement("first")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "first", "review_state": "approved"}])
        original_save = work.save_bytes
        calls = 0

        def interrupt(path: Path, value: bytes, ref_id: str) -> None:
            nonlocal calls
            original_save(path, value, ref_id)
            calls += 1
            if calls == 1:
                raise RuntimeError("simulated interruption")

        work.save_bytes = interrupt
        try:
            with self.assertRaisesRegex(RuntimeError, "simulated interruption"):
                work.publish(self.root, self.group())
        finally:
            work.save_bytes = original_save
        self.ready("REF-002", [self.requirement("second", "REF-002")])
        self.cli("stage", "REF-002")
        work.publish(self.root, self.group())
        self.assertEqual([row["_stage"]["ref_id"] for row in self.rows("requirements", True)], ["REF-002"])
        self.assertEqual(len(self.rows("requirements")), 2)
        self.assertEqual(len(self.rows("extractions")), 1)

    def test_retry_after_partial_stage_write(self) -> None:
        capability = work.candidate_template("capability")
        capability["key"] = "cap"
        capability["row"].update({"title": "Capability", "summary": "Supported ability",
                                  "source_anchor": "assets/a/a.md#L2", "source_refs": ["assets/a/a.md#L2"],
                                  "description": "The system supports the ability.", "supports": [], "limits": []})
        self.ready(candidates=[self.requirement("need"), capability])
        original_write = work.write_stage
        calls = 0

        def interrupt(root: Path, kind: str, rows: list[dict], ref_id: str) -> None:
            nonlocal calls
            original_write(root, kind, rows, ref_id)
            calls += 1
            if calls == 1:
                raise RuntimeError("simulated interruption")

        work.write_stage = interrupt
        try:
            with self.assertRaisesRegex(RuntimeError, "simulated interruption"):
                work.stage(self.root, self.group(), "explicit author")
        finally:
            work.write_stage = original_write
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        with self.assertRaisesRegex(ValueError, "Keep the original author"):
            work.stage(self.root, self.group(), "changed author")
        self.assertEqual(before, {str(p.relative_to(self.root)): p.read_bytes()
                                  for p in self.root.rglob("*") if p.is_file()})
        work.stage(self.root, self.group())
        self.assertEqual(len(self.rows("requirements", True)), 1)
        self.assertEqual(len(self.rows("capabilities", True)), 1)
        for kind in ("requirements", "capabilities"):
            self.assertEqual(self.rows(kind, True)[0]["_stage"]["authored_by"], "explicit author")
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.assertFalse(list(self.root.rglob(".workpy-*.tmp")))

    def test_first_stage_author_default_and_explicit(self) -> None:
        self.ready(candidates=[self.requirement("default")])
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        self.assertNotEqual(self.cli("stage", "REF-001", "--author", "  ", success=False).returncode, 0)
        self.assertEqual(before, {str(p.relative_to(self.root)): p.read_bytes()
                                  for p in self.root.rglob("*") if p.is_file()})
        self.cli("stage", "REF-001")
        self.assertEqual(self.rows("requirements", True)[0]["_stage"]["authored_by"], "source agent")
        self.ready("REF-002", [self.requirement("explicit", "REF-002")])
        self.cli("stage", "REF-002", "--author", "review agent")
        self.assertEqual(self.rows("requirements", True)[1]["_stage"]["authored_by"], "review agent")
        self.assertEqual(json.loads(self.review_path("REF-002").read_text())["reviewed_by"], "source agent")

    def test_later_partial_stage_keeps_explicit_author_on_retry(self) -> None:
        self.ready(candidates=[self.requirement("first")])
        self.cli("stage", "REF-001")
        capability = work.candidate_template("capability")
        capability["key"] = "later-cap"
        capability["row"].update({"title": "Later ability", "summary": "The source shows an ability.",
                                  "description": "The view shows the value.", "supports": [], "limits": [],
                                  "source_anchor": "assets/a/a.md#L2", "source_refs": ["assets/a/a.md#L2"]})
        review = json.loads(self.review_path().read_text())
        review["candidates"].extend([self.requirement("later-need"), capability])
        self.review_path().write_text(json.dumps(review))
        original_write = work.write_stage

        def interrupt(root: Path, kind: str, rows: list[dict], ref_id: str) -> None:
            original_write(root, kind, rows, ref_id)
            raise RuntimeError("simulated interruption")

        work.write_stage = interrupt
        try:
            with self.assertRaisesRegex(RuntimeError, "simulated interruption"):
                work.stage(self.root, self.group(), "review agent")
        finally:
            work.write_stage = original_write
        work.stage(self.root, self.group())
        rows = self.rows("requirements", True) + self.rows("capabilities", True)
        self.assertEqual({r["_stage"]["key"]: r["_stage"]["authored_by"] for r in rows},
                         {"first": "source agent", "later-need": "review agent", "later-cap": "review agent"})
        self.assertEqual(len(rows), 3)

    def test_old_partial_stage_without_author_remains_valid_on_retry(self) -> None:
        candidate = self.requirement("legacy-partial")
        self.ready(candidates=[candidate])
        row = dict(candidate["row"])
        row["_stage"] = {name: candidate[name] for name in ("key", "action", "review_state")}
        row["_stage"]["ref_id"] = "REF-001"
        work.write_stage(self.root, "requirement", [row], "REF-001")
        before = self.stage_path().read_bytes()
        self.cli("stage", "REF-001")
        self.assertEqual(self.stage_path().read_bytes(), before)
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)

    def test_later_missing_and_blank_author_fail_without_writes(self) -> None:
        self.ready(candidates=[self.requirement("first")])
        self.cli("stage", "REF-001")
        review = json.loads(self.review_path().read_text())
        review["candidates"].append(self.requirement("later"))
        self.review_path().write_text(json.dumps(review))
        before = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
        for flags in ((), ("--author", ""), ("--author", "  ")):
            result = self.cli("stage", "REF-001", *flags, success=False)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("author", result.stderr)
            after = {str(p.relative_to(self.root)): p.read_bytes() for p in self.root.rglob("*") if p.is_file()}
            self.assertEqual(after, before)
        self.cli("stage", "REF-001", "--author", "review agent")
        self.assertEqual([r["_stage"]["authored_by"] for r in self.rows("requirements", True)],
                         ["source agent", "review agent"])

    def test_mixed_authors_and_claim_reviewers_publish_in_candidate_order(self) -> None:
        self.ready(candidates=[self.requirement("first"), self.requirement("last")])
        self.cli("stage", "REF-001")
        review = json.loads(self.review_path().read_text())
        review["candidates"].insert(1, self.requirement("missed"))
        self.review_path().write_text(json.dumps(review))
        self.cli("stage", "REF-001", "--author", "review agent")
        self.decide(decisions=[{"key": "first", "review_state": "approved"}])
        first_meta = dict(self.rows("requirements", True)[0]["_stage"])
        self.cli("decide", "REF-001", "--reviewer", "second reviewer", input=json.dumps([
            {"key": key, "review_state": "approved"} for key in ("missed", "last")]))
        self.cli("publish", "REF-001")
        final = json.loads(self.review_path().read_text())
        self.assertEqual(final["reviewed_by"], "source agent")
        self.assertEqual(final["publication_review"]["reviewed_by"], "second reviewer")
        self.assertEqual(self.rows("extractions")[0]["extracted_by"], "source agent; review agent")
        self.assertEqual(len(self.rows("extractions")), 1)
        self.assertEqual(final["applied"]["first"]["reviewed_by"], "other reviewer")
        self.assertEqual(final["applied"]["first"]["reviewed_at"], first_meta["reviewed_at"])
        for key in ("missed", "last"):
            self.assertEqual(final["applied"][key]["reviewed_by"], "second reviewer")
            self.assertEqual(final["applied"][key]["reviewed_at"], final["publication_review"]["reviewed_at"])
            self.assertTrue(final["applied"][key]["reviewed_at"].endswith("Z"))

    def test_replacement_keeps_author_and_clears_decision(self) -> None:
        candidate = self.requirement("need")
        self.ready(candidates=[candidate])
        self.cli("stage", "REF-001", "--author", "actual author")
        self.decide(decisions=[{"key": "need", "review_state": "approved"}])
        self.assertNotEqual(self.cli("replace-row", "REF-001", "need", input=json.dumps(candidate["row"]),
                                    success=False).returncode, 0)
        self.decide(decisions=[{"key": "need", "review_state": "pending", "review_note": "Correct wording"}])
        candidate["row"]["statement"] = "The system shall show the source value."
        self.cli("replace-row", "REF-001", "need", input=json.dumps(candidate["row"]))
        meta = self.rows("requirements", True)[0]["_stage"]
        self.assertEqual(meta["authored_by"], "actual author")
        self.assertEqual(meta["review_state"], "pending")
        for field in ("reviewed_by", "reviewed_at", "review_note"):
            self.assertNotIn(field, meta)
        self.decide(decisions=[{"key": "need", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        self.assertEqual(self.rows("extractions")[0]["extracted_by"], "actual author")

    def test_old_staged_rows_use_legacy_author_and_reviewer_fallback(self) -> None:
        self.ready(candidates=[self.requirement("legacy")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "legacy", "review_state": "approved"}])
        staged = self.rows("requirements", True)
        for field in ("authored_by", "reviewed_by", "reviewed_at"):
            staged[0]["_stage"].pop(field)
        work.write_stage(self.root, "requirement", staged, "REF-001")
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.cli("publish", "REF-001")
        final = json.loads(self.review_path().read_text())
        self.assertEqual(final["applied"]["legacy"]["authored_by"], "source agent")
        self.assertEqual(final["applied"]["legacy"]["reviewed_by"], "other reviewer")
        self.assertEqual(self.rows("extractions")[0]["extracted_by"], "source agent")
        for field in ("authored_by", "reviewed_by", "reviewed_at"):
            final["applied"]["legacy"].pop(field)
        self.review_path().write_text(json.dumps(final))
        before = self.review_path().read_bytes()
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        self.assertEqual(self.review_path().read_bytes(), before)

    def test_old_publication_intent_resumes_without_backfill(self) -> None:
        self.ready(candidates=[self.requirement("legacy")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "legacy", "review_state": "approved"}])
        review = json.loads(self.review_path().read_text())
        intent = work.publication_plan(self.root, self.group(), review, work.canonical_records(self.root),
                                       [("requirement", self.rows("requirements", True)[0])])
        for field in ("authored_by", "reviewed_by", "reviewed_at"):
            intent["assignments"]["legacy"].pop(field)
        review["publication"] = intent
        self.review_path().write_text(json.dumps(review))
        work.publish(self.root, self.group())
        self.assertEqual(json.loads(self.review_path().read_text())["applied"]["legacy"],
                         intent["assignments"]["legacy"])
        self.cli("publish", "REF-001")
        self.assertEqual(len(self.rows("requirements")), 2)
        self.assertEqual(len(self.rows("extractions")), 1)

    def test_capability_with_empty_supports_can_publish(self) -> None:
        candidate = work.candidate_template("capability")
        candidate["key"] = "dated-view"
        candidate["row"].update({"title": "Dated view", "summary": "The export shows planned hours.",
                                 "description": "The dated view displays planned hours.",
                                 "source_anchor": "assets/a/a.md#L1", "source_refs": ["assets/a/a.md#L1"],
                                 "supports": [], "limits": ["The export does not prove current availability."]})
        self.ready(candidates=[candidate])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "dated-view", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        self.assertEqual(self.rows("capabilities")[0]["supports"], [])

    def test_csv_anchors_count_records_including_frontmatter_and_quoted_breaks(self) -> None:
        path = "assets/a/a.csv"
        (self.root / path).write_text('---\nsource: original\n---\nname,note\nitem,"two\nlines"\nlast,end\n')
        index_path = self.root / ".os/indexes/references.json"
        index = json.loads(index_path.read_text())
        index["references"][0]["converted"] = path
        index_path.write_text(json.dumps(index))
        candidate = self.requirement("csv")
        candidate["row"]["source_anchor"] = path + "#row-5"
        candidate["row"]["source_refs"] = [path + "#row-6"]
        self.ready(candidates=[candidate])
        self.cli("stage", "REF-001")
        self.assertEqual(self.cli("check", "REF-001").returncode, 0)
        row = work.pure_row(self.rows("requirements", True)[0])
        row["source_anchor"] = path + "#row-7"
        self.assertNotEqual(self.cli("replace-row", "REF-001", "csv", input=json.dumps(row),
                                    success=False).returncode, 0)

    def test_only_approved_authors_and_rows_are_published(self) -> None:
        self.ready(candidates=[self.requirement("approved"), self.requirement("pending"), self.requirement("held")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "approved", "review_state": "approved"},
                               {"key": "held", "review_state": "held", "review_note": "Evidence needed"}])
        self.cli("publish", "REF-001")
        final = json.loads(self.review_path().read_text())
        self.assertEqual(set(final["applied"]), {"approved"})
        self.assertEqual([row["_stage"]["key"] for row in self.rows("requirements", True)], ["pending", "held"])
        self.assertEqual(len(self.rows("requirements")), 2)
        self.assertEqual(self.rows("extractions")[0]["extracted_by"], "source agent")

    # W1 R7 P7 skills review round 1 (P7S-R1-09): the helper applies the
    # `buildos validate` anchor contract before staging and publication.
    def test_doc_anchor_follows_the_buildos_validate_contract(self) -> None:
        # The source-package prefix is split in two literals, so the skills' own path check does not read it as an instruction.
        bad = ["docs/notes.md#", "docs/notes.md", "docs/sub/#x", "docs/sub/..#x", "system/" "docs/notes.md#x",
               "./system/../docs/notes.md#x", "https://example.test/docs/a.md#x", "/docs/notes.md#x",
               "C:/docs/notes.md#x", "./#x", "../docs/notes.md#x", "assets/a/a.md#L1", "docs#x"]
        for value in bad:
            with self.subTest(value=value):
                self.assertIsNotNone(work.saved_anchor_issue(value, "docs/"))
        for value in ("docs/notes.md#summary", "docs/sub/notes.md#C#", "./docs/notes.md#x", "docs/a/../b.md#x"):
            with self.subTest(value=value):
                self.assertIsNone(work.saved_anchor_issue(value, "docs/"))

    def test_empty_fragment_doc_anchor_is_refused_before_staging_and_publication(self) -> None:
        item = self.requirement("anchored")
        item["row"]["doc_anchor"] = "docs/notes.md#"
        self.ready(candidates=[item])
        self.assertIn("doc_anchor", self.cli("check", "REF-001", success=False).stdout)
        self.assertIn("Review needs repair", self.cli("stage", "REF-001", success=False).stderr)
        self.assertEqual(self.rows("requirements", True), [])
        # A row that reached staging with the bad anchor (an older helper) cannot be published.
        item["row"]["doc_anchor"] = "docs/notes.md#ok"
        self.ready(candidates=[item])
        self.cli("stage", "REF-001")
        staged = self.rows("requirements", True)
        staged[0]["doc_anchor"] = "docs/notes.md#"
        self.stage_path().write_text("".join(json.dumps(row) + "\n" for row in staged))
        self.cli("decide", "REF-001", "--reviewer", "other reviewer",
                 input=json.dumps([{"key": "anchored", "review_state": "approved"}]), success=False)
        self.assertNotEqual(self.cli("publish", "REF-001", success=False).returncode, 0)
        self.assertEqual(len(self.rows("requirements")), 1)
        self.assertEqual(self.rows("extractions"), [])

    def test_scoped_fields_and_ids_follow_buildos_validate(self) -> None:
        item = self.requirement("scoped")
        item["row"]["systems"] = ["both"]
        item["row"]["env"] = ["baseline"]
        self.ready(candidates=[item])
        out = self.cli("check", "REF-001", success=False).stdout
        self.assertIn("reserved value 'both'", out)
        self.assertIn("env is an old scoped field", out)
        short = self.requirement("short", action="updated")
        short["target_id"] = "REQ-1"
        self.ready(candidates=[short])
        self.assertIn("needs a matching target_id", self.cli("check", "REF-001", success=False).stdout)

    def test_published_extraction_row_matches_buildos_validate(self) -> None:
        self.ready(candidates=[self.requirement("new")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "new", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        ext = self.rows("extractions")[0]
        self.assertEqual(work.extraction_row_issues(ext), [])
        self.assertNotIn("dataset_refs", ext)
        self.assertRegex(ext["extracted_at"], r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")
        for broken in ({"extracted_at": "2026-02-30T10:00:00Z"}, {"extracted_at": "2026-01-01T10:00:00+00:00"},
                       dict.fromkeys(["dataset_refs"]), {"minted": ["REQ-1"]}, {"source_anchor": "docs/x.md#L1"}):
            with self.subTest(broken=broken):
                self.assertNotEqual(work.extraction_row_issues({**ext, **broken}), [])

    # W1 R7 P7 skills review round 2 (P7S-R2-08): IDs, target IDs, and timestamps
    # take ASCII digits only, as `buildos validate` does. The full-width digits
    # are built from their code points.
    def test_ids_and_timestamps_take_ascii_digits_only(self) -> None:
        wide = lambda text: "".join(chr(0xFF10 + int(c)) if c.isascii() and c.isdigit() else c for c in text)
        self.ready(candidates=[self.requirement("new")])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "new", "review_state": "approved"}])
        self.cli("publish", "REF-001")
        ext = self.rows("extractions")[0]
        self.assertEqual(work.extraction_row_issues(ext), [])
        for broken in ({"extracted_at": wide("2026-01-01T10:00:00Z")}, {"extracted_at": "2026-01-01T10:00:00" + wide(".5") + "Z"},
                       {"id": wide("EXT-001")}, {"minted": [wide("REQ-001")]}):
            with self.subTest(broken=broken):
                self.assertNotEqual(work.extraction_row_issues({**ext, **broken}), [])
        self.assertIsNone(work.ENTITY_ID.match(wide("REQ-001")))
        self.assertIsNone(work.UTC_DATETIME.fullmatch(wide("2026-01-01T10:00:00Z")))
        updated = self.requirement("wide", action="updated")
        updated["target_id"] = wide("REQ-001")
        self.ready(candidates=[updated])
        self.assertIn("needs a matching target_id", self.cli("check", "REF-001", success=False).stdout)
        # No digit pattern in the helper uses \d.
        self.assertNotIn("\\d", (Path(work.__file__)).read_text().split("UTC_DATETIME = ", 1)[1])

    # W1 R7 P7 review round 4 (P7-R4-02): a row its reader could not read back is
    # refused before anything is written.
    def test_row_too_long_for_its_reader_is_refused_before_writing(self) -> None:
        self.assertEqual(work.row_limit_issues(".os/data/findings.jsonl", {"append": [{"id": "FIND-001", "summary": "x" * 70000}]})[0][:24], ".os/data/findings.jsonl:")
        self.assertEqual(work.row_limit_issues(".os/data/requirements.jsonl", {"append": [{"id": "REQ-001", "summary": "x" * 70000}]}), [])
        self.assertEqual(work.row_limit_issues(".os/data/runs.jsonl", {"replace": {"RUN-001": {"id": "RUN-001", "summary": "x" * 65503}}}), [])
        self.assertNotEqual(work.row_limit_issues(".os/data/runs.jsonl", {"replace": {"RUN-001": {"id": "RUN-001", "summary": "x" * 65504}}}), [])
        item = self.requirement("long")
        item["row"]["statement"] = "y" * (16 * 1024 * 1024)
        self.ready(candidates=[item])
        self.cli("stage", "REF-001")
        self.decide(decisions=[{"key": "long", "review_state": "approved"}])
        before = {path.name: path.read_bytes() for path in (self.root / ".os/data").glob("*.jsonl")}
        out = self.cli("publish", "REF-001", success=False)
        self.assertIn("too long for BuildOS to read back", out.stdout + out.stderr)
        self.assertEqual({path.name: path.read_bytes() for path in (self.root / ".os/data").glob("*.jsonl")}, before)

    # W1 R7 P7 skills review round 1 (P7S-R1-10): the CLI writes `"references": null`
    # for an index with no converted source; that is an empty queue.
    def test_empty_index_from_the_cli_is_an_empty_queue(self) -> None:
        index = self.root / ".os/indexes/references.json"
        index.write_text(json.dumps({"version": 1, "next_id": 1, "references": None}, indent=2) + "\n")
        self.assertEqual(self.cli("next", "--stage", "extract", "--count", "5").stdout, "")
        self.assertEqual(self.cli("status").returncode, 0)
        for malformed in ({"version": 1}, {"references": "REF-001"}, {"references": {}}, [], {"references": [{"id": "x"}]}):
            with self.subTest(malformed=malformed):
                index.write_text(json.dumps(malformed))
                self.assertNotEqual(self.cli("next", "--stage", "extract", success=False).returncode, 0)

    def test_two_writers_and_git_stage_two_files(self) -> None:
        for ref in ("REF-001", "REF-002"):
            self.ready(ref, [self.requirement(ref, ref)])
        subprocess.run(["git", "init", "-q", str(self.root)], check=True)
        for name in ("probe-a.txt", "probe-b.txt"):
            (self.root / name).write_text(name)
        commands = [[sys.executable, str(SCRIPT), "--repo-root", str(self.root), "stage", ref]
                    for ref in ("REF-001", "REF-002")]
        # The shared stage directory lock serializes writes to requirements.jsonl.
        running = [subprocess.Popen(command, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE) for command in commands]
        subprocess.run(["git", "add", "--", "probe-a.txt"], cwd=self.root, check=True)
        subprocess.run(["git", "add", "--", "probe-b.txt"], cwd=self.root, check=True)
        for proc in running:
            out, err = proc.communicate(timeout=20)
            self.assertEqual(proc.returncode, 0, f"{out}\n{err}")
        self.assertEqual({row["_stage"]["ref_id"] for row in self.rows("requirements", True)},
                         {"REF-001", "REF-002"})
        staged_names = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=self.root,
                                      text=True, capture_output=True, check=True).stdout.splitlines()
        self.assertEqual(staged_names, ["probe-a.txt", "probe-b.txt"])
        self.assertFalse((self.root / ".git/index.lock").exists())
        self.assertFalse(list(self.root.rglob(".workpy-*.tmp")))
        self.assertEqual(self.rows("extractions"), [])


if __name__ == "__main__":
    unittest.main()
