# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.5.1] - 2026-04-15

### Fixed

- `getSessionId()`: Fixed crash when `ctx.sessionManager` is undefined (optional chaining only guarded the method call, not the property access). Test coverage caught this regression.

## [0.5.0] - 2026-04-14

### Changed

- Config search simplified from cascading `cwd > .pi > agent` to `.pi/pure/config > ~/.pi/agent/pure/config`
- `/sesh init` now creates config at `<project>/.pi/pure/config/pure-sessions.json`

## [0.4.0] - 2026-04-13

### Added

- Emoji feature with three-tier resolution: LLM-generated → keyword-based → default 📌
- Configurable emoji mode: `true` (auto), `false` (off), or fixed string
- 25+ keyword-to-emoji mappings (fix→🐛, add→✨, deploy→🚀, etc.)

## [0.3.0] - 2026-04-13

### Added

- `/sesh regen` — regenerate session name from full conversation analysis
- Conversation-aware summary includes tool calls and file paths
- `regenPrompt` and `regenMaxChars` config options

## [0.2.0] - 2026-04-13

### Changed

- Session browser rewritten from overlay to non-overlay TUI
- Switched from `SelectList` to `SettingsList` for ghosting prevention

## [0.1.0] - 2026-04-13

### Added

- LLM-powered auto-naming with model fallback chain (primary → fallback → deterministic)
- Interactive session browser (`/sesh`) with resume, rename, delete
- Project prefix auto-detection via git repo name or shell command
- Themed deterministic word lists (Sci-Fi, Space, Tech, Mythology) — 72,450 unique names
- Configurable via `pure-sessions.json` (model, prompt, prefix, emoji, word lists)
- `/sesh info`, `/sesh config`, `/sesh init`, `/sesh test` commands
- JSON schema for config validation

[0.5.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.5.0
[0.4.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.4.0
[0.3.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.3.0
[0.2.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.2.0
[0.1.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.1.0
