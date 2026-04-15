# Changelog

## [0.1.0] - UNRELEASED

### Added

- Initial release, split from `pure-status` v1.2.0
- JSON-based configuration (replaces shared YAML config)
- AI-generated themed working messages (generate mode)
- File-based vibe loading (file mode)
- Working line with vibe message, tool label, elapsed timer, thinking status
- Batch vibe generation with `/vibe generate`
- `/vibe` command for theme/mode/model management
- Vibe files stored in `~/.pi/agent/vibes/<theme>.txt`
- Memo cache for repeated task hints
- Recent vibes tracking to avoid repetition

### Changed

- Config file changed from `pure-status.yaml` (vibes section) to `~/.pi/agent/pure/config/pure-vibes.json`
- Removed `yaml` npm dependency
- Removed dependency on `pure-statusline` config
