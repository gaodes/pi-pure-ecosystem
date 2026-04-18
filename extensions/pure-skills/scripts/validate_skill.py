#!/usr/bin/env python3
"""
Quick validation script for skills.

Checks YAML frontmatter, naming conventions, and description quality.

Usage:
    validate_skill.py <skill-directory>

Adapted from 0xKobold's skill-creator (MIT License).
"""

import json
import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    yaml = None

MAX_SKILL_NAME_LENGTH = 64
MAX_DESCRIPTION_LENGTH = 1024


def validate_skill(skill_path):
    """Validate a skill directory. Returns (valid: bool, message: str)."""
    skill_path = Path(skill_path)

    # Check SKILL.md exists
    skill_md = skill_path / "SKILL.md"
    if not skill_md.exists():
        return False, "SKILL.md not found"

    content = skill_md.read_text()
    if not content.startswith("---"):
        return False, "No YAML frontmatter found"

    # Extract frontmatter
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return False, "Invalid frontmatter format"

    frontmatter_text = match.group(1)

    # Parse YAML
    if yaml:
        try:
            frontmatter = yaml.safe_load(frontmatter_text)
            if not isinstance(frontmatter, dict):
                return False, "Frontmatter must be a YAML dictionary"
        except yaml.YAMLError as e:
            return False, f"Invalid YAML in frontmatter: {e}"
    else:
        # Fallback: simple regex parsing without pyyaml
        frontmatter = {}
        for line in frontmatter_text.split("\n"):
            m = re.match(r"^(\w[\w-]*):\s*(.+)$", line)
            if m:
                frontmatter[m.group(1)] = m.group(2).strip()

    # Check required fields
    if "name" not in frontmatter:
        return False, "Missing 'name' in frontmatter"
    if "description" not in frontmatter:
        return False, "Missing 'description' in frontmatter"

    # Validate name
    name = frontmatter.get("name", "")
    if not isinstance(name, str):
        return False, f"Name must be a string, got {type(name).__name__}"
    name = name.strip()
    if name:
        if not re.match(r"^[a-z0-9-]+$", name):
            return (
                False,
                f"Name '{name}' should be hyphen-case (lowercase letters, digits, and hyphens only)",
            )
        if name.startswith("-") or name.endswith("-") or "--" in name:
            return (
                False,
                f"Name '{name}' cannot start/end with hyphen or contain consecutive hyphens",
            )
        if len(name) > MAX_SKILL_NAME_LENGTH:
            return (
                False,
                f"Name is too long ({len(name)} characters). "
                f"Maximum is {MAX_SKILL_NAME_LENGTH} characters.",
            )
        # Check name matches directory
        if name != skill_path.name:
            return (
                False,
                f"Name '{name}' does not match directory name '{skill_path.name}'",
            )

    # Validate description
    description = frontmatter.get("description", "")
    if not isinstance(description, str):
        return False, f"Description must be a string, got {type(description).__name__}"
    description = description.strip()
    if not description:
        return False, "Description cannot be empty"
    if len(description) > MAX_DESCRIPTION_LENGTH:
        return (
            False,
            f"Description is too long ({len(description)} characters). "
            f"Maximum is {MAX_DESCRIPTION_LENGTH} characters.",
        )

    # Check for unresolved placeholders
    if "[TODO" in content:
        return False, "SKILL.md contains unresolved TODO placeholders"
    if "{{" in content and "}}" in content:
        return False, "SKILL.md contains unresolved {{PLACEHOLDER}} values — fill them in before validating"

    # Validate .upstream.json if present
    upstream_path = skill_path / ".upstream.json"
    if upstream_path.exists():
        upstream_content = upstream_path.read_text().strip()
        if "{{" in upstream_content and "}}" in upstream_content:
            return False, ".upstream.json contains unresolved {{PLACEHOLDER}} values — fill them in or remove the file"
        try:
            upstream = json.loads(upstream_content)
        except json.JSONDecodeError as e:
            return False, f"Invalid JSON in .upstream.json: {e}"
        if not isinstance(upstream, dict):
            return False, ".upstream.json must contain a JSON object"
        if "primary" in upstream and not isinstance(upstream["primary"], dict):
            return False, "'.upstream.json.primary' must be an object"
        if "sources" in upstream and not isinstance(upstream["sources"], list):
            return False, "'.upstream.json.sources' must be an array"
        if "cliTools" in upstream and not isinstance(upstream["cliTools"], list):
            return False, "'.upstream.json.cliTools' must be an array"

    # Check required sections
    required_sections = [
        "## How to use this skill",
        "## Inputs",
        "## Outputs",
        "## Limits",
        "## References",
    ]
    for section in required_sections:
        if section not in content:
            return False, f"SKILL.md missing required section: {section}"

    # Workflow section or equivalent dispatch table
    if "## Workflow" not in content and "## Dispatch" not in content:
        return (
            False,
            "SKILL.md missing required section: ## Workflow (or ## Dispatch for skills with multiple modes)",
        )

    # Check line count
    lines = content.splitlines()
    if len(lines) > 300:
        return (
            False,
            f"SKILL.md is too long ({len(lines)} lines). Maximum is 300 lines. "
            "Move detail into references/.",
        )

    # Validate compatibility field format if present
    compatibility = frontmatter.get("compatibility", "")
    if compatibility:
        if not isinstance(compatibility, str):
            return False, "'compatibility' must be a string"
        compat_str = compatibility.strip()
        if len(compat_str) > 500:
            return (
                False,
                f"'compatibility' is too long ({len(compat_str)} chars). "
                "Maximum is 500 chars. Use compact format: 'CLI: git>=2.40, python3>=3.10'",
            )
        # Extract CLI tools from compatibility string
        cli_tools = []
        if "CLI:" in compat_str:
            cli_part = compat_str.split("CLI:", 1)[1].strip()
            for item in cli_part.split(","):
                item = item.strip()
                if not item:
                    continue
                # Parse "tool>=version" or "tool" or "tool=version"
                m = re.match(r'^([a-zA-Z0-9_-]+)(?:([>=<]+)(.+))?$', item)
                if m:
                    cli_tools.append({
                        "name": m.group(1),
                        "constraint": m.group(2) or "",
                        "version": m.group(3) or "",
                    })
        if cli_tools:
            tool_names = ", ".join(t["name"] for t in cli_tools)
            return True, f"Skill is valid! CLI tools documented: {tool_names}"

    return True, "Skill is valid!"


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python validate_skill.py <skill_directory>")
        sys.exit(1)

    valid, message = validate_skill(sys.argv[1])
    print(message)
    sys.exit(0 if valid else 1)
