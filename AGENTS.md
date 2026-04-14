# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

This repo is the **version-control and documentation** layer. The live extensions run from `~/.pi/agent/extensions/` (Pi's extension directory), not from this repo. Sync changes between them as needed.

## Pi docs — always read first

When working on Pi internals, read the Pi docs before implementing:
- Main: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/README.md`
- Docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
- Examples: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/`
- Follow any linked `.md` files in those docs.

## Project structure

```
~/.pi/agent/
├── extensions/
│   ├── pure-cron/        # Scheduled prompts (cron, intervals, one-shot)
│   ├── pure-sessions/    # LLM-powered session naming + session browser
│   ├── pure-theme/       # System dark/light theme sync + theme picker
│   └── _disabled/        # Stashed extensions (not loaded by Pi)
├── themes/
│   ├── catppuccin-frappe.json
│   └── catppuccin-latte.json
├── settings.json         # Pi agent settings (theme, models, compaction, LCM)
├── models.json           # Custom providers (minimax-custom)
└── pure-cron.json        # pure-cron job storage (auto-generated)
```

## Extensions

| Extension | Tool | Command | Purpose |
|---|---|---|---|
| `pure-cron` | `pure_cron` | `/pure-cron` | Schedule recurring/one-shot agent prompts |
| `pure-sessions` | — | `/sesh` | Auto-name sessions, browse/resume/rename |
| `pure-theme` | — | `/theme` | Sync theme with system dark/light mode |

### Extension conventions

- **Name**: `pure-<name>` (directory, tool, command, message type)
- **Structure**: single `index.ts` entry point. Split into modules only when the file grows unwieldy (pure-cron is the threshold example).
- **TypeBox schemas**: use `@sinclair/typebox` (`Type`, `Static`) for tool parameter validation.
- **Settings namespace**: `pure.<name>.*` in `~/.pi/agent/settings.json` (e.g. `pure.cron.widget_show_default`, `pure.theme.sync_on_start`).
- **Data storage**: `~/.pi/agent/pure-<name>.json` for extension state.
- **Config files**: `pure-<name>.json` in project root or `~/.pi/agent/` for per-project/global config (pure-sessions pattern).

## Local paths

- Extensions: `~/.pi/agent/extensions/`
- Themes: `~/.pi/agent/themes/`
- Agent settings: `~/.pi/agent/settings.json`
- Custom models: `~/.pi/agent/models.json` (hot-reloads on `/model` open)

## Key Pi API packages

| Package | What it provides | Common imports |
|---|---|---|
| `@mariozechner/pi-coding-agent` | Extension API, DynamicBorder, getAgentDir | `ExtensionAPI`, `ExtensionContext`, `DynamicBorder` |
| `@mariozechner/pi-ai` | LLM calls, model types | `complete()`, `Api`, `Model`, `StringEnum` |
| `@mariozechner/pi-tui` | Terminal UI components | `Container`, `Text`, `SelectList`, `SettingsList`, `Spacer` |
| `@sinclair/typebox` | JSON schema / type validation | `Type`, `Static` |

### `complete()` from pi-ai

- Signature: `complete(model, { messages }, { apiKey, maxTokens })`
- **Returns errors as response objects, does NOT throw.** Check `.error` on the result.

### `ctx.sessionManager` methods

- `getSessionFile()` — current session file path (used as session ID)
- `open(path)` — open/switch to a session (also used to rename non-current sessions)

### `pi.getSessionName()`

- Only reflects names set via `pi.setSessionName()` in memory.
- Returns `undefined` if no extension has set it, even if the session has a name on disk.

## Extension API gotchas

These differ from what the docs suggest:

- **`DynamicBorder`** — import from `@mariozechner/pi-coding-agent`, NOT `@mariozechner/pi-tui`. Must be a runtime import.
- **`ctx.ui.custom()` keybindings** — 3rd param is a `KeybindingsManager`. Use `kb.matches(data, "tui.select.up")` with full namespace IDs (`tui.select.up/down/confirm/cancel`), NOT bare names like `selectUp`.
- **Session events** — only `session_start`, `session_shutdown`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_compact`, `session_before_tree`, `session_tree`. No `session_switch` or `session_fork`.

## Custom UI (ctx.ui.custom)

- **Avoid overlay mode** — `{ overlay: true }` breaks terminal connections. Use plain `ctx.ui.custom()` without overlay options.
- **SelectList ghosting** — `SelectList` from `@mariozechner/pi-tui` in non-overlay mode can cause ghosting on scroll. Prefer `SettingsList` for simple list UIs, or test carefully.
- **SelectList navigation** — wraps around on up/down by default (cyclic). This is built-in behavior.

## Theme development

- Theme JSON must have all 51 required `colors` fields (`additionalProperties: false`).
- Color values: var references, hex strings, empty string (terminal default), or 0–255 integers.
- `vars` section accepts any string/int values via `additionalProperties`.
- Validate against schema: `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json`
- Use `ctx.ui.theme.fg("accent", "text")` for themed text rendering.
- Keep footer/UI changes consistent with the current theme and the user's requested density.

## Models configuration

- `models.json` supports custom providers: `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`.
- `apiKey` supports env var names, literal strings, or `!command` shell execution.
- Custom models on built-in providers merge by `id` (upsert).
- Use `compat` field for providers with partial OpenAI compatibility.
- Current custom providers: `minimax-custom` (MiniMax-M2.5, MiniMax-M2.1).

## Validation

- After changes, validate TypeScript by loading with Pi's Jiti/runtime.
- Run syntax/runtime checks on executable or TypeScript files.
- Fix all warnings and errors before finishing.
- If removing metrics/UI elements, also remove related shortcuts, help text, and unused code paths.

## Development workflow

1. **Edit** extension files directly in `~/.pi/agent/extensions/pure-<name>/`.
2. **Test** by restarting Pi (or using the session if hot-reload applies).
3. **Commit** to this repo when changes are stable — copy or sync from the extensions directory.
4. **No build step** — Pi loads `.ts` files via Jiti at runtime. `npm install` only needed for native dependencies (e.g. `croner`, `nanoid`).
