# Changelog

## 0.4.0 (2026-04-16)

- **`switch_worktree` tool** — AI-callable tool to programmatically switch Pi sessions to a worktree
- `/worktrees switch <name>` — Non-interactive subcommand for session switching
- Extracted shared `switchToWorktree()` logic used by browser, subcommand, and tool
- Browser switch action now uses shared logic (runs onSwitch hook, finds session, switches)

## 0.3.0 (2026-04-16)

- **Lifecycle hooks**: `onCreate`, `onSwitch`, `onBeforeRemove` — configurable commands that run automatically during worktree operations
- **Template variables**: `{{path}}`, `{{name}}`, `{{branch}}`, `{{project}}`, `{{mainWorktree}}`, `{{prompt}}`
- **Per-repo configuration**: `pure-git.json` with project-overrides-global resolution
- **Branch name generator**: spawns `pi` subprocess to generate branch names (creates a session you can switch to)
- `/worktrees status` — Show current worktree info (project, branch, isWorktree, hooks)
- `/worktrees cd <name>` — Print path to worktree
- `/worktrees prune` — Clean up stale worktree references with dry-run preview
- Browser: `onSwitch` hook runs on switch, `onBeforeRemove` blocks removal on failure
- `onBeforeRemove` is blocking — non-zero exit prevents worktree removal
- Hook commands accept string or string[] (run sequentially, stop on first failure)

## 0.2.0 (2026-04-16)

- Interactive worktree browser (invoked with bare `/worktrees`)
- Switch worktrees via `ctx.switchSession()` — resumes existing sessions
- Browser keybindings: `c` create, `d` delete, `m` merge, `x` merge+delete
- `/worktrees clean` now offers three options: merge+delete, merge only, delete only
- `/worktrees ls` alias for list

## 0.1.0 (2026-04-16)

- Initial release
- `/worktrees create <name> [base]` — Create branch + worktree in `.worktrees/<name>/`
- `/worktrees list` — List all worktrees with status
- `/worktrees clean <name>` — Merge to main, remove worktree, delete branch, push
