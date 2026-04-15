# Pi Pure Ecosystem

Personal extensions, themes, and configuration for the [Pi coding agent](https://github.com/badlogic/pi-mono). Named with the `pure-` prefix convention.

## Extensions

Extensions live under `extensions/` with a scope-based folder layout. All extensions currently ship globally via package filtering (see below).

| Extension | Version | Tool | Command | Purpose |
|-----------|---------|------|---------|---------|
| [pure-cron](extensions/global/pure-cron/) | 0.2.0 | `pure_cron` | `/cron` | Schedule recurring and one-shot agent prompts |
| [pure-model-switch](extensions/global/pure-model-switch/) | 0.1.0 | `switch_model` | — | List, search, and switch models with aliases |
| [pure-sessions](extensions/global/pure-sessions/) | 0.5.0 | — | `/sesh` | Auto-name sessions, browse/resume/rename |
| [pure-theme](extensions/global/pure-theme/) | 0.2.0 | — | `/theme` | Sync theme with system dark/light mode |
| [pure-updater](extensions/global/pure-updater/) | 0.2.0 | — | `/update` | Check for Pi updates, install, and generate impact reports |
| [pure-github](extensions/global/pure-github/) | 0.1.1 | `github_repo`, `github_issue`, `github_pr`, `github_workflow` | *(planned)* | GitHub PR/repo/workflow tools |

| [pure-statusline](extensions/global/pure-statusline/) | *unreleased* | — | `/statusline` | Configurable multi-line status footer |
| [pure-vibes](extensions/global/pure-vibes/) | *unreleased* | — | `/vibe` | AI-generated themed working messages |

> **In development:** not yet in `package.json` manifest. Load from `.pi/extensions/` for testing.

## Themes

| Theme | Description |
|-------|-------------|
| `catppuccin-frappe` | Catppuccin Frappé — dark, warm tones |
| `catppuccin-latte` | Catppuccin Latte — light, warm tones |

## Installation

This repo is installed as a git package in Pi's global settings. Extensions are loaded via package filtering:

```json
{
  "packages": [
    {
      "source": "git:github.com/gaodes/pi-pure-ecosystem",
      "extensions": ["extensions/global/*", "extensions/shared/*"]
    }
  ]
}
```

To develop locally, see the [development workflow](#development-workflow) below.

## Extension Scope Layout

```
extensions/
├── global/     ← loaded globally only
├── project/   ← loaded per-project (opt-in via project settings)
├── workspace/  ← loaded per-workspace (opt-in via project settings)
└── shared/     ← loaded by all scopes (global, project, workspace)
```

## Conventions

- **`pure-<name>`** naming for extensions, config files, and storage paths
- **Single `index.ts`** entry point — no build step, Pi loads `.ts` via Jiti at runtime
- **Self-contained** — each extension works standalone with no cross-extension dependencies
- **Project overrides global** — project-level config at `.pi/pure/config/` takes precedence over `~/.pi/agent/pure/config/`
- **Minimal dependencies** — only npm packages when Pi doesn't provide the capability

## License

MIT
