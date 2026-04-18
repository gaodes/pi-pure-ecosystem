# Optimize Skill Description — Plan

Status: scaffold only, not implemented.

Purpose:
- Improve a skill's frontmatter description so it triggers when appropriate and stays out of near-miss cases.

Likely responsibilities:
- Generate realistic should-trigger and should-not-trigger prompts.
- Review the prompt set with the user.
- Improve the description without making it vague or misleading.
- Keep all routing guidance in the description, not the body.
- Compare description candidates without overfitting to one small eval set.

Anthropic imports worth carrying over:
- From `SKILL.md`: use realistic, detailed, user-style trigger evals with near misses rather than obvious positives and negatives.
- From `SKILL.md`: make eval prompts substantive enough that a model would plausibly benefit from consulting a skill; tiny one-step prompts are weak trigger tests.
- From `scripts/improve_description.py`: optimize for user intent and recognizable task situations, not implementation details.
- From `scripts/improve_description.py`: make the description distinctive because it competes with other skills for model attention.
- From `scripts/improve_description.py`: if repeated attempts fail, change the structure and framing of the description, not just append more keywords.
- From `scripts/run_loop.py`: use a train/test or holdout split in any future automated loop to reduce overfitting.
- From `scripts/generate_report.py` and `assets/eval_review.html`: a lightweight review/export UI could be useful later, but should stay optional.

Source inspiration:
- Anthropic `skills/skill-creator/SKILL.md` — "Description Optimization".
- Anthropic `skills/skill-creator/scripts/improve_description.py`.
- Anthropic `skills/skill-creator/scripts/run_loop.py`.
- Anthropic `skills/skill-creator/scripts/generate_report.py`.
- Anthropic `skills/skill-creator/assets/eval_review.html`.

## Pipeline Interface

### Standalone mode
- Input: user points to an existing skill whose description needs improvement.
- Output: a proposed improved description with trigger-test rationale.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill whose description should be optimized
- Writes:
  - `04-reports/optimization.md` — proposed description, trigger tests, and rationale
- Exit state:
  - `success` — description optimized
  - `findings` — description improved but edge cases remain
  - `blocked` — skill is missing or unreadable

Notes:
- Keep this separate from `create-skill`.
- This can stay manual at first; automate only if repeated use justifies it.
- Preserve the principle of proactive but honest triggering: broaden coverage without implying behavior the skill does not actually provide.
