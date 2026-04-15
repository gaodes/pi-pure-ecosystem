# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-14

### Added

- **Event-driven macOS detection** — spawns a shared JXA watcher via `osascript` that subscribes to `AppleInterfaceThemeChangedNotification`. Reacts instantly to system appearance changes (zero polling, zero CPU between changes).
- **OSC 11 terminal background query** — new detection strategy that queries the terminal's actual background color via escape sequence. Works locally and over SSH. More reliable than `$COLORFGBG`. Auto-disables after repeated failures with cooldown.
- **`/theme refresh`** — force redetect appearance and re-apply theme immediately.
- **`/theme debug`** — show full detection trace (strategy used, OSC 11 state, JXA watcher status, environment).
- `ctx.hasUI` guards on all theme operations — prevents crashes in headless/print mode.
- `syncInProgress` mutex — prevents overlapping sync calls.
- Reconciliation timer (30s safety net) — catches missed `fs.watch()` events on macOS.
- Watchdog reconnection — retries `fs.watch()` after failures with 2s backoff.
- Skip when Ghostty IDE is active (`GHOSTTY_AGENT_PORT` env var) — avoids fighting with built-in sync.

### Changed

- **macOS detection uses `defaults read -g AppleInterfaceStyle`** instead of `osascript` AppleScript — simpler, faster, more reliable.
- **All subprocess calls are async** (`execFile` instead of `execSync`) — no more blocking the event loop.
- **Detection priority order** is now: JXA watcher → OSC 11 → macOS defaults → Linux → $COLORFGBG → fallback dark.
- **Config stores only overrides** — keys matching defaults are removed; `pure.theme` section is deleted entirely when all defaults are restored.
- **Status bar** shows current detection strategy (e.g. `🌙 JXA watcher`).
- **Theme selector** shows the detected appearance and strategy in the header.

### Removed

- 3-second polling on macOS — replaced by event-driven `fs.watch()` + reconciliation timer.
- Synchronous `execSync` calls — all async now.

## [0.1.0] - 2026-04-13

### Added

- Auto-sync Pi theme with system dark/light mode
- Dark mode detection for macOS (osascript), Linux (GNOME/KDE), and terminal ($COLORFGBG)
- Live polling — switches theme within 3 seconds of system appearance change
- Explicit light/dark theme pairing via settings or interactive selector
- Fallback heuristic theme matching by keyword (e.g. "latte" → light, "frappe" → dark)
- Interactive theme selector command (`/theme`)
- `/theme sync`, `/theme dark`, `/theme light`, `/theme status` subcommands
- Settings stored in `~/.pi/agent/settings.json` under `pure.theme`

[0.2.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.2.0
[0.1.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.1.0
