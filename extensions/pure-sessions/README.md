# pure-sessions

Automatically generate descriptive, emoji-prefixed session names for [Pi](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent) using LLM models. Falls back to deterministic Sci-Fi/Space/Tech/Mythology-themed readable IDs when models are unavailable.

## Features

- 🤖 **LLM-powered naming** — generates specific, contextual titles from conversation content
- 🔥 **Auto emoji** — picks relevant emoji from LLM response or keyword matching
- 🔄 **Model fallback chain** — primary → fallback → deterministic readable ID
- 📝 **Conversation-aware regen** — `/sesh regen` analyzes the full conversation including tool calls and files
- 🗂️ **Session browser** — interactive TUI overlay to browse, resume, rename, and delete sessions
- 🏷️ **Project prefix** — auto-detects git repo name or custom prefix
- 🎲 **Themed word lists** — Sci-Fi, Space, Tech, Mythology deterministic names
- ⚙️ **Fully configurable** — prompts, models, emoji, word lists, prefixes

## Commands

| Command | Description |
|---|---|
| `/sesh` | Browse sessions for the current project (interactive TUI) |
| `/sesh all` | Browse sessions across all projects |
| `/sesh info` \| `/sesh ls` | Show current session name and file |
| `/sesh regen` | Regenerate name from full conversation |
| `/sesh rename My Title` | Set a custom name with prefix + emoji formatting |
| `/sesh config` | Show current configuration |
| `/sesh init` | Create a `pure-sessions.json` config file |
| `/sesh test` | Test model resolution (shows which model would be used) |

### Session Browser Keybindings

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate sessions |
| `Enter` | Resume selected session |
| `d` | Delete selected session |
| `n` | Rename current session |
| `Tab` | Toggle between current project / all projects |
| `Esc` | Close browser |

## How It Works

### Auto-naming flow

1. **`before_agent_start`** — immediately names from the first user message (fast, lightweight)
2. **`agent_end`** — if not yet named, generates from the full conversation summary with tool calls and files
3. **`/sesh regen`** — full conversation analysis with richest context (user messages, assistant responses, tool calls, file paths)

### Model fallback chain

```
Primary model (config.model)
  → Fallback model (config.fallbackModel)
    → Deterministic readable ID (config.fallbackDeterministic)
```

### Emoji resolution

When `emoji: true`, a three-tier system picks the best emoji:

1. **LLM-generated** — the model includes an emoji in its response
2. **Keyword-based** — matches words in the title (fix→🐛, add→✨, deploy→🚀, etc.)
3. **Default** — 📌 if nothing matches

### Session name format

```
<prefix>: <emoji> <title> [suffix]

Examples:
  my-project: 🐛 Fix useAuth Hook Memory Leak
  api-server: ✨ Add Docker Compose Setup
  .pi: 🔍 Debug LLM Response Parsing
```

## Configuration

Create `pure-sessions.json` in your project root, `.pi/` directory, or `~/.pi/agent/`:

```json
{
  "$schema": "./extensions/pure-sessions/pure-sessions.schema.json",
  "model": { "provider": "minimax-custom", "id": "MiniMax-M2.1" },
  "fallbackModel": { "provider": "zai", "id": "glm-4.5-air" },
  "fallbackDeterministic": "readable-id",
  "emoji": true,
  "enabled": true
}
```

### All options

| Option | Type | Default | Description |
|---|---|---|---|
| `model` | `{provider, id}` | `null` (auto) | Primary LLM model for name generation |
| `fallbackModel` | `{provider, id}` | `null` | Fallback model if primary fails |
| `fallbackDeterministic` | `"readable-id"` \| `"truncate"` \| `"words"` \| `"none"` | `"readable-id"` | Deterministic fallback when all models fail |
| `modelSelection` | `"current"` \| `"cheapest"` | `"current"` | Auto-selection strategy when no model is configured |
| `prompt` | `string` | *(see defaults)* | Prompt template for auto-naming. Use `{{query}}` as placeholder |
| `regenPrompt` | `string` | *(see defaults)* | Prompt template for `/sesh regen`. Receives full conversation summary |
| `prefix` | `string` | `""` | Static prefix for session names |
| `prefixCommand` | `string` | `"basename $(git rev-parse --show-toplevel 2>/dev/null \|\| pwd)"` | Shell command to generate prefix |
| `prefixOnly` | `boolean` | `false` | Skip LLM, use only prefix as name |
| `emoji` | `boolean` \| `string` | `false` | `true` = auto emoji, `false` = no emoji, `"🚀"` = fixed emoji |
| `readableIdSuffix` | `boolean` | `false` | Append `[readable-id]` suffix to LLM names |
| `readableIdEnv` | `string` | `"PI_SESSION_READABLE_ID"` | Env var for readable ID override |
| `maxQueryLength` | `integer` | `2000` | Max chars of query sent to LLM |
| `maxNameLength` | `integer` | `80` | Max chars for generated name |
| `regenMaxChars` | `integer` | `4000` | Max chars of conversation summary for `/sesh regen` |
| `wordlistPath` | `string` | *(bundled)* | Path to custom TOML word list |
| `wordlist` | `{adjectives, nouns}` | *(bundled)* | Inline word list |
| `enabled` | `boolean` | `true` | Enable/disable the extension |
| `debug` | `boolean` | `false` | Show debug notifications |

## Word Lists

The bundled word list (`wordlist/word_lists.toml`) contains **210 adjectives** and **394 nouns** from curated Sci-Fi, Space, Tech, and Mythology themes — generating **72,450** unique deterministic session names.

Examples: `warp-nebula-saber`, `borg-rune-forge`, `quantum-phoenix-node`

### Regenerate word lists

```bash
cd ~/.pi/agent/extensions/pure-sessions

# Generate topic-based lists (default)
python3 scripts/generate_word_lists.py --output wordlist

# Generate generic WordNet-based lists
python3 scripts/generate_word_lists.py --generic --output wordlist

# Choose specific topics
python3 scripts/generate_word_lists.py --topic-list "sci-fi,tech" --output wordlist

# Both
python3 scripts/generate_word_lists.py --output wordlist
```

Available topics: `sci-fi`, `space`, `tech`, `mythology`

Requires: `pip install nltk wordfreq`

## File Structure

```
pure-sessions/
├── index.ts                    # Extension source
├── pure-sessions.schema.json   # JSON schema for config validation
├── wordlist/
│   └── word_lists.toml         # Themed word lists
└── scripts/
    └── generate_word_lists.py  # Word list generator
```

## License

MIT

## Sources / Inspiration

- **[byteowlz/pi-auto-name-sessions](https://github.com/byteowlz/pi-auto-name-sessions)** — LLM auto-naming concept and model fallback chain pattern
- **[victor-software-house/pi-session-manager](https://github.com/victor-software-house/pi-session-manager)** — Session browser TUI, resume/delete/rename UX
- **[badlogic/pi-mono](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent)** — The Pi coding agent this extension is built for
