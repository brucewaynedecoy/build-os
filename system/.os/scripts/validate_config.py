#!/usr/bin/env python3
"""Validate Build OS instance config and scoped frontmatter hygiene."""

from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")
SCOPED_FIELDS = ("systems", "environments", "owners")
LEGACY_SCOPED_FIELDS = ("env", "for", "envs", "target_systems")
CONTRACT_TERMS = (
    "version",
    "instance",
    "systems",
    "environments",
    "owners",
    "defaults",
    "environments[].systems",
    "defaults.systems",
    "defaults.environments",
    "defaults.owners",
)


@dataclass(frozen=True)
class SourceLine:
    indent: int
    text: str
    number: int


@dataclass
class Finding:
    path: Path
    field: str
    message: str

    def format(self, root: Path) -> str:
        try:
            rel_path = self.path.relative_to(root)
        except ValueError:
            rel_path = self.path
        return f"{rel_path}:{self.field}: {self.message}"


@dataclass(frozen=True)
class ConfigIndex:
    systems: frozenset[str]
    environments: frozenset[str]
    owners: frozenset[str]


class YamlSubsetError(ValueError):
    pass


def parse_args(argv: list[str]) -> argparse.Namespace:
    repo_root = Path(__file__).resolve().parents[3]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo-root", type=Path, default=repo_root)
    parser.add_argument("--config", type=Path, default=repo_root / "system/.os/config/instance.yaml")
    parser.add_argument("--contract", type=Path, default=repo_root / "system/.os/contracts/config-contract.md")
    parser.add_argument("--skip-frontmatter", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args(argv)


def load_yaml_subset(path: Path) -> Any:
    return parse_yaml_subset(path.read_text(encoding="utf-8"), path)


def parse_yaml_subset(text: str, path: Path) -> Any:
    lines = yaml_source_lines(text, path)
    if not lines:
        return None
    value, index = parse_block(lines, 0, lines[0].indent, path)
    if index != len(lines):
        line = lines[index]
        raise YamlSubsetError(f"{path}:{line.number}: unexpected content")
    return value


def yaml_source_lines(text: str, path: Path) -> list[SourceLine]:
    lines: list[SourceLine] = []
    for number, raw in enumerate(text.splitlines(), start=1):
        if "\t" in raw[: len(raw) - len(raw.lstrip())]:
            raise YamlSubsetError(f"{path}:{number}: tabs are not supported")
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        indent = len(raw) - len(raw.lstrip(" "))
        lines.append(SourceLine(indent=indent, text=raw.strip(), number=number))
    return lines


def parse_block(lines: list[SourceLine], index: int, indent: int, path: Path) -> tuple[Any, int]:
    if lines[index].indent != indent:
        raise YamlSubsetError(f"{path}:{lines[index].number}: expected indent {indent}")
    if lines[index].text.startswith("- "):
        return parse_sequence(lines, index, indent, path)
    return parse_mapping(lines, index, indent, path)


def parse_mapping(lines: list[SourceLine], index: int, indent: int, path: Path) -> tuple[dict[str, Any], int]:
    result: dict[str, Any] = {}
    while index < len(lines):
        line = lines[index]
        if line.indent < indent:
            break
        if line.indent > indent:
            raise YamlSubsetError(f"{path}:{line.number}: unexpected indent")
        if line.text.startswith("- "):
            break
        key, raw_value = split_key_value(line.text, path, line.number)
        if key in result:
            raise YamlSubsetError(f"{path}:{line.number}: duplicate key {key}")
        if raw_value == "":
            if index + 1 < len(lines) and lines[index + 1].indent > indent:
                value, index = parse_block(lines, index + 1, lines[index + 1].indent, path)
            else:
                value = None
                index += 1
        else:
            value = parse_scalar(raw_value)
            index += 1
        result[key] = value
    return result, index


def parse_sequence(lines: list[SourceLine], index: int, indent: int, path: Path) -> tuple[list[Any], int]:
    result: list[Any] = []
    while index < len(lines):
        line = lines[index]
        if line.indent < indent:
            break
        if line.indent > indent:
            raise YamlSubsetError(f"{path}:{line.number}: unexpected indent")
        if not line.text.startswith("- "):
            break
        item_text = line.text[2:].strip()
        if item_text == "":
            if index + 1 < len(lines) and lines[index + 1].indent > indent:
                value, index = parse_block(lines, index + 1, lines[index + 1].indent, path)
            else:
                value = None
                index += 1
            result.append(value)
            continue
        if is_inline_mapping(item_text):
            key, raw_value = split_key_value(item_text, path, line.number)
            item: dict[str, Any] = {key: parse_scalar(raw_value) if raw_value else None}
            index += 1
            if index < len(lines) and lines[index].indent > indent:
                extra, index = parse_mapping(lines, index, lines[index].indent, path)
                for extra_key, extra_value in extra.items():
                    if extra_key in item:
                        raise YamlSubsetError(f"{path}:{lines[index - 1].number}: duplicate key {extra_key}")
                    item[extra_key] = extra_value
            result.append(item)
            continue
        result.append(parse_scalar(item_text))
        index += 1
    return result, index


def is_inline_mapping(value: str) -> bool:
    return re.match(r"^[A-Za-z0-9_-]+:\s*", value) is not None


def split_key_value(text: str, path: Path, line_number: int) -> tuple[str, str]:
    if ":" not in text:
        raise YamlSubsetError(f"{path}:{line_number}: expected key/value pair")
    key, raw_value = text.split(":", 1)
    key = key.strip()
    if not key:
        raise YamlSubsetError(f"{path}:{line_number}: empty key")
    return key, raw_value.strip()


def parse_scalar(value: str) -> Any:
    value = value.strip()
    if value in ("null", "~"):
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    if value.startswith("[") and value.endswith("]"):
        inner = value[1:-1].strip()
        if not inner:
            return []
        return [parse_scalar(item.strip()) for item in inner.split(",")]
    if (value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'")):
        return value[1:-1]
    if re.match(r"^-?[0-9]+$", value):
        return int(value)
    return value


def validate_contract(contract_path: Path) -> list[Finding]:
    if not contract_path.exists():
        return [Finding(contract_path, "contract", "config contract file is missing")]
    findings: list[Finding] = []
    text = contract_path.read_text(encoding="utf-8")
    for term in CONTRACT_TERMS:
        if term not in text:
            findings.append(Finding(contract_path, "contract", f"missing contract term {term}"))
    return findings


def validate_config_file(config_path: Path) -> tuple[list[Finding], ConfigIndex]:
    try:
        data = load_yaml_subset(config_path)
    except (OSError, YamlSubsetError) as exc:
        return [Finding(config_path, "config", str(exc))], ConfigIndex(frozenset(), frozenset(), frozenset())
    return validate_config_data(data, config_path)


def validate_config_data(data: Any, path: Path) -> tuple[list[Finding], ConfigIndex]:
    findings: list[Finding] = []
    if not isinstance(data, dict):
        return [Finding(path, "config", "expected top-level mapping")], ConfigIndex(frozenset(), frozenset(), frozenset())

    if not isinstance(data.get("version"), int):
        findings.append(Finding(path, "version", "must be an integer"))

    instance = data.get("instance")
    if not isinstance(instance, dict):
        findings.append(Finding(path, "instance", "must be a mapping"))
    else:
        require_string(path, findings, instance, "instance.id")
        require_string(path, findings, instance, "instance.name")
        validate_slug(path, findings, instance.get("id"), "instance.id")

    system_ids = validate_collection(path, findings, data, "systems", ("id", "name", "description"))
    environment_ids = validate_collection(path, findings, data, "environments", ("id", "name", "systems", "description"))
    owner_ids = validate_collection(path, findings, data, "owners", ("id", "name", "kind"))

    for index, environment in enumerate(as_list(data.get("environments"))):
        if not isinstance(environment, dict):
            continue
        field = f"environments[{index}].systems"
        systems = environment.get("systems")
        if not isinstance(systems, list):
            findings.append(Finding(path, field, "must be a list of configured systems[].id values"))
            continue
        validate_references(path, findings, systems, system_ids, field)

    defaults = data.get("defaults")
    if not isinstance(defaults, dict):
        findings.append(Finding(path, "defaults", "must be a mapping"))
    else:
        validate_default_list(path, findings, defaults, "systems", system_ids)
        validate_default_list(path, findings, defaults, "environments", environment_ids)
        validate_default_list(path, findings, defaults, "owners", owner_ids)

    return findings, ConfigIndex(frozenset(system_ids), frozenset(environment_ids), frozenset(owner_ids))


def validate_collection(
    path: Path,
    findings: list[Finding],
    data: dict[str, Any],
    name: str,
    required_fields: tuple[str, ...],
) -> set[str]:
    items = data.get(name)
    ids: set[str] = set()
    if not isinstance(items, list):
        findings.append(Finding(path, name, "must be a list"))
        return ids
    seen: dict[str, int] = {}
    for index, item in enumerate(items):
        field_prefix = f"{name}[{index}]"
        if not isinstance(item, dict):
            findings.append(Finding(path, field_prefix, "must be a mapping"))
            continue
        for required in required_fields:
            if required not in item:
                findings.append(Finding(path, f"{field_prefix}.{required}", "is required"))
        item_id = item.get("id")
        if isinstance(item_id, str):
            validate_slug(path, findings, item_id, f"{field_prefix}.id")
            if item_id in seen:
                findings.append(Finding(path, f"{field_prefix}.id", f"duplicates {name}[{seen[item_id]}].id"))
            else:
                seen[item_id] = index
                ids.add(item_id)
        else:
            findings.append(Finding(path, f"{field_prefix}.id", "must be a string"))
        if name == "owners" and isinstance(item.get("kind"), str):
            validate_slug(path, findings, item["kind"], f"{field_prefix}.kind")
    return ids


def require_string(path: Path, findings: list[Finding], mapping: dict[str, Any], field: str) -> None:
    key = field.rsplit(".", 1)[-1]
    if not isinstance(mapping.get(key), str):
        findings.append(Finding(path, field, "must be a string"))


def validate_slug(path: Path, findings: list[Finding], value: Any, field: str) -> None:
    if isinstance(value, str) and not SLUG_RE.match(value):
        findings.append(Finding(path, field, "must be a stable slug: lowercase letters, digits, and hyphens"))


def validate_default_list(
    path: Path,
    findings: list[Finding],
    defaults: dict[str, Any],
    name: str,
    allowed: set[str],
) -> None:
    values = defaults.get(name)
    field = f"defaults.{name}"
    if not isinstance(values, list):
        findings.append(Finding(path, field, "must be a list"))
        return
    validate_references(path, findings, values, allowed, field)


def validate_references(
    path: Path,
    findings: list[Finding],
    values: list[Any],
    allowed: set[str],
    field: str,
) -> None:
    for index, value in enumerate(values):
        item_field = f"{field}[{index}]"
        if not isinstance(value, str):
            findings.append(Finding(path, item_field, "must be a string configured ID"))
        elif value not in allowed:
            findings.append(Finding(path, item_field, f"unknown configured ID {value!r}"))


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def validate_frontmatter(root: Path, config_index: ConfigIndex) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_scoped_markdown(root):
        frontmatter_text = extract_frontmatter(path)
        if frontmatter_text is None:
            continue
        try:
            data = parse_yaml_subset(frontmatter_text, path)
        except YamlSubsetError as exc:
            findings.append(Finding(path, "frontmatter", str(exc)))
            continue
        if not isinstance(data, dict):
            findings.append(Finding(path, "frontmatter", "must be a mapping"))
            continue
        findings.extend(validate_frontmatter_data(path, data, config_index))
    return findings


def iter_scoped_markdown(root: Path) -> list[Path]:
    paths = list((root / "system/playbooks").glob("**/*.md"))
    paths.extend((root / "system/.os/templates").glob("*playbook*.md"))
    return sorted(path for path in paths if path.is_file())


def extract_frontmatter(path: Path) -> str | None:
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None
    for index, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            return "\n".join(lines[1:index])
    return None


def validate_frontmatter_data(path: Path, data: dict[str, Any], config_index: ConfigIndex) -> list[Finding]:
    findings: list[Finding] = []
    for field in LEGACY_SCOPED_FIELDS:
        if field in data:
            findings.append(Finding(path, field, "legacy scoped field is not allowed; use systems, environments, and owners"))
    allowed_by_field = {
        "systems": config_index.systems,
        "environments": config_index.environments,
        "owners": config_index.owners,
    }
    for field in SCOPED_FIELDS:
        values = data.get(field)
        if values is None:
            findings.append(Finding(path, field, "is required for scoped frontmatter"))
            continue
        if not isinstance(values, list):
            findings.append(Finding(path, field, "must be a list"))
            continue
        validate_references(path, findings, values, set(allowed_by_field[field]), field)
    return findings


def run_self_tests() -> int:
    base_config = """
version: 1
instance:
  id: test-instance
  name: Test Instance
systems:
  - id: primary-system
    name: Primary System
    description: Test system.
environments:
  - id: baseline
    name: Baseline
    systems:
      - primary-system
    description: Test environment.
owners:
  - id: adopter-team
    name: Adopter Team
    kind: team
defaults:
  systems:
    - primary-system
  environments:
    - baseline
  owners:
    - adopter-team
"""
    cases = [
        (
            "duplicate IDs",
            base_config.replace(
                "  - id: primary-system",
                "  - id: duplicate\n    name: Duplicate\n    description: Duplicate.\n  - id: duplicate",
                1,
            ),
            "duplicates systems",
        ),
        ("invalid slug", base_config.replace("primary-system", "Primary_System", 1), "stable slug"),
        ("missing environment reference", base_config.replace("      - primary-system", "      - missing-system", 1), "unknown configured ID"),
        ("invalid default", base_config.replace("    - baseline", "    - missing-environment", 1), "unknown configured ID"),
    ]
    failures: list[str] = []
    for name, text, expected in cases:
        data = parse_yaml_subset(text, Path(f"<self-test:{name}>"))
        findings, _ = validate_config_data(data, Path(f"<self-test:{name}>"))
        formatted = "\n".join(f"{finding.field}: {finding.message}" for finding in findings)
        if expected not in formatted:
            failures.append(f"{name}: expected {expected!r}, got {formatted!r}")

    valid_data = parse_yaml_subset(base_config, Path("<self-test:valid>"))
    valid_findings, index = validate_config_data(valid_data, Path("<self-test:valid>"))
    if valid_findings:
        failures.append("valid config produced findings")

    legacy_frontmatter = {"env": "both", "for": "both", "systems": [], "environments": [], "owners": []}
    legacy_findings = validate_frontmatter_data(Path("<self-test:frontmatter>"), legacy_frontmatter, index)
    if not any(finding.field == "env" for finding in legacy_findings):
        failures.append("legacy frontmatter did not fail env")

    if failures:
        for failure in failures:
            print(failure, file=sys.stderr)
        return 1
    print("Self-tests passed")
    return 0


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    if args.self_test:
        return run_self_tests()

    root = args.repo_root.resolve()
    findings = validate_contract(args.contract)
    config_findings, config_index = validate_config_file(args.config)
    findings.extend(config_findings)
    if not args.skip_frontmatter:
        findings.extend(validate_frontmatter(root, config_index))

    if findings:
        for finding in findings:
            print(finding.format(root), file=sys.stderr)
        print(f"FAIL: {len(findings)} validation error(s)", file=sys.stderr)
        return 1
    print("OK: config and frontmatter hygiene passed")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
