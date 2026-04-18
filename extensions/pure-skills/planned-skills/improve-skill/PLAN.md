# Improve Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Revise an existing skill based on user feedback, observed failures, and repeated agent mistakes.

Likely responsibilities:
- Read the current skill and recent feedback.
- Generalize from specific failures instead of overfitting to one prompt.
- Move repeated agent work into bundled scripts or references when justified.
- Keep the skill lean while improving reliability.

Source inspiration:
- Anthropic `skills/skill-creator/SKILL.md` — "Improving the skill".

Notes:
- Keep this separate from `create-skill`.
- Coordinate with a future evaluate skill, but do not bundle them together unless usage proves they belong together.
