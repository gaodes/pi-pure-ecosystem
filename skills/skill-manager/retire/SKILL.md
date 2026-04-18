---
name: retire
description: >
  Remove a skill that is obsolete, replaced, or no longer used.
disable-model-invocation: true
---

# Retire a Skill

Remove a skill that is obsolete, replaced, or no longer used.

## Workflow

1. Confirm the skill is unused — search for references in other skills, AGENTS.md, docs, and `settings.json` package filters.
2. Ask for confirmation before deleting the skill directory.
3. Remove the skill directory.
4. Update any docs that referenced it.
5. If a replacement exists, update references to point to the replacement.
6. Commit:

```bash
git commit -m "<skill-name>: retired"
```
