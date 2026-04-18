#!/usr/bin/env python3
"""
Skill Packager - Creates a distributable .skill file from a skill folder.

Validates first, then creates a zip archive with .skill extension.

Usage:
    package_skill.py <path/to/skill-folder> [output-directory]

Examples:
    package_skill.py skills/my-skill
    package_skill.py skills/my-skill ./dist

Adapted from 0xKobold's skill-creator (MIT License).
"""

import sys
import zipfile
from pathlib import Path

# Import validator from sibling script
sys.path.insert(0, str(Path(__file__).parent))
from validate_skill import validate_skill


def package_skill(skill_path, output_dir=None):
    skill_path = Path(skill_path).resolve()

    if not skill_path.exists():
        print(f"[ERROR] Skill folder not found: {skill_path}")
        return None

    if not skill_path.is_dir():
        print(f"[ERROR] Path is not a directory: {skill_path}")
        return None

    # Validate first
    print("Validating skill...")
    valid, message = validate_skill(skill_path)
    if not valid:
        print(f"[ERROR] Validation failed: {message}")
        print("   Fix validation errors before packaging.")
        return None
    print(f"[OK] {message}\n")

    # Determine output location
    skill_name = skill_path.name
    if output_dir:
        output_path = Path(output_dir).resolve()
        output_path.mkdir(parents=True, exist_ok=True)
    else:
        output_path = Path.cwd()

    skill_filename = output_path / f"{skill_name}.skill"

    # Create the .skill file (zip format)
    try:
        with zipfile.ZipFile(skill_filename, "w", zipfile.ZIP_DEFLATED) as zipf:
            for file_path in skill_path.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(skill_path.parent)
                    zipf.write(file_path, arcname)
                    print(f"  Added: {arcname}")

        print(f"\n[OK] Packaged to: {skill_filename}")
        return skill_filename

    except Exception as e:
        print(f"[ERROR] Error creating .skill file: {e}")
        return None


def main():
    if len(sys.argv) < 2:
        print("Usage: python package_skill.py <path/to/skill-folder> [output-directory]")
        print("\nExamples:")
        print("  python package_skill.py skills/my-skill")
        print("  python package_skill.py skills/my-skill ./dist")
        sys.exit(1)

    skill_path = sys.argv[1]
    output_dir = sys.argv[2] if len(sys.argv) > 2 else None

    print(f"Packaging skill: {skill_path}")
    if output_dir:
        print(f"   Output: {output_dir}")
    print()

    result = package_skill(skill_path, output_dir)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
