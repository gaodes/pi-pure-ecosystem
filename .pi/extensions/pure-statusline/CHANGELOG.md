# Changelog

## 1.0.0 - UNRELEASED

### Added

- Initial release, split from `pure-status` v1.2.0
- JSON-based configuration at `~/.pi/agent/pure/config/pure-statusline.json`
- Multi-line footer with configurable left/right segments
- Native Pi theme API (`theme.fg()`) for all segment colors
- Starship-inspired config system: per-segment `style`, `symbol`, `disabled` + color palette
- Color palette with Pi theme tokens as defaults, overridable with hex colors or other tokens
- Per-segment icon overrides (set `"symbol"` or `"none"`)
- Tool counter pills with colored backgrounds
- Built-in tool colors: read (green), write (red), edit (orange), bash (purple)
- Random colors from a vibrant pool for non-built-in tools
- Configurable `tool_colors` map for per-tool pill color overrides
- Light/dark theme adaptation for pill backgrounds and text contrast
- Git status caching with invalidation on branch changes
- Nerd Font auto-detection with ASCII fallback
- `/statusline` command for config management

### Design

- Inspired by [Starship](https://starship.rs/): per-segment config with style/symbol/disabled
- Colors reference a palette (semantic name → Pi theme token or hex)
- Palette defaults to Pi theme tokens — follows any active Pi theme automatically
- No dependency on pure-theme — uses Pi's standard Theme API
- Every color, icon, and option overridable in config
