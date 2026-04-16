# Pure Vibes

AI-generated themed working messages for [Pi](https://github.com/badlogic/pi-mono) coding agent. Replaces the generic "Working..." message with creative, theme-aware messages during agent execution.

## Features

- **Themed working messages** — set a vibe theme and get contextual messages like "Scanning the continuum..." or "Rerouting plasma conduits..."
- **Two modes**: `generate` (AI generates unique messages on-the-fly) or `file` (pre-generated vibe files)
- **Working line** — shows vibe message, current tool, elapsed time, and thinking status
- **Batch generation** — pre-generate hundreds of vibes and save to disk
- **JSON config** — `~/.pi/agent/pure/config/pure-vibes.json`
- **Vibe files** — stored in `~/.pi/agent/vibes/<theme>.txt`

## Command

`/vibe` — manage working vibes:

| Subcommand | Description |
|---|---|
| (no args) | Show current vibe status |
| `<theme>` | Set vibe theme (e.g., `/vibe star trek`) |
| `off` | Disable vibes |
| `mode [generate\|file]` | Set vibe mode |
| `model <provider/model>` | Set model for AI generation |
| `generate [theme] [count]` | Generate vibes file |

## Configuration

Config file: `~/.pi/agent/pure/config/pure-vibes.json`

```json
{
  "theme": null,
  "mode": "generate",
  "model": "anthropic/claude-haiku-4-5",
  "fallback": "Working",
  "timeoutMs": 60000,
  "refreshIntervalSeconds": 30,
  "promptTemplate": "Generate a 2-4 word \"{theme}\" themed loading message ending with \"...\".\n\nTask: {task}\n\nBe creative and unexpected.\n{exclude}\nOutput only the message, nothing else.",
  "maxLength": 65
}
```

### Template Variables

- `{theme}` — the current vibe theme name
- `{task}` — the current task/prompt context
- `{exclude}` — recent vibes to avoid repeating

## Sources / Inspiration

- Inspired by the idea of making AI coding sessions more fun and personalized
- Originally part of `pure-status` (split into `pure-statusline` + `pure-vibes`)
- PRNG algorithm: [Mulberry32](https://gist.github.com/tommyettinger/46a8741893370a6dfe8e39e1d5cc2f54)
