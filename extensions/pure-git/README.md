# pure-git

Git worktree management for the Pi coding agent.

Inspired by [`@zenobius/pi-worktrees`](https://github.com/zenobi-us/pi-worktrees) — lifecycle hooks, template variables, and worktree management patterns adapted to the pure-ecosystem conventions.

## Commands

### `/worktrees` — Interactive browser

Opens a full-screen worktree browser showing all worktrees with status (dirty, ahead/behind, main).

| Key | Action |
|-----|--------|
| `↑↓` | Navigate |
| `⏎` | Switch to worktree (resumes existing session, runs `onSwitch` hook) |
| `c` | Create new worktree (prompts for name + base branch, runs `onCreate` hook) |
| `d` | Delete selected worktree + branch (runs `onBeforeRemove` hook) |
| `m` | Merge selected into main (keeps worktree + branch) |
| `x` | Merge + delete (merge into main, remove worktree + branch) |
| `Esc` | Cancel |

### `/worktrees create <name> [base-branch]`

Create a new branch and worktree in `.worktrees/<name>/`. Runs `onCreate` hook if configured.

- `name` — Branch and worktree name (alphanumeric, hyphens, dots, underscores)
- `base-branch` — Optional base branch (defaults to current branch)

```bash
/worktrees create github-review
/worktrees create sessions-bookmarks main
```

### `/worktrees list` / `/worktrees ls`

List all worktrees with branch name, path, status, and ahead/behind counts (plain text).

### `/worktrees clean <name>`

Clean up a worktree. Runs `onBeforeRemove` hook (non-zero exit blocks removal). Prompts with three options:

1. **Merge and delete** — merge into main, push, then remove worktree + branch
2. **Merge only** — merge into main, push, keep worktree + branch
3. **Delete only** — remove worktree + branch without merging

### `/worktrees status`

Show current worktree info: project name, path, branch, is-worktree, main worktree path, total worktrees, and configured hooks.

### `/worktrees cd <name>`

Print the filesystem path to a worktree. Useful for scripting.

### `/worktrees prune`

Clean up stale worktree references. Shows a dry-run preview before pruning.

## Configuration

Per-repo settings via `pure-git.json`:

- **Global**: `~/.pi/agent/pure/config/pure-git.json`
- **Project**: `<project>/.pi/pure/config/pure-git.json`

Project config overrides global. Example:

```jsonc
{
  "worktreeRoot": "{{mainWorktree}}/.worktrees",   // Where worktrees live
  "onCreate": "echo 'Created {{path}}'",            // Run after creating a worktree
  "onSwitch": null,                                  // Run when switching to existing worktree
  "onBeforeRemove": null,                            // Run before removing; non-zero blocks removal
  "branchNameGenerator": "pi -p 'branch name for {{prompt}}' --model local/model",

  // Per-project overrides by project basename
  "projects": {
    "my-project": {
      "worktreeRoot": "~/worktrees/{{project}}",
      "onCreate": ["mise install", "bun install"],
      "onSwitch": "mise run dev:resume"
    }
  }
}
```

**Resolution order**: `projects[<basename>]` → top-level defaults → built-in defaults.

### Template variables

Available in `onCreate`, `onSwitch`, `onBeforeRemove`, `worktreeRoot`, and `branchNameGenerator`:

| Variable | Value |
|----------|-------|
| `{{path}}` | Absolute path to the worktree |
| `{{name}}` | Worktree directory name |
| `{{branch}}` | Branch name |
| `{{project}}` | Project name (basename of main worktree) |
| `{{mainWorktree}}` | Absolute path to main worktree |
| `{{prompt}}` | User input (branch name generator only) |

### Lifecycle hooks

| Hook | When | Blocking? |
|------|------|-----------|
| `onCreate` | After worktree creation | No — errors logged but worktree is kept |
| `onSwitch` | When switching to an existing worktree | No — errors logged |
| `onBeforeRemove` | Before removing a worktree | **Yes** — non-zero exit blocks removal |

Hooks accept a string or array of strings. Commands run sequentially, stop on first failure.

## How it works

- Worktrees are created in `<project-root>/.worktrees/<name>/` (configurable via `worktreeRoot`)
- The `.worktrees/` directory is automatically excluded from git tracking via `.git/info/exclude`
- All git operations use `pi.exec()` for proper process management
- **Switching worktrees** uses `ctx.switchSession()` to resume an existing Pi session in the worktree's directory
- **Branch name generator** spawns a `pi` subprocess, creating a real session you can switch to

## Sources & credits

- **[`@zenobius/pi-worktrees`](https://github.com/zenobi-us/pi-worktrees)** — Primary inspiration. Lifecycle hooks, template variables, worktree management, prune, status, and branch name generator patterns.
- **[`qualiti/pi-git-commands-extension`](https://github.com/qualiti/pi-git-commands-extension)** — Evaluated for commit command patterns (future phase).
- **[`@artale/pi-git-graph`](https://github.com/nicholasgasior/pi-artale-git-graph)** — Evaluated for git graph visualization (future phase).

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
