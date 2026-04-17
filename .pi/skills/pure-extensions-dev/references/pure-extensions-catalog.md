# Pure Extensions Catalog

> Pi version: 0.67.4 | Last updated: 2026-04-17
>
> Living reference of all extensions in the mono repo. Update when extensions are added or modified.

## Overview

| Extension | Tool | Command | Activation | Lines | .ts Files | Runtime Deps |
|-----------|------|---------|------------|-------|-----------|-------------|
| `pi-devkit` | `pi_docs`, `pi_version`, `pi_changelog`, `pi_changelog_versions`, `detect_package_manager` | `/devkit` | Global (git pkg) | 9 files | 9 | `@sinclair/typebox` |
| `pure-cron` | `pure_cron` | `/cron` | Global (git pkg) | 1300 | 1 | `croner`, `nanoid` |
| `pure-git` | `switch_worktree` | `/worktrees` | Global (git pkg) | 53 (main) | 6 | — |
| `pure-github` | `github_repo`, `github_issue`, `github_pr`, `github_workflow` | `/gh-status` (planned) | Global (git pkg) | 970 | 13 | — |
| `pure-model-switch` | `switch_model` | — | Global (git pkg) | 396 | 1 | — |
| `pure-sessions` | — | `/sesh` | Global (git pkg) | 1880 | 1 | — |
| `pure-statusline` | — | `/statusline` | Local (source path) | 1335 | 1 | — |
| `pure-theme` | — | `/theme` | Global (git pkg) | 1057 | 1 | — |
| `pure-updater` | — | `/update` | Global (git pkg) | 436 | 1 | — |
| `pure-vibes` | — | `/vibe` | Local (source path) | 226 | 4 | — |

## Tool Registrations

Tools registered across extensions (avoid name collisions):

| Tool Name | Extension | Purpose |
|-----------|-----------|---------|
| `pi_docs` | `pi-devkit` | Read Pi documentation |
| `pi_version` | `pi-devkit` | Get Pi version info |
| `pi_changelog` | `pi-devkit` | Read Pi changelog |
| `pi_changelog_versions` | `pi-devkit` | List changelog versions |
| `detect_package_manager` | `pi-devkit` | Detect project package manager |
| `pure_cron` | `pure-cron` | Schedule recurring/one-shot prompts |
| `switch_worktree` | `pure-git` | Git worktree management |
| `github_repo` | `pure-github` | GitHub repo operations |
| `github_issue` | `pure-github` | GitHub issue operations |
| `github_pr` | `pure-github` | GitHub PR operations |
| `github_workflow` | `pure-github` | GitHub Actions workflows |
| `switch_model` | `pure-model-switch` | List/search/switch models |

## Hook Usage Patterns

### session_start (most common)

Used by: `pure-cron`, `pure-github`, `pure-model-switch`, `pure-sessions`, `pure-statusline`, `pure-theme`, `pure-updater`, `pure-vibes`

Typical pattern: load config, restore state, register listeners.

### session_shutdown

Used by: `pure-cron`, `pure-theme`

### Tool execution hooks

| Hook | Extension | Purpose |
|------|-----------|---------|
| `tool_execution_start` | `pure-vibes` | Show working message |
| `tool_execution_end` | `pure-vibes`, `pure-statusline` | Update status |
| `tool_result` | `pure-statusline` | Track tool results |
| `tool_call` | `pure-vibes` | React to tool calls |

### Agent lifecycle hooks

| Hook | Extension | Purpose |
|------|-----------|---------|
| `before_agent_start` | `pure-sessions`, `pure-vibes` | Pre-prompt processing |
| `agent_start` | `pure-vibes` | React to agent start |
| `agent_end` | `pure-sessions`, `pure-vibes` | Post-processing |

### File change hooks

| Hook | Extension |
|------|-----------|
| `file_edit` | `pure-statusline` |
| `file_write` | `pure-statusline` |
| `user_bash` | `pure-statusline` |

### UI hooks

| Hook | Extension | Purpose |
|------|-----------|---------|
| `tui_ready` | `pure-statusline` | Initialize footer UI |
| `command` | `pure-statusline` | Handle command events |
| `message_update` | `pure-vibes` | React to message changes |

## Dependency Patterns

### Pi packages used across extensions

| Package | Used by | Purpose |
|---------|---------|---------|
| `@mariozechner/pi-coding-agent` | All | Extension API, getAgentDir, defineTool |
| `@sinclair/typebox` | Most | Type-safe tool parameters |
| `@mariozechner/pi-ai` | `pure-cron`, `pure-github`, `pure-sessions`, `pure-vibes` | StringEnum, complete() |
| `@mariozechner/pi-tui` | `pure-cron`, `pure-github`, `pure-sessions`, `pure-statusline`, `pure-theme` | TUI components |

### Runtime deps (non-Pi)

| Dep | Extension | Purpose |
|-----|-----------|---------|
| `croner` | `pure-cron` | Cron expression parsing/scheduling |
| `nanoid` | `pure-cron` | Unique job IDs |

## Config/Cache Patterns

Extensions that use `getPurePath()` / `loadConfig()`:

| Extension | Config File | Cache File |
|-----------|------------|------------|
| `pure-cron` | `pure-cron.json` (jobs, settings) | `pure-cron.json` (cache) |
| `pure-model-switch` | `pure-model-switch.json` (aliases) | — |
| `pure-sessions` | `pure-sessions.json` (bookmarks) | — |
| `pure-statusline` | `pure-statusline.json` (segments, styles) | — |
| `pure-theme` | `pure-theme.json` (mode preference) | — |
| `pure-updater` | `pure-updater.json` (skip version) | — |
| `pure-vibes` | `pure-vibes.json` (api keys, settings) | — |

## Structural Patterns

### Single-file extensions (most common)

`index.ts` contains everything: helpers, tool definitions, UI, registration.

Used by: `pure-cron`, `pure-model-switch`, `pure-sessions`, `pure-statusline`, `pure-theme`, `pure-updater`

### Multi-file extensions

Split when justified by size or logical separation:

| Extension | Structure | Reason |
|-----------|-----------|--------|
| `pi-devkit` | 9 files (tools, skills, utils) | Multiple independent tools |
| `pure-git` | 6 files (commands, services) | Separation of git ops from UI |
| `pure-github` | 13 files (browse-tools, commands, config, error-handler) | Large surface area (5 tools + browse) |
| `pure-vibes` | 4 files (config, messages separate) | Clean config/message separation |

## Anti-patterns to Avoid

Based on real issues encountered:

1. **`spawn`/`spawnSync` from `node:child_process`** — `pure-statusline` and `pure-updater` still use these. New extensions should use `pi.exec()`. These are legacy exceptions.
2. **`os.homedir()`** — `pure-updater` still uses it. New extensions should use `getAgentDir()`. Legacy exception.
3. **`.js` in imports** — `pure-vibes` has `import ... from "./config.js"`. Jiti handles it but it's not the convention.
