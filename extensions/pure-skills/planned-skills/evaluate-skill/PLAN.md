# Evaluate Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Run lightweight qualitative and structured evaluation for a skill after creation or revision.
- Start with realistic prompts and manual review before any heavier benchmarking.
- This is the behavioral evaluation step, not the structural validation step. It answers "does the skill work well?", not "is the skill well-formed?"

Likely responsibilities:
- Collect 2-3 realistic prompts for a skill.
- Organize simple evaluation artifacts.
- Compare outputs against success criteria.
- Surface obvious gaps, regressions, and repeated failure modes.
- Critique the evals themselves when they are weak, superficial, or non-discriminating.

Anthropic imports worth carrying over:
- From `SKILL.md` / `agents/grader.md`: evaluate not just outputs, but whether the expectations actually measure meaningful success.
- From `agents/grader.md`: treat superficial pass conditions as failures in spirit; prefer assertions that are hard to satisfy without doing the real work.
- From `agents/analyzer.md`: surface patterns, variance, and repeated failure modes separately from improvement recommendations.
- From `references/schemas.md`: keep any future result format structured enough to capture evidence, pass/fail summary, and optional eval-quality feedback.
- From the broader workflow: use realistic user-style prompts, not sterile toy examples.

Source inspiration:
- Anthropic `skills/skill-creator/SKILL.md` — "Test Cases" and the evaluation loop.
- Anthropic `skills/skill-creator/agents/grader.md`.
- Anthropic `skills/skill-creator/agents/analyzer.md`.
- Anthropic `skills/skill-creator/references/schemas.md`.

## Pipeline Interface

### Standalone mode
- Input: user points to an existing skill.
- Output: an evaluation report with tested prompts, observed behavior, and gap analysis.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill to evaluate
- Writes:
  - `04-reports/evaluation.md` — narrative evaluation report
- Exit state:
  - `success` — evaluation complete, skill performs well
  - `findings` — evaluation complete, gaps or regressions found
  - `blocked` — skill is missing or unreadable

Notes:
- Keep this separate from `create-skill`.
- Keep it lighter than Anthropic's full benchmarking workflow unless real usage demands more.
- Prefer manual review plus structured notes before adding blind comparison or benchmark aggregation.
- This is strictly behavioral evaluation. For structural validation — checking frontmatter, file presence, naming conventions — see `validate-skill`. For design-quality review against best practices — see `audit-skill`.
- Distinction: `validate-skill` checks "does it compile?", `evaluate-skill` checks "does it run well?", `audit-skill` checks "is it well-designed?"
