# Lifecycle

Skills are not static. Manage them through states.

## Locations

Skills live in three scopes — per `PATTERN-SELECTOR.md`:

| Scope | Locations |
|-------|-----------|
| Global | `~/.pi/agent/skills/`, `~/.agents/skills/` |
| Project | `.pi/skills/`, `.agents/skills/` (cwd + ancestors up to git root) |
| Extension-bundled | `extensions/<name>/skills/` — discovered via `resources_discover` hook |

Scope is assessed during planning, before scaffolding. Skills are created directly in their target location — use the `create-skill` skill or the relevant creation workflow.

Lifecycle rules apply regardless of scope.

## States

| State | Meaning |
|-------|---------|
| Active | Validated, evaluated, in use |
| Deprecated | Replaced or no longer recommended |
| Removed | Directory deleted, references cleaned up |

There is no formal state field. Track lifecycle through documentation — if a skill is deprecated, note it in its description and `AGENTS.md`.

## Promote to Extension when

A skill that accumulates enough complexity can graduate to an extension. Signals:
- The skill needs lifecycle hooks (`pi.on`).
- The agent needs custom typed tools.
- TUI components (widgets, footers, statusline segments) are required.
- Persistent state or config stores are needed.
- Slash commands with typed arguments would improve the workflow.
- Scripts in `scripts/` have grown complex enough to warrant proper tool registration.

**How to promote**: rebuild as an extension. Move the skill's logic into hooks, typed tools, or TUI components. Keep the skill's `references/` and `assets/` if they remain useful.

## Refactor when

Triggers include:
- Instructions sprawl past 300 lines in SKILL.md.
- Multiple jobs are mixed together.
- Failures repeat in one narrow area.
- The agent loads references it doesn't need for the current task.
- Tool usage has changed (new tools available, old tools removed).

## Deprecate when

- A better skill replaces it.
- The capability is now built into Pi natively.
- Nobody has used it in recent sessions.

To deprecate: note it in the skill's `description` and `AGENTS.md`. Remove the directory when no references point to it.

## Remove when

- Deprecated and no references point to it.
- The directory can be safely deleted.

Delete the directory. Update any `AGENTS.md` or project docs that referenced it.

## Maintenance

General hygiene:
- Review active skills when Pi updates — new APIs or tool changes may simplify or break them.
- Keep SKILL.md descriptions accurate — stale descriptions cause false triggers or missed loads.
- Prune unused `references/` files — dead weight wastes reads.
