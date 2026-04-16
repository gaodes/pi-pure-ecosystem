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

## Phase 5: Advanced Worktree Features

Graduated from `@zenobius/pi-worktrees`:

- Per-repo settings via `.pi/settings.json` (no external config service)
- Template variables: `{{path}}`, `{{name}}`, `{{branch}}`, `{{project}}`
- Lifecycle hooks: `onCreate`, `onSwitch`, `onBeforeRemove`
- Branch name generator via Pi AI
- `/worktrees status` — Current worktree info with ahead/behind
- `/worktrees cd <name>` — Print path to worktree
- `/worktrees prune` — Clean up stale worktree references
