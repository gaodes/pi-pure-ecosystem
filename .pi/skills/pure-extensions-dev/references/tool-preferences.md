# Tool Preferences

> Pi version: 0.67.4 | Last updated: 2026-04-17

Prefer Pi internal tools over raw bash. Use bash only when no internal tool covers the need.

## Git & GitHub

| Task | Tool | Not bash |
|------|------|----------|
| Switch worktree | `switch_worktree` | Not `git worktree add` (for switching) |
| Browse remote repo files | `github_browse` | Not `curl` / `gh api` |
| List/view repos | `github_repo` (action `list`/`view`) | Not `gh repo list` |
| Manage issues | `github_issue` | Not `gh issue` |
| Manage PRs | `github_pr` | Not `gh pr` |
| Trigger workflows | `github_workflow` | Not `gh workflow run` |
| Search code in remote repos | `github_browse` (action `search_code`) | Not `gh search code` |
| Read a remote file | `github_browse` (action `read_file`) | Not `curl` raw URL |
| List remote directory | `github_browse` (action `list_directory`) | Not `gh api` |
| View PR diff | `github_pr` (action `diff`) | Not `gh pr diff` |

## File Operations

| Task | Tool |
|------|------|
| Read a file | `read` — not `cat` |
| Edit a file | `edit` — not `sed` |
| New file or full rewrite | `write` |
| Search / list / find | `bash` (`rg`, `find`, `ls`) |

## When to Use Bash

Bash is the right tool for:

- `git clone`, `git add`, `git commit`, `git merge`, `git push`
- `git worktree add` (initial setup — `switch_worktree` is for switching)
- `rm`, `rsync`, `mv`, `mkdir`
- `biome check`
- `npm install`, `npm publish`
- `pi -e ... -p "..."` (smoke tests)
