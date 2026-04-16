# pure-git

Git worktree management for the Pi coding agent.

## Commands

### `/worktrees` — Interactive browser

Opens a full-screen worktree browser showing all worktrees with status (dirty, ahead/behind, main).

| Key | Action |
|-----|--------|
| `↑↓` | Navigate |
| `⏎` | Switch to worktree (resumes existing session, or shows branch info) |
| `c` | Create new worktree (prompts for name + base branch) |
| `d` | Delete selected worktree + branch (no merge) |
| `m` | Merge selected into main (keeps worktree + branch) |
| `x` | Merge + delete (merge into main, remove worktree + branch) |
| `Esc` | Cancel |

### `/worktrees create <name> [base-branch]`

Create a new branch and worktree in `.worktrees/<name>/`.

- `name` — Branch and worktree name (alphanumeric, hyphens, dots, underscores)
- `base-branch` — Optional base branch (defaults to current branch)

```bash
/worktrees create github-review
/worktrees create sessions-bookmarks main
```

### `/worktrees list` / `/worktrees ls`

List all worktrees with branch name, path, status, and ahead/behind counts (plain text).

### `/worktrees clean <name>`

Clean up a worktree. Prompts with three options:

1. **Merge and delete** — merge into main, push, then remove worktree + branch
2. **Merge only** — merge into main, push, keep worktree + branch
3. **Delete only** — remove worktree + branch without merging

## How it works

- Worktrees are created in `<project-root>/.worktrees/<name>/`
- The `.worktrees/` directory is automatically excluded from git tracking via `.git/info/exclude`
- All git operations use `pi.exec()` for proper process management
- **Switching worktrees** uses `ctx.switchSession()` to resume an existing Pi session in the worktree's directory. If no session exists, branch info is displayed instead.

## Installation

Add to your Pi settings:

```json
{
  "packages": ["./extensions/pure-git"]
}
```

Or in the pi-pure-ecosystem `package.json`:

```json
{
  "pi": {
    "extensions": ["./extensions/pure-git/index.ts"]
  }
}
```
