---
name: self-evolve
description: >
  Review and improve managed skills through portfolio audit or targeted improvement.
disable-model-invocation: true
---

# Self-Evolve

Review and improve managed skills using one of two modes.

## Modes

- **Audit** — portfolio review across managed skills. Read `../references/SELF-AUDIT.md` and follow it.
- **Improve** — targeted improvement of one specific skill.

If the user asks for self-evolve without naming a mode, ask whether they want **audit** or **improve**.

## Improve Workflow

1. Read the target skill's SKILL.md and all its resources.
2. Review git history for the skill — recent fixes, recurring issues, user corrections.
3. Identify improvement opportunities:
   - **Hardening** — add failure modes, edge cases, or gotchas discovered through use.
   - **Simplification** — remove instructions that the agent consistently ignores or handles correctly without guidance.
   - **Restructuring** — move content between SKILL.md and references based on actual loading patterns.
   - **Description tuning** — adjust the description based on observed false positives or missed triggers.
   - **Script improvements** — tighten scripts, add error handling, improve output formatting.
4. Present proposed changes with rationale.
5. Apply approved changes. Re-validate and re-evaluate.
6. Commit:

```text
<skill-name>: self-improve — <summary of changes>
```
