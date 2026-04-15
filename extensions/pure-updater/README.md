# Pure Updater

Checks for Pi updates, prompts when a new version is available, and installs with one click. Generates an impact report after each update by analyzing the changelog against your local setup.

## Features

- **Automatic checks** — queries npm registry on session start
- **Update prompt** — interactive UI showing current → latest version with install command
- **Skip this version** — dismiss a specific version without being asked again
- **Auto-restart** — after installing, offers to restart Pi into the same session
- **Impact report** — after an update, auto-triggers a changelog analysis comparing your extensions, models, themes, and settings against the changes
- **Offline-aware** — respects `PI_OFFLINE` and `PI_SKIP_VERSION_CHECK` environment variables
- **Cached results** — version checks are cached to avoid redundant network requests

## Commands

| Command | Description |
|---|---|
| `/update` | Check for updates and show install prompt |
| `/update --test` | Simulate the full update UI flow without a real install |

## How It Works

1. On session start, checks for a cached upgrade version and shows a prompt if found
2. Starts a background fetch of the latest version from npm
3. If a newer version is found, shows an interactive prompt: install, skip, or skip this version
4. On install, runs `npm install -g @mariozechner/pi-coding-agent@<version>`
5. After install, stamps a pending report so the next session triggers impact analysis
6. Impact analysis reads the CHANGELOG.md, extracts relevant version sections, and produces a severity-rated report

## Settings

Cache is stored at `~/.pi/agent/pure/cache/pure-updater.json`.

## Installation

Extensions load from `~/.pi/agent/extensions/` via global auto-discovery.

```
~/.pi/agent/extensions/pure-updater/
└── index.ts
```

Reload with `/reload` or restart Pi.

## Sources / Inspiration

- **[tonze/pi-updater](https://github.com/tonze/pi-updater)** — Original extension this was forked from. Provided the version checking, install, and restart flow.
