# Audit Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Run a quality review of an existing skill against best-practice guidelines, distinct from structural validation and behavioral evaluation.
- This is the expert-review step: it answers "is this skill well-designed and well-written?"

Likely responsibilities:
- Review the skill description for clarity, trigger quality, and appropriate scope.
- Check instructions against `references/AUTHORING.md` and Pi conventions.
- Verify resource completeness: are all referenced files present and useful?
- Surface opportunities to simplify, clarify, or restructure.
- Check for drift from established patterns in the pure-skills ecosystem.
- Produce a documented audit report with prioritized findings.

## Pipeline Interface

### Standalone mode
- Input: user points to an existing skill.
- Output: an audit report with prioritized findings.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill to audit
  - `references/AUTHORING.md` — Pi conventions to check against
- Writes:
  - `04-reports/audit.md` — structured audit report
- Exit state:
  - `success` — audit complete, findings documented
  - `findings` — audit complete, non-critical issues found
  - `blocked` — skill is missing or unreadable

Notes:
- Keep this separate from `validate-skill` (structure) and `evaluate-skill` (behavior).
- Output is a documented audit report; implementation of fixes is delegated to `update-skill`.
- Prefer concrete, actionable feedback over vague style opinions.
- Distinction: `validate-skill` checks "does it compile?", `evaluate-skill` checks "does it run well?", `audit-skill` checks "is it well-designed?"
