#!/usr/bin/env python3
"""
Skill Initializer - Creates a new skill from template

Usage:
    init_skill.py <skill-name> --path <path> [--resources scripts,references,assets] [--examples]

Examples:
    init_skill.py my-new-skill --path skills
    init_skill.py my-new-skill --path skills --resources scripts,references
    init_skill.py my-api-helper --path skills --resources scripts --examples

Adapted from 0xKobold's skill-creator (MIT License).
"""

import argparse
import re
import sys
from pathlib import Path

MAX_SKILL_NAME_LENGTH = 64
ALLOWED_RESOURCES = {"scripts", "references", "assets"}

# Resolve the template file relative to this script's location
TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "assets" / "templates" / "SKILL.template.md"


def load_template():
    """Load SKILL.template.md and return its content."""
    if not TEMPLATE_PATH.exists():
        print(f"[ERROR] Template not found: {TEMPLATE_PATH}")
        print("   Expected assets/templates/SKILL.template.md relative to the skill root.")
        sys.exit(1)
    return TEMPLATE_PATH.read_text()


def render_template(template_text, skill_name, skill_title):
    """Render the mustache-style template with skill-specific values.

    Replaces {{placeholders}} with formatted defaults.
    Double braces that aren't recognized are left as-is (for manual fill-in).
    """
    known = {
        "skill_name": skill_name,
        "skill_title": skill_title,
    }
    result = template_text
    for key, value in known.items():
        result = result.replace("{{" + key + "}}", value)
    return result


def normalize_skill_name(skill_name):
    """Normalize a skill name to lowercase hyphen-case."""
    normalized = skill_name.strip().lower()
    normalized = re.sub(r"[^a-z0-9]+", "-", normalized)
    normalized = normalized.strip("-")
    normalized = re.sub(r"-{2,}", "-", normalized)
    return normalized


def title_case_skill_name(skill_name):
    """Convert hyphenated skill name to Title Case for display."""
    return " ".join(word.capitalize() for word in skill_name.split("-"))


def parse_resources(raw_resources):
    if not raw_resources:
        return []
    resources = [item.strip() for item in raw_resources.split(",") if item.strip()]
    invalid = sorted({item for item in resources if item not in ALLOWED_RESOURCES})
    if invalid:
        allowed = ", ".join(sorted(ALLOWED_RESOURCES))
        print(f"[ERROR] Unknown resource type(s): {', '.join(invalid)}")
        print(f"   Allowed: {allowed}")
        sys.exit(1)
    deduped = []
    seen = set()
    for resource in resources:
        if resource not in seen:
            deduped.append(resource)
            seen.add(resource)
    return deduped


EXAMPLE_SCRIPT = '''#!/usr/bin/env python3
"""
Example helper script for {skill_name}

Replace with actual implementation or delete if not needed.
"""


def main():
    print("Placeholder for {skill_name}")


if __name__ == "__main__":
    main()
'''

EXAMPLE_REFERENCE = """# Reference Documentation for {skill_title}

Replace with actual reference content or delete if not needed.
"""

EXAMPLE_ASSET = """# Example Asset

Replace with actual asset files (templates, images, etc.) or delete if not needed.
"""


def create_resource_dirs(skill_dir, skill_name, skill_title, resources, include_examples):
    for resource in resources:
        resource_dir = skill_dir / resource
        resource_dir.mkdir(exist_ok=True)
        if resource == "scripts":
            if include_examples:
                example_script = resource_dir / "example.py"
                example_script.write_text(EXAMPLE_SCRIPT.format(skill_name=skill_name))
                example_script.chmod(0o755)
                print("[OK] Created scripts/example.py")
            else:
                print("[OK] Created scripts/")
        elif resource == "references":
            if include_examples:
                example_reference = resource_dir / "api_reference.md"
                example_reference.write_text(
                    EXAMPLE_REFERENCE.format(skill_title=skill_title)
                )
                print("[OK] Created references/api_reference.md")
            else:
                print("[OK] Created references/")
        elif resource == "assets":
            if include_examples:
                example_asset = resource_dir / "example_asset.txt"
                example_asset.write_text(EXAMPLE_ASSET)
                print("[OK] Created assets/example_asset.txt")
            else:
                print("[OK] Created assets/")


def init_skill(skill_name, path, resources, include_examples):
    skill_dir = Path(path).resolve() / skill_name

    if skill_dir.exists():
        print(f"[ERROR] Skill directory already exists: {skill_dir}")
        return None

    try:
        skill_dir.mkdir(parents=True, exist_ok=False)
        print(f"[OK] Created skill directory: {skill_dir}")
    except Exception as e:
        print(f"[ERROR] Error creating directory: {e}")
        return None

    # Load and render the template
    skill_title = title_case_skill_name(skill_name)
    template_text = load_template()
    skill_content = render_template(template_text, skill_name, skill_title)

    skill_md_path = skill_dir / "SKILL.md"
    try:
        skill_md_path.write_text(skill_content)
        print("[OK] Created SKILL.md (from template)")
    except Exception as e:
        print(f"[ERROR] Error creating SKILL.md: {e}")
        return None

    if resources:
        try:
            create_resource_dirs(
                skill_dir, skill_name, skill_title, resources, include_examples
            )
        except Exception as e:
            print(f"[ERROR] Error creating resource directories: {e}")
            return None

    print(f"\n[OK] Skill '{skill_name}' initialized at {skill_dir}")
    print("\nNext steps:")
    print("1. Edit SKILL.md — fill in the {{PLACEHOLDER}} values and update the description")
    if resources:
        if include_examples:
            print("2. Customize or delete example files in resource directories")
        else:
            print("2. Add resources as needed")
    else:
        print("2. Create resource directories only if needed")
    print("3. Run validate_skill.py when ready to check the skill structure")

    return skill_dir


def main():
    parser = argparse.ArgumentParser(
        description="Create a new skill directory with a SKILL.md template.",
    )
    parser.add_argument("skill_name", help="Skill name (normalized to hyphen-case)")
    parser.add_argument("--path", required=True, help="Output directory for the skill")
    parser.add_argument(
        "--resources",
        default="",
        help="Comma-separated list: scripts,references,assets",
    )
    parser.add_argument(
        "--examples",
        action="store_true",
        help="Create example files inside the selected resource directories",
    )
    args = parser.parse_args()

    raw_skill_name = args.skill_name
    skill_name = normalize_skill_name(raw_skill_name)
    if not skill_name:
        print("[ERROR] Skill name must include at least one letter or digit.")
        sys.exit(1)
    if len(skill_name) > MAX_SKILL_NAME_LENGTH:
        print(
            f"[ERROR] Skill name '{skill_name}' is too long ({len(skill_name)} characters). "
            f"Maximum is {MAX_SKILL_NAME_LENGTH} characters."
        )
        sys.exit(1)
    if skill_name != raw_skill_name:
        print(f"Note: Normalized skill name from '{raw_skill_name}' to '{skill_name}'.")

    resources = parse_resources(args.resources)
    if args.examples and not resources:
        print("[ERROR] --examples requires --resources to be set.")
        sys.exit(1)

    path = args.path

    print(f"Initializing skill: {skill_name}")
    print(f"   Location: {path}")
    if resources:
        print(f"   Resources: {', '.join(resources)}")
        if args.examples:
            print("   Examples: enabled")
    else:
        print("   Resources: none (create as needed)")
    print()

    result = init_skill(skill_name, path, resources, args.examples)

    if result:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    main()
