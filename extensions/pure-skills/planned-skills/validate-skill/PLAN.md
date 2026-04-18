# Validate Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Perform fast structural validation on a skill directory before use, packaging, or wider sharing.
- This is the lint/check step, not the behavioral evaluation step. It answers "is the skill well-formed?", not "does the skill work well?"

Likely responsibilities:
- Check that `SKILL.md` exists.
- Parse YAML frontmatter safely.
- Require `name` and `description`.
- Validate kebab-case naming and simple length limits.
- Validate optional frontmatter fields like `compatibility` without turning validation into a heavy framework.
- Optionally warn on obvious placeholder leaks or missing required sections.

Anthropic imports worth carrying over:
- From `scripts/quick_validate.py`: keep validation intentionally small, fast, and schema-focused.
- From `scripts/package_skill.py`: run validation before packaging or export-like operations.
- From `scripts/utils.py`: keep frontmatter parsing logic simple and reusable across helper scripts.
- From the overall design: favor a cheap sanity check over a complex validation ecosystem.

Source inspiration:
- Anthropic `skills/skill-creator/scripts/quick_validate.py`.
- Anthropic `skills/skill-creator/scripts/package_skill.py`.
- Anthropic `skills/skill-creator/scripts/utils.py`.

## Pipeline Interface

### Standalone mode
- Input: user points to a skill directory.
- Output: a validation report with pass/fail checks and any findings.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill to validate
- Writes:
  - `04-reports/validation.json` — structured validation report
- Exit state:
  - `success` — all checks pass
  - `findings` — checks complete, issues found
  - `blocked` — skill directory is missing or unreadable

Notes:
- Keep this lighter than the removed `validate_skill.py` system.
- This could become either a tiny helper script or a very small skill, depending on where it proves more useful.
- Do not let validation pressure force noisy boilerplate into otherwise good skills.
- This is strictly structural validation. For behavioral evaluation — running realistic prompts and judging output quality — see `evaluate-skill`. For design-quality review against best practices — see `audit-skill`.
- Distinction: `validate-skill` checks "does it compile?", `evaluate-skill` checks "does it run well?", `audit-skill` checks "is it well-designed?"
