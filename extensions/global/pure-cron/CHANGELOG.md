# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-04-14

### Changed

- Storage migrated from `~/.pi/agent/pure-cron.json` to `~/.pi/agent/pure/config/pure-cron.json`
- Settings path resolution uses `getAgentDir()` instead of hardcoded `~/.pi/agent/`

## [0.1.0] - 2026-04-13

### Added

- Schedule agent prompts with cron expressions (6-field with seconds), ISO timestamps, relative times (`+10s`, `+5m`, `+1h`), and intervals (`5m`, `1h`)
- `pure_cron` tool for managing jobs from the LLM
- `/pure-cron` command for interactive job management
- Live status widget showing all scheduled prompts with next/last run times
- Session and project scoping for jobs
- Persistence to `~/.pi/agent/pure-cron.json`
- Auto-cleanup of disabled one-shot jobs on session switch/shutdown
- `widget_show_default` setting to control widget visibility

[0.2.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.2.0
[0.1.0]: https://github.com/gaodes/pi-pure-ecosystem/releases/tag/v0.1.0
