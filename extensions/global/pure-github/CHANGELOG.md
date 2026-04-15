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
