# pure-git — Future Improvements

Planned enhancements for future versions, inspired by evaluated Pi Git extensions.

## Phase 2: Commit Commands

Port patterns from `qualiti/pi-git-commands-extension`:

- `/git commit [hint]` — AI-powered commit message generation using `pi.exec()` + `complete()`
- `/git push` — Smart push with conflict detection
- `/git commit-pr [hint]` — Auto-commit, push, create PR via `gh`
- Reference: repo analysis of recent commit style, session history for context

## Phase 3: Visualization & History

- **Git graph** — ASCII commit graph with branch topology, contributor stats (from `@artale/pi-git-graph`)
- **Changelog generation** — Auto-generate from git history + conventional commits (from `@artale/pi-changelog`)

## Phase 4: Hooks & Automation

- **Git hooks manager** — Install pre-commit, commit-msg, pre-push hooks from templates (from `@artale/pi-git-hooks`)
- Per-project hook configuration via `.pi/settings.json`

## Future worktree enhancements

See [NOT-PORTED.md](./NOT-PORTED.md) for features from `@zenobius/pi-worktrees` that were evaluated but skipped:

- Configurable hook display templates and ANSI colors
- Logfile support for hook output
- Interactive config setup wizard (`cmdInit`, `cmdSettings`)
- `StatusIndicator` spinner class
- Real-time command output streaming in hooks
