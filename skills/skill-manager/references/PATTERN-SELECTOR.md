# Pattern Selector

Choose the smallest architecture that solves the request.

## Decision ladder

| # | Shape | Use when |
|---|-------|----------|
| 1 | Plain prompt | Reusable text prompt, no workflow or scripts → defer to the prompt manager extension |
| 2 | Bash script or alias | One-off file manipulation, not agent behavior |
| 3 | Single skill | One stable job with repeated value |
| 4 | Skill bundle (sub-skills) | Same domain, multiple phases with different instructions |
| 5 | Separate skill | Unrelated job — different triggers, different purpose |
| 6 | Extension | Needs hooks, typed tools, UI components, commands, or persistent state |

Default to #2. Escalate only with reason.

## Skill vs. Extension

When the user asks for a new capability, decide early:

| Need | Build as |
|------|----------|
| Recurring instructions | Skill |
| CLI usage examples | Skill |
| Code templates | Skill |
| Domain-specific workflows | Skill |
| Lifecycle hooks (`pi.on`) | Extension |
| Custom tools for the LLM | Extension |
| TUI components (widgets, footers) | Extension |
| Persistent state / config stores | Extension |
| Slash commands with arguments | Extension |

If `bash` + instructions can do it → **Skill**. Need hooks, typed tools, or UI → **Extension**.

## Sub-skills vs. separate skills

When a skill outgrows 300 lines or mixes concerns, decide: **split into sub-skills** or **create a separate skill**?

| Signal | Sub-skill (same parent) | Separate skill |
|--------|------------------------|---------------|
| Triggers | Same domain, different phases | Completely different trigger conditions |
| Context | Shares references, scripts, or state | No shared context |
| User perception | "Part of the same thing" | "A different thing entirely" |
| Example | `git-workflow` → commit, rebase, sync sub-skills | `git-workflow` and `docker-manage` are separate skills |

**Sub-skills**: thin dispatcher SKILL.md routes to sibling directories, each with its own `SKILL.md` and frontmatter. Do not put sub-skill instructions in `references/` — references are supporting docs, not independent skills.

**Separate skills**: independent SKILL.md, independent triggers, independent lifecycle. No dispatcher needed.

## When NOT to make a skill

- The request is a reusable prompt template — defer to the prompt manager extension.
- A bash script or shell alias does the job — skills are for agent behavior, not file manipulation.
- The capability is better served by an extension — if it needs hooks, typed tools, or UI components, it's extension territory.

## Naming rules

Per Pi's skill spec (`docs/skills.md`): kebab-case, 1-64 chars, lowercase letters + numbers + hyphens only, no leading/trailing/consecutive hyphens. Name must match the parent directory exactly.

Pick concrete, task-focused names: `git-helpers`, `cron-sync`, `statusline-tweaks`. Avoid generic names: `helper`, `manager`, `utils`.

## Where to put skills

Per `references/LIFECYCLE.md` → Locations.
