# Optimize Description — Plan

Status: scaffold only, not implemented.

Purpose:
- Improve a skill's frontmatter description so it triggers when appropriate and stays out of near-miss cases.

Likely responsibilities:
- Generate realistic should-trigger and should-not-trigger prompts.
- Review the prompt set with the user.
- Improve the description without making it vague or misleading.
- Keep all routing guidance in the description, not the body.

Source inspiration:
- Anthropic `skills/skill-creator/SKILL.md` — "Description Optimization".

Notes:
- Keep this separate from `create-skill`.
- This can stay manual at first; automate only if repeated use justifies it.
