# Pi development instructions

Guidance for working on Pi extensions, themes, and the Pi agent itself.

## Pi docs — always read first

When working on Pi internals, read the Pi docs before implementing:
- Main: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/README.md`
- Docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
- Examples: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/`
- Follow any linked `.md` files in those docs.

## Local paths

- Extensions: `~/.pi/agent/extensions/`
- Themes: `~/.pi/agent/themes/`
- Agent settings: `~/.pi/agent/settings.json`
- Custom models: `~/.pi/agent/models.json` (hot-reloads on `/model` open)

## Extension API gotchas

These differ from what the docs suggest:

- **`DynamicBorder`** — import from `@mariozechner/pi-coding-agent`, NOT `@mariozechner/pi-tui`. Must be a runtime import.
- **`ctx.ui.custom()` keybindings** — 3rd param is a `KeybindingsManager`. Use `kb.matches(data, "tui.select.up")` with full namespace IDs (`tui.select.up/down/confirm/cancel`), NOT bare names like `selectUp`.
- **Session events** — only `session_start`, `session_shutdown`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_compact`, `session_before_tree`, `session_tree`. No `session_switch` or `session_fork`.
- **`complete()` from `@mariozechner/pi-ai`** — returns errors as response objects, does NOT throw. Check `.error` on the result.
- **`pi.getSessionName()`** — only reflects names set via `pi.setSessionName()` in memory. Returns `undefined` if no extension has set it, even if the session has a name on disk.

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

## Validation

- After changes, validate TypeScript by loading with Pi's Jiti/runtime.
- Run syntax/runtime checks on executable or TypeScript files.
- Fix all warnings and errors before finishing.
- If removing metrics/UI elements, also remove related shortcuts, help text, and unused code paths.
