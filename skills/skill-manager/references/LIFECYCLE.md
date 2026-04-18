# Lifecycle

Skills are not static. Manage them through states.

## Locations

Skills live in one of two scopes — per `references/PATTERN-SELECTOR.md`:

| Scope | Locations |
|-------|-----------|
| Global | `~/.pi/agent/skills/`, `~/.agents/skills/` |
| Project | `.pi/skills/`, `.agents/skills/` (cwd + ancestors up to git root) |

Lifecycle rules apply regardless of scope.

## States

| State | Meaning |
|-------|---------|
| Draft | Scaffolded, not yet validated or evaluated |
| Active | Validated, evaluated, in use |
| Deprecated | Replaced or no longer recommended |
| Removed | Directory deleted, references cleaned up |

There is no formal state field. Track lifecycle through documentation — if a skill is deprecated, note it in its description and `AGENTS.md`.

## Promote to Active when

A Draft becomes Active through the Create or Import workflows — see `references/CREATE.md` or `references/IMPORT.md`. A skill is Active when:

- Purpose is clear and scoped.
- Passes validation (`scripts/validate_skill.py`).
- Eval cases pass (happy paths succeed, failure modes behave correctly).
- Referenced in the project's `AGENTS.md` or skill index.

## Promote to Extension when

A skill that accumulates enough complexity can graduate to an extension. Signals:
- The skill needs lifecycle hooks (`pi.on`).
- The agent needs custom typed tools.
- TUI components (widgets, footers, statusline segments) are required.
- Persistent state or config stores are needed.
- Slash commands with typed arguments would improve the workflow.
- Scripts in `scripts/` have grown complex enough to warrant proper tool registration.

**How to promote**: see `references/IMPROVE.md` → "Promote to extension" mode.

## Refactor when

See `references/IMPROVE.md` → diagnosis table for symptoms and mode selection. Triggers include:
- Instructions sprawl past 300 lines in SKILL.md.
- Multiple jobs are mixed together.
- Failures repeat in one narrow area.
- The agent loads references it doesn't need for the current task.
- Tool usage has changed (new tools available, old tools removed).

## Deprecate when

- A better skill replaces it.
- The capability is now built into Pi natively.
- Nobody has used it in recent sessions.

To deprecate: note it in the skill's `description` and `AGENTS.md`, then follow `references/RETIRE.md` when ready to remove.

## Remove when

- Deprecated and no references point to it.
- The directory can be safely deleted.

Follow `references/RETIRE.md`.

## Maintenance

For periodic reviews, use one of:
- **Portfolio audit** → `references/SELF-AUDIT.md` — structured review across all managed skills.
- **Targeted improvement** → `references/SELF-EVOLVE.md` (Improve mode) — single skill review based on git history and usage patterns.

General hygiene:
- Review active skills when Pi updates — new APIs or tool changes may simplify or break them.
- Keep SKILL.md descriptions accurate — stale descriptions cause false triggers or missed loads.
- Prune unused `references/` files — dead weight wastes reads.
