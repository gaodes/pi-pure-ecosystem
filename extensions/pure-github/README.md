# pure-github

GitHub integration for [Pi](https://github.com/badlogic/pi-mono) — wraps the `gh` CLI to provide GitHub operations as Pi tools.

## Features

- **5 GitHub tools**: `github_repo`, `github_issue`, `github_pr`, `github_workflow`, `github_browse`
- **Full CRUD + remote browsing**: create, list, view, edit, close, merge, review, read files, search code, inspect PRs, and format threads
- **gh CLI native**: uses `pi.exec()` to call `gh` — auth handled by `gh auth login`
- **Auto-detection**: probes `gh` binary + auth status on session start
- **Compact output**: summary formatters + `detail: "full"` for raw JSON where appropriate
- **No clone required for browsing**: inspect remote repos, files, code, PRs, issues, and discussions directly via GitHub API

## Requirements

- [`gh` CLI](https://cli.github.com/) installed and authenticated (`gh auth login`)
- Optional: `GH_CLI_PATH` env var for custom binary path

## Tools

### `github_repo` — Repository management

Actions: `create`, `clone`, `fork`, `list`, `view`, `delete`, `sync`

### `github_issue` — Issue management

Actions: `create`, `list`, `view`, `close`, `reopen`, `comment`, `edit`

### `github_pr` — Pull Request management

Actions: `create`, `list`, `view`, `diff`, `merge`, `review`, `close`, `checkout`

### `github_workflow` — GitHub Actions

Actions: `list`, `view`, `run`, `logs`, `disable`, `enable`

### `github_browse` — Remote repo browsing

Actions: `read_file`, `list_directory`, `search_code`, `glob_files`, `search_commits`, `list_issues`, `list_prs`, `pr_overview`, `list_pr_commits`, `get_pr_commit`, `list_pr_checks`, `list_review_comments`, `list_changes`, `get_change`, `list_participants`, `list_images`, `download_image`, `format`

Useful for reading any GitHub repo without cloning, plus formatting issue/PR/discussion threads and inspecting PR files/checks/commits.

## Commands

### `/gh-status`

Shows a themed GitHub status panel for the current repo with:
- open issue count
- your open PR count
- review-requested count
- current branch PR
- latest CI result for the current branch

Falls back to plain text notifications when rich UI is not available.

## Installation

```bash
pi install git:github.com/gaodes/pi-pure-ecosystem
```

Then `/reload` in Pi.

## Configuration

Config file paths:
- global: `~/.pi/agent/pure/config/pure-github.json`
- project override: `<project>/.pi/pure/config/pure-github.json`

Project config overrides global config when present.

Supported settings:

```json
{
  "defaultOwner": "gaodes",
  "mergeStrategy": "squash",
  "notifications": {
    "enabled": true
  }
}
```

- `defaultOwner` — default owner/org for shorthand repo references
- `mergeStrategy` — default merge method for future PR merge workflows
- `notifications.enabled` — show GitHub startup summary notifications (review-requested count + CI status)

The global config is scaffolded automatically on first load.

## Sources / Inspiration

- **[@the-forge-flow/gh-pi](https://github.com/MonsieurBarti/GH-PI)** — Primary fork source. Clean modular `gh` CLI wrapper with 4 LLM tools, tests, and proper error handling. MIT license.
- **[@e9n/pi-github](https://github.com/espennilsen/pi/tree/main/extensions/pi-github)** — Command-based GitHub integration with excellent `/gh-pr-fix` (GraphQL thread resolution), `/gh-pr-merge` (branch cleanup), `/gh-pr-create` (LLM-generated), and `/gh-status` (dashboard).
- **[pi-github](https://github.com/maria-rcks/pi-github)** — Single mega-tool with remote repo inspection (file read, directory list, code search, glob, commit search), image extraction, and PR overview/checks tools.
- **[@prinova/pi-github-tools](https://github.com/PriNova/pi-github-tools)** — GitHub PAT-based tools for remote repo reading, code search, and glob with custom TUI renderers.
- **[@aretw0/git-skills](https://github.com/aretw0/agents-lab)** — Skill-based `gh` CLI reference card.

See [PLAN.md](./PLAN.md) for planned features from these sources.

## License

MIT
