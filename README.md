# Pi Pure Ecosystem

Personal extensions, themes, and configuration for the [Pi coding agent](https://github.com/badlogic/pi-mono). Named with the `pure-` prefix convention.

## Extensions

| Extension | Version | Tool | Command | Purpose |
|-----------|---------|------|---------|---------|
| [pure-cron](extensions/pure-cron/) | 0.2.0 | `pure_cron` | `/pure-cron` | Schedule recurring and one-shot agent prompts |
| [pure-model-switch](extensions/pure-model-switch/) | 0.1.0 | `switch_model` | — | List, search, and switch models with aliases |
| [pure-sessions](extensions/pure-sessions/) | 0.5.0 | — | `/sesh` | Auto-name sessions, browse/resume/rename |
| [pure-theme](extensions/pure-theme/) | 0.2.0 | — | `/theme` | Sync theme with system dark/light mode |
| [pure-updater](extensions/pure-updater/) | 0.2.0 | — | `/update` | Check for Pi updates, install, and generate impact reports |

> **In development:** `pure-statusline` (configurable status footer), `pure-vibes` (AI-themed working messages).

## Themes

| Theme | Description |
|-------|-------------|
| `catppuccin-frappe` | Catppuccin Frappé — dark, warm tones |
| `catppuccin-latte` | Catppuccin Latte — light, warm tones |

## Installation

Copy extensions to Pi's global extensions directory:

```bash
cp -R extensions/pure-<name> ~/.pi/agent/extensions/pure-<name>
```

Then `/reload` in Pi.

For themes:
```bash
cp themes/*.json ~/.pi/agent/themes/
```

## Conventions

- **`pure-<name>`** naming for extensions, config files, and storage paths
- **Single `index.ts`** entry point — no build step, Pi loads `.ts` via Jiti at runtime
- **Self-contained** — each extension works standalone with no cross-extension dependencies
- **Project overrides global** — project-level config at `.pi/pure/config/` takes precedence over `~/.pi/agent/pure/config/`
- **Minimal dependencies** — only npm packages when Pi doesn't provide the capability

## License

MIT
