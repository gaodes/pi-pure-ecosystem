## [0.2.1] - 2026-04-15

### Changed

- `/gh-status` now opens a themed TUI dashboard in interactive mode instead of only sending a plain text notification
- Added a plain-text fallback for `/gh-status` when rich UI is unavailable
- `/gh-status` now includes the current PR URL in fallback text output

## [0.2.0] - 2026-04-15

### Added

- New `github_browse` tool for remote GitHub repo inspection without cloning
- Remote file reading with line ranges and ref support (`read_file`)
- Directory listing, code search, glob search, and commit search for any repo
- PR inspection actions: overview, changed files, per-file diff, commit list/detail, checks, and review comments
- Thread rendering for issues, PRs, and discussions with filtering, participant summaries, and image extraction/download
- Git-origin auto-detection for `github_browse` owner/repo resolution, with `pure.github.defaultOwner` fallback support

## [0.1.1] - 2026-04-15

### Fixed

- `github_issue` close reason: changed enum from `"not_planned"` to `"not planned"` (with space) to match `gh issue close --reason` valid values
- Auto-format all files with biome for consistent style

## [0.1.0] - 2025-04-15

### Added

- Forked from [@the-forge-flow/gh-pi](https://github.com/MonsieurBarti/GH-PI) v0.2.4
- Renamed tool prefixes from `tff-github_*` to `github_*`
- Removed `.js` import extensions (Pi loads `.ts` via Jiti)
- Removed update-check module (updates handled by pure-updater)
- 4 LLM tools: `github_repo`, `github_issue`, `github_pr`, `github_workflow`
- Auto-detection of `gh` CLI binary and auth status on session start
- Summary formatters for compact output
- Abort-signal aware
- Output truncation via Pi's `truncateHead()`
- `GH_CLI_PATH` env var for custom binary path
