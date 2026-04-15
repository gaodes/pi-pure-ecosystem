# Pure Theme

Auto-syncs the Pi theme with your system's dark/light mode.

## Features

- **Event-driven on macOS** — instant reaction via JXA watcher + `fs.watch()`, zero polling, zero CPU between changes
- **OSC 11 terminal query** — detects actual terminal background color, works locally and over SSH
- **Multi-platform** — macOS (JXA watcher / defaults), Linux (GNOME/KDE), `$COLORFGBG` fallback
- **Explicit pairing** — pick exactly which theme to use for light and dark mode
- **Fallback heuristics** — if no pair is set, auto-detects by keyword (e.g. "latte" → light, "frappe" → dark)
- **Interactive selector** — browse all installed themes and configure sync from one UI

## Usage

| Command | Action |
|---|---|
| `/theme` | Open interactive theme selector |
| `/theme sync` | Toggle auto-sync on/off |
| `/theme dark` | Switch to your paired dark theme |
| `/theme light` | Switch to your paired light theme |
| `/theme status` | Show detection result, paired themes, and sync state |
| `/theme refresh` | Force redetect appearance and re-apply theme |
| `/theme debug` | Show full detection trace for troubleshooting |

The interactive selector lets you:

1. **Pick a theme** — switch immediately
2. **Set light theme / Set dark theme** — choose which theme maps to each mode
3. **Toggle sync** — enable/disable auto-switching

## Settings

Stored in `~/.pi/agent/settings.json` under `pure.theme`. Only overrides are persisted — keys matching defaults are removed, and the section is deleted when all values are defaults.

```json
{
  "pure": {
    "theme": {
      "light_theme": "catppuccin-latte",
      "dark_theme": "catppuccin-frappe"
    }
  }
}
```

| Key | Type | Default | Description |
|---|---|---|---|
| `sync_on_start` | boolean | `true` | Auto-switch theme on startup and react to changes |
| `light_theme` | string? | auto | Theme name for light mode (omit to auto-detect) |
| `dark_theme` | string? | auto | Theme name for dark mode (omit to auto-detect) |

## Detection Strategy

Checked in priority order:

1. **JXA watcher** (macOS only) — shared `osascript` process subscribes to `AppleInterfaceThemeChangedNotification`, writes state to `/tmp/pi-macos-theme`. All Pi sessions `fs.watch()` this file. Instant, event-driven.
2. **OSC 11** — queries the terminal's background color via `\x1b]11;?\x07`. Parsed by luminance. Works over SSH. Auto-disabled after 3 failures, retried after 60s cooldown.
3. **macOS defaults** — `/usr/bin/defaults read -g AppleInterfaceStyle` (fallback if JXA watcher is unavailable).
4. **Linux** — `gsettings` (GNOME) or `kdeglobals` (KDE).
5. **`$COLORFGBG`** — terminal environment variable.
6. **Fallback** — dark.

### Safety features

- **Reconciliation timer** — 30s safety net that re-checks system state in case `fs.watch()` missed an event.
- **Watchdog reconnection** — retries `fs.watch()` after failures with 2s backoff.
- **Ghostty IDE skip** — stays inactive when `GHOSTTY_AGENT_PORT` is set.
- **`ctx.hasUI` guards** — no-ops in headless/print mode.

## Installation

Place in the Pi extensions directory:

```
~/.pi/agent/extensions/pure-theme/
└── index.ts
```

Reload with `/reload` or restart Pi.

## Requirements

- Pi with `@mariozechner/pi-coding-agent` and `@mariozechner/pi-tui` (bundled)
- Custom themes in `~/.pi/agent/themes/*.json`

## Sources / Inspiration

- **[badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)** — The Pi coding agent and its built-in theme system
- **[Catppuccin](https://github.com/catppuccin/catppuccin)** — Color palette that inspired the default paired themes (Latte for light, Frappé for dark)
- **[@yevhen.b/pi-macos-theme-sync](https://www.npmjs.com/package/@yevhen.b/pi-macos-theme-sync)** — JXA watcher architecture, shared detached process, `fs.watch()` + reconciliation timer pattern
- **[ferologics/pi-system-theme](https://github.com/ferologics/pi-system-theme)** — Async `execFile` pattern, `ctx.hasUI` guards, config-only-overrides pattern, `syncInProgress` mutex
- **[mise42/pi-theme-sync](https://github.com/mise42/pi-theme-sync)** — OSC 11 terminal background query via `/dev/tty` subprocess, failure tracking with cooldown, `/debug` and `/refresh` commands
