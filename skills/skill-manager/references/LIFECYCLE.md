# Lifecycle

Skills are not static. Manage them through states.

## States

| State | Meaning |
|-------|---------|
| Draft | Scaffolded, not yet validated or evaluated |
| Active | Validated, evaluated, in use |
| Deprecated | Replaced or no longer recommended |
| Removed | Directory deleted, references cleaned up |

There is no formal state field. Track lifecycle through documentation — if a skill is deprecated, note it in its description and AGENTS.md.

## Promote to Active when

- Purpose is clear and scoped.
- Passes validation checklist.
- Eval cases pass (happy paths succeed, failure modes behave correctly).
- Referenced in the project's AGENTS.md or skill index.

## Promote to Extension when

A skill that accumulates enough complexity can graduate to an extension. Signals:
- The skill needs lifecycle hooks (`pi.on`).
- The agent needs custom typed tools.
- TUI components (widgets, footers, statusline segments) are required.
- Persistent state or config stores are needed.
- Slash commands with typed arguments would improve the workflow.
- Scripts in `scripts/` have grown complex enough to warrant proper tool registration.

**How to promote**: use the skill directory as the extension's foundation. Move logic from SKILL.md instructions into `index.ts`. Scripts become internal utilities. The skill's references become extension docs.

## Refactor when

- Instructions sprawl past 300 lines in SKILL.md.
- Multiple jobs are mixed together.
- Failures repeat in one narrow area.
- The agent loads references it doesn't need for the current task.
- Tool usage has changed (new tools available, old tools removed).

## Deprecate when

- A better skill replaces it.
- The capability is now built into Pi natively.
- Nobody has used it in recent sessions.

## Remove when

- Deprecated and no references point to it.
- The directory can be safely deleted.

## Maintenance hygiene

- Review active skills when Pi updates — new APIs or tool changes may simplify or break them.
- Keep SKILL.md descriptions accurate — stale descriptions cause false triggers or missed loads.
- Prune unused references/ files — dead weight wastes reads.
