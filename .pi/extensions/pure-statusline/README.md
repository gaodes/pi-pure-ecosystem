# Pure StatusLine

A configurable status footer for [Pi](https://github.com/badlogic/pi-mono) coding agent. Starship-inspired config system where every color, icon, and option is overridable per-segment via JSON config. Colors default to Pi theme tokens so the statusline follows any active Pi theme automatically — no dependency on pure-theme or any other extension.

## Features

- **Multi-line footer** — configurable layout with left/right segments per line
- **Starship-inspired config** — every color, icon, style, and option per-segment is overridable
- **Theme-native colors** — defaults use Pi theme tokens (`accent`, `success`, `warning`, etc.) so any Pi theme works automatically
- **Color palette** — override any color with a Pi theme token or hex color (`#d787af`)
- **Per-segment icons** — override any icon, or set `"none"` to hide it
- **Nerd Font support** — auto-detects terminal and uses appropriate icons
- **17 built-in segments** + `text:Custom text` for inline text
- **Tool counter pills** — theme-derived backgrounds, per-tool usage counts
- **JSON config** — `~/.pi/agent/pure/config/pure-statusline.json`

## Command

`/statusline` — manage the status footer:

| Subcommand | Description |
|---|---|
| `reload` | Reload config from disk |
| `debug` | Show current config, palette overrides, segment overrides |
| `reset-tools` | Reset tool counters |
| `tools [on\|off\|toggle]` | Toggle tool counter display |

## Configuration

Config file: `~/.pi/agent/pure/config/pure-statusline.json`

The config has three main sections: `lines` (layout), `colors` (palette overrides), and `segments` (per-segment overrides). Only include what you want to change — everything else uses defaults.

```jsonc
// ~/.pi/agent/pure/config/pure-statusline.json
{
  // Layout: array of rows, each with left/right segment lists
  "lines": [
    { "left": ["model", "separator", "path", "git"], "right": ["context_pct"] },
    { "left": ["tool_counter"], "right": ["tool_total_uses"] }
  ],

  // Color palette overrides. Keys are semantic names used by segments.
  // Values can be Pi theme tokens or hex colors.
  "colors": {
    "model": "accent",           // Pi theme token (default)
    "path": "#00afaf",           // Custom hex color
    "git_dirty": "warning"       // Override with different theme token
  },

  // Per-segment overrides. Each segment supports:
  //   disabled: true/false
  //   symbol: "icon" or "none" (hides icon)
  //   style: "palette_key" (references colors section)
  //   + segment-specific options
  "segments": {
    "model": {
      "symbol": "🤖 ",
      "style": "model",
      "show_thinking_level": true
    },
    "path": {
      "mode": "full"             // "basename" | "abbreviated" | "full"
    },
    "git": {
      "show_untracked": false,
      "dirty_branch_style": "git_dirty"
    },
    "context_pct": {
      "warn_threshold": 60,
      "error_threshold": 85
    },
    "tool_counter": {
      "label": "🔧",
      "sort_by": "countDesc",
      "max_tools": 6
    }
  },

  // Per-tool pill colors. Overrides built-in defaults.
  // Built-in defaults: read=#2e7d32 (green), write=#c62828 (red),
  //   edit=#e65100 (orange), bash=#7b1fa2 (purple)
  // Tools not listed here (and not built-in) get random vibrant colors.
  "tool_colors": {
    "my_custom_tool": "#1565c0",
    "pure_cron": "#00838f"
  }
}
```

### Available Segments

| Segment | Description | Key Options |
|---------|-------------|-------------|
| `pi` | Pi logo | `style` |
| `model` | Model name + thinking level | `style`, `show_thinking_level`, `symbol` |
| `path` | Working directory | `style`, `mode` (basename/abbreviated/full), `max_length` |
| `git` | Branch + staged/unstaged/untracked | `branch_style`, `dirty_branch_style`, `staged_style`, `unstaged_style`, `untracked_style`, `show_branch`, `show_staged`, `show_unstaged`, `show_untracked` |
| `thinking` | Thinking level indicator | `style` |
| `token_in` | Input tokens | `style` |
| `token_out` | Output tokens | `style` |
| `token_total` | Total tokens | `style` |
| `cost` | Session cost | `style` |
| `context_pct` | Context window % | `style`, `warn_style`, `error_style`, `warn_threshold`, `error_threshold`, `show_auto_icon` |
| `context_total` | Context window size | `style` |
| `cache_read` | Cache read tokens | `style` |
| `cache_write` | Cache write tokens | `style` |
| `separator` | Visual separator | `text` (custom separator string) |
| `tools` | Tool list with counts | `style`, `dim_style`, `max_tools`, `show_icon`, `sort_by` |
| `tool_counter` | Tool usage pills | `label`, `label_style`, `pill_text_style`, `palette`, `max_tools`, `show_on_empty`, `sort_by`, `waiting_text` |
| `tool_total_uses` | Total tool invocations | `style` |
| `text:...` | Inline custom text | e.g. `text:Hello World` |

### Default Color Palette

| Key | Default | Used by |
|-----|---------|---------|
| `model` | `accent` | model |
| `path` | `text` | path |
| `git_clean` | `success` | git (clean branch) |
| `git_dirty` | `warning` | git (dirty branch) |
| `git_staged` | `success` | git (+N indicator) |
| `git_unstaged` | `warning` | git (*N indicator) |
| `git_untracked` | `muted` | git (?N indicator) |
| `context` | `dim` | context_pct, context_total |
| `context_warn` | `warning` | context_pct (above warn threshold) |
| `context_error` | `error` | context_pct (above error threshold) |
| `tokens` | `muted` | token_in, token_out, token_total, cache_read, cache_write |
| `cost` | `text` | cost |
| `tools` | `accent` | tools |
| `tools_dim` | `muted` | tools (counts), tool_total_uses |
| `separator` | `dim` | separator |
| `thinking_minimal` | `thinkingMinimal` | thinking (per Pi theme) |
| `thinking_low` | `thinkingLow` | thinking |
| `thinking_medium` | `thinkingMedium` | thinking |
| `thinking_high` | `thinkingHigh` | thinking |
| `thinking_xhigh` | `thinkingXhigh` | thinking |

### Icon Overrides

Override any segment's icon by setting `symbol` in the segment config:

```json
{
  "segments": {
    "model": { "symbol": "🤖 " },
    "git": { "symbol": "🌿 " },
    "path": { "symbol": "" }
  }
}
```

Set `"symbol": "none"` to hide an icon entirely.

### Theme Integration

The statusline uses Pi's `theme.fg(token, text)` API for all colors. This means:

- Any Pi theme (built-in, custom, or set by pure-theme) is followed automatically
- No dependency on pure-theme or any other extension
- Override a default token with a hex color to pin it regardless of theme
- Override a default token with a different Pi token to change the mapping

## Sources / Inspiration

- [Starship](https://starship.rs/) — per-module config, color palettes, symbol overrides
- [Powerline](https://github.com/powerline/powerline) — original powerline segment concept
- Originally part of `pure-status` (split into `pure-statusline` + `pure-vibes`)
