# Improve an Existing Skill

Improve, refactor, harden, split, merge, or promote an existing skill.

## Workflow

### 1. Locate and diagnose

Find the skill. Search all Pi skill locations:

```bash
for dir in ~/.pi/agent/skills ~/.agents/skills .pi/skills .agents/skills skills; do
  test -d "$dir/<skill-name>" && echo "FOUND in $dir" || true
done
```

If the user gave a vague reference, check `AGENTS.md` skill indexes or ask for clarification.

Read the skill's SKILL.md and all references. Diagnose from symptoms:

| Symptom | Likely problem |
|---------|---------------|
| False triggers or missed loads | Description too broad or too narrow |
| Agent ignores instructions | SKILL.md over 300 lines — too much noise |
| Recurring failures in one area | Missing failure modes or edge-case handling |
| Agent loads references it doesn't need | Over-flat structure — split into focused references |
| Multiple unrelated jobs in one skill | Skill does two things — split it |
| Scripts growing complex | Promote to extension |

### 2. Select improvement mode

Read `references/LIFECYCLE.md` for promote/refactor/deprecate triggers.

| Mode | When to use |
|------|------------|
| **Simplify** | SKILL.md is over 300 lines. Move detail into `references/` files. |
| **Split** | Triggers and instructions diverge — the skill does two unrelated things. Create two skills, divide triggers, update references in other skills/docs. |
| **Merge** | Two skills share all triggers and context. Keep the stronger SKILL.md, absorb the other's unique content, then retire the other. |
| **Harden** | Add failure cases, tighten outputs, clarify tool usage. No structural change. |
| **Promote to extension** | Skill needs hooks, typed tools, UI, or persistent state. See `references/LIFECYCLE.md` → "Promote to Extension" for signals. Use the skill directory as the extension's foundation. |

### 3. Present plan for approval

Describe the improvement to the user:
- **Mode** selected and why
- **What changes**: which files move, which sections rewrite, what gets added or removed
- **Side effects**: other skills or docs that need updating (especially for Split and Merge)
- **Risk**: what could break

Do not proceed until the user approves.

### 4. Apply the improvement

Read `references/AUTHORING.md` for content patterns when rewriting instructions.

For **Split**: create the new skill via the Create workflow, then update the original skill to remove the split-out concerns.

For **Merge**: absorb the weaker skill's unique content into the stronger one, then retire the weaker skill via the Retire workflow.

For **Promote**: use the skill directory as the extension's foundation. Move logic from SKILL.md into `index.ts`. Scripts become internal utilities. References become extension docs.

### 5. Re-validate and re-evaluate

```bash
scripts/validate_skill.py <skill-path>
```

Quick evaluation — write 5-10 prompts that should trigger + 5 that should not. For structural changes (Split, Merge), evaluate both skills.

### 6. Commit

```text
<skill-name>: <mode> — <summary>
```

If the improvement affected other skills or docs, commit those changes together or in a follow-up.
