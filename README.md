# Pi Pure Ecosystem

Personal extensions and configuration for the [Pi coding agent](https://github.com/badlogic/pi-mono). Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

## Extensions

| Extension | Tool | Command | Purpose |
|-----------|------|---------|---------|
| [pure-cron](extensions/pure-cron/) | `pure_cron` | `/cron` | Schedule recurring and one-shot agent prompts |
| [pure-git](extensions/pure-git/) | `switch_worktree` | `/worktrees` | Git worktree management: create, list, clean, switch |
| [pure-github](extensions/pure-github/) | `github_repo`, `github_issue`, `github_pr`, `github_workflow` | *(planned)* | GitHub PR/repo/workflow tools |
| [pure-model-switch](extensions/pure-model-switch/) | `switch_model` | — | List, search, and switch models with aliases |
| [pure-sessions](extensions/pure-sessions/) | — | `/sesh` | Auto-name sessions, browse/resume/rename |
| [pure-statusline](extensions/pure-statusline/) | — | `/statusline` | Configurable multi-line status footer with segments, tool counters |
| [pure-theme](extensions/pure-theme/) | — | `/theme` | Sync theme with system dark/light mode |
| [pure-updater](extensions/pure-updater/) | — | `/update` | Check for Pi updates, prompt on new versions, install and restart |
| [pure-foundation](extensions/pure-foundation/) | — | — | Shared foundation modules (tool UI, widgets, primitives, utilities) |
| [pure-vibes](extensions/pure-vibes/) | — | `/vibe` | AI-generated themed working messages |

## Migration notes

- `pure-utils` is deprecated: see [`extensions/pure-utils/DEPRECATED.md`](extensions/pure-utils/DEPRECATED.md)
- Shared UI/modules moved to [`pure-foundation`](extensions/pure-foundation/)
- Utility tools (`pi_version`, `pi_docs`, `pi_changelog`, `pi_changelog_versions`, `detect_package_manager`) are provided by `pure-dev-kit` (forked from upstream `@aliou/pi-dev-kit`)

## Installation

This repo is installed as a git package in Pi's global settings:

```json
{
  "packages": [
    {
      "source": "git:github.com/gaodes/pi-pure-ecosystem",
      "extensions": [
        "extensions/pure-cron/index.ts",
        "extensions/pure-github/index.ts",
        "extensions/pure-git/index.ts",
        "extensions/pure-model-switch/index.ts",
        "extensions/pure-sessions/index.ts",
        "extensions/pure-statusline/index.ts",
        "extensions/pure-theme/index.ts",
        "extensions/pure-updater/index.ts"
      ]
    }
  ]
}
```

## Conventions

- **`pure-<name>`** naming for extensions, config files, and storage paths
- **Start with a single `index.ts`** — split when justified. No build step; Pi loads `.ts` via Jiti at runtime.
- **Self-contained** — each extension works standalone with no cross-extension dependencies by default
- **Project overrides global** — project-level config takes precedence over global config
- **Minimal dependencies** — only npm packages when Pi doesn't provide the capability

## License

MIT
