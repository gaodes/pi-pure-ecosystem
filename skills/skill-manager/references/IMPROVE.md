# Improve an Existing Skill

Improve, refactor, harden, split, merge, or promote an existing skill.

## Workflow

1. Read `references/LIFECYCLE.md` for promote/refactor/deprecate triggers.
2. Read `references/AUTHORING.md` for content patterns when rewriting instructions.
3. Identify the improvement mode:
   - **Simplify**: move detail from SKILL.md into references.
   - **Split**: one skill becomes two when triggers and instructions diverge.
   - **Merge**: two skills become one when they share all triggers and context.
   - **Harden**: add failure cases, tighten outputs, clarify tool usage.
   - **Promote to extension**: when the skill needs hooks, typed tools, UI, or persistent state, use the skill directory as the foundation for an extension.
4. Apply the approved refactoring.
5. Re-validate and re-evaluate.
6. Commit with a descriptive message — git history is the skill's change log:

```text
<skill-name>: <action> — <summary>
```
