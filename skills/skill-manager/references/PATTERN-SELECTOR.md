# Pattern Selector

Choose the smallest architecture that solves the request.

## Decision ladder

| # | Shape | Use when |
|---|-------|----------|
| 1 | Plain prompt or bash script | One-off, not reusable, no special context needed |
| 2 | Single skill | One stable job with repeated value |
| 3 | Skill bundle (sub-skills) | Work separates into distinct phases with different instructions |
| 4 | Extension | Needs hooks, typed tools, UI components, commands, or persistent state |

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

## When to pick a single skill

- One dominant job.
- Stable context across invocations.
- Instructions fit under 300 lines with references absorbing the rest.
- The agent uses the same tools throughout.

## When to split into sub-skills

- SKILL.md grows past 300 lines because multiple jobs are mixed in.
- Different steps need different reference files loaded.
- Failures cluster in one phase, suggesting a clean boundary.
- The phases have distinct trigger conditions.

**How to split**: keep a thin dispatcher SKILL.md that routes to sub-skills. Each sub-skill is a sibling directory with its own `SKILL.md` and frontmatter — the dispatcher loads the right one based on the task. Do not put sub-skill instructions in `references/` files — references are supporting docs, not independent skills.

## When NOT to make a skill

- The task is a one-off — just instruct the agent directly.
- A bash script or shell alias does the job — skills are for agent behavior, not file manipulation.
- The capability is better served by an extension — if it needs hooks, typed tools, or UI components, it's extension territory.

## Naming rules

Per Pi's skill spec (`docs/skills.md`): kebab-case, 1-64 chars, lowercase letters + numbers + hyphens only, no leading/trailing/consecutive hyphens. Name must match the parent directory exactly.

Pick concrete, task-focused names: `git-helpers`, `cron-sync`, `statusline-tweaks`. Avoid generic names: `helper`, `manager`, `utils`.

## Where to put skills

Per `references/LIFECYCLE.md` → Locations.
