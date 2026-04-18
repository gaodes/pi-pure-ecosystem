# Update Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Revise an existing skill based on findings from all diagnostic skills, agent memory, and observed failures.
- Act as the implementation companion to `evaluate-skill`, `validate-skill`, `audit-skill`, `sync-skill-upstream`, and `optimize-skill-description`: they surface problems and opportunities, update fixes them.

Likely responsibilities:
- Read the current skill, recent agent memory cards, and any findings from:
  - `evaluate-skill` (behavioral gaps and regressions)
  - `validate-skill` (structural issues and missing required fields)
  - `audit-skill` (design-quality and convention drift)
  - `sync-skill-upstream` (upstream changes worth adopting)
  - `optimize-skill-description` (description and trigger-quality improvements)
- Generalize from specific failures instead of overfitting to one prompt or one test case.
- Recommend concrete changes to instructions, resources, structure, or error handling.
- Move repeated agent work into bundled scripts or references when the pattern is stable.
- Keep the skill lean while improving reliability.
- Output a documented update plan; implementation can be manual or assisted, but the analysis itself is the deliverable.

Anthropic imports worth carrying over:
- From `SKILL.md` / `agents/analyzer.md`: inspect transcripts, not just final outputs, to see where the skill caused wasted effort or ambiguity.
- From `SKILL.md`: keep the prompt lean; remove instructions that are not pulling their weight.
- From `SKILL.md`: explain the why behind important behaviors instead of piling on rigid MUST/NEVER language.
- From `SKILL.md`: look for repeated work across evaluations and bundle it into `scripts/` or `assets/` when the pattern is stable.
- From `agents/analyzer.md`: organize suggestions by category and impact so revisions stay concrete and prioritized.

Source inspiration:
- Anthropic `skills/skill-creator/SKILL.md` — "Improving the skill".
- Anthropic `skills/skill-creator/agents/analyzer.md`.

## Pipeline Interface

### Standalone mode
- Input: user points to an existing skill and optionally provides findings or feedback.
- Output: an update plan with concrete changes; may optionally apply them.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill to update
  - `04-reports/` — all diagnostic reports (validation, evaluation, audit, optimization, sync-review)
  - `references/AUTHORING.md` — Pi conventions to respect
- Writes:
  - `05-updates/update-plan.md` — structured update plan
  - Modified `03-skill/` files if the skill implements changes directly
- Exit state:
  - `success` — update complete, skill improved
  - `findings` — update plan produced but not fully implemented
  - `blocked` — reports are contradictory or insufficient; requires user clarification

Notes:
- Keep this separate from `create-skill`, `evaluate-skill`, `validate-skill`, `audit-skill`, `sync-skill-upstream`, and `optimize-skill-description`.
- This skill consumes output from the diagnostic/assessment skills; it does not replace them.
- It is the central implementation step that acts on findings from the entire skill quality pipeline.
- Favor updates that generalize across prompts, not fixes tuned to one demo case.
