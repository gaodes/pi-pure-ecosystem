# Pattern Selector

Choose the smallest architecture that solves the request.

## Decision ladder

| # | Shape | Use when |
|---|-------|----------|
| 1 | Plain prompt | Reusable text prompt, no workflow or scripts — explain to the user, no skill needed |
| 2 | Bash script or alias | One-off file manipulation, not agent behavior |
| 3 | Single skill | One stable job with repeated value |
| 4 | Bundled skills (extension) | Multiple related skills sharing scripts and references — bundle inside an extension via `resources_discover` |
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

## Bundled vs. separate skills

When multiple skills share the same domain, decide: **bundle in one extension** or **keep separate**?

| Signal | Bundled (same extension) | Separate |
|--------|--------------------------|----------|
| Triggers | Same domain, different phases | Completely different trigger conditions |
| Shared resources | Scripts, references, or templates | No shared context |
| User perception | "Part of the same thing" | "A different thing entirely" |
| Lifecycle | Released together, versioned together | Independent lifecycle |
| Example | `pure-skills` → create-skill, import-skill, evaluate-skill | `pure-skills` and `pure-git` are separate |

## When NOT to make a skill

- The request is a reusable prompt template — a simple prompt doesn't need a skill. Explain this to the user.
- A bash script or shell alias does the job — skills are for agent behavior, not file manipulation.
- The capability is better served by an extension — if it needs hooks, typed tools, or UI components, it's extension territory.

## Naming rules

Per Pi's skill spec (`docs/skills.md`): kebab-case, 1-64 chars, lowercase letters + numbers + hyphens only, no leading/trailing/consecutive hyphens. Name must match the parent directory exactly.

Pick concrete, task-focused names: `git-helpers`, `cron-sync`, `statusline-tweaks`. Avoid generic names: `helper`, `manager`, `utils`.

## Where to put skills

| Scope | Location | Use when |
|-------|----------|----------|
| Project | `.pi/skills/` | Tied to a specific repo or project workflow |
| Global | `~/.pi/agent/skills/` | Works across any project |
| Extension-bundled | `extensions/<name>/skills/` | Related skills sharing scripts and references |
