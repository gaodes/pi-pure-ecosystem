# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-14

### Changed

- Storage migrated from `~/.pi/agent/update-cache.json` to `~/.pi/agent/pure/cache/pure-updater.json`
- Cache file renamed from `update-cache.json` to `pure-updater.json` (consistent naming convention)
- Auto-migration of old cache file on first load

## [0.1.0] - 2026-04-14

### Added

- Forked from [tonze/pi-updater](https://github.com/tonze/pi-updater) v0.3.0
- Automatic version check against npm registry on session start
- Interactive update prompt with install, skip, and skip-version options
- Background version fetch with cached results
- `npm install -g` with auto-restart into same session
- Post-update impact report that analyzes changelog against local setup
- `/update` command and `/update --test` simulation mode
- `PI_OFFLINE` and `PI_SKIP_VERSION_CHECK` environment variable support

[0.2.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.2.0
[0.1.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.1.0
