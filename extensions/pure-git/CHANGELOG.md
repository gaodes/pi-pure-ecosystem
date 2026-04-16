# Changelog

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
