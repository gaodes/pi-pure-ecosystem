# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

This is the **development workspace**. Extensions are built and tested here, then synced to `~/.pi/agent/extensions/` for Pi to load via global auto-discovery.

**Workflow**: develop in `extensions/` → check/lint/format → test locally in `.pi/extensions/` → restore global → ask user approval → promote to global → `/reload` in Pi.

## Pi docs — always read first

When working on Pi internals, read the Pi docs before implementing:

- Main: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/README.md`
- Docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
- Examples: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/`
- Follow any linked `.md` files in those docs.

## Pi dev kit — installed globally

[`@aliou/pi-dev-kit`](https://www.npmjs.com/package/@aliou/pi-dev-kit) provides tools, commands, and a skill for building Pi extensions.

**Always use these tools** instead of manual discovery:

| Tool | Purpose |
|------|----------|
| `pi_docs` | List Pi documentation files (README, docs/, examples/) |
| `pi_changelog` / `pi_changelog_versions` | Read Pi changelog entries (local or fetch from GitHub) |
| `pi_version` | Get the currently running Pi version |
| `detect_package_manager` | Detect the project's package manager |

**Skill**: `pi-extension` — comprehensive reference for creating, updating, and publishing extensions. Read the skill's reference files before implementing new extensions or making significant changes.

**Command**: `/extensions:update [VERSION]` — guided workflow to update Pi extensions to a target version.

## Project structure

```
pi-pure-ecosystem/
├── .pi/
│   ├── settings.json       # Project settings (no extension loading — globals only)
│   └── extensions/          # ← test location (temporary, cleaned up after testing)
├── extensions/              # ← develop extensions here (canonical source)
│   └── pure-<name>/
│       ├── index.ts         # Extension entry point
│       ├── CHANGELOG.md     # GitHub-style changelog
│       ├── README.md        # Docs + Sources/Inspiration section
│       ├── package.json     # ONLY if npm dependencies needed
│       └── ...
├── biome.json               # Linter/formatter config
├── .gitignore
├── AGENTS.md
└── README.md
```

Global (live extensions):

```
~/.pi/agent/
├── extensions/              # ← synced from project for Pi to load
│   ├── pure-cron/
│   ├── pure-sessions/
│   ├── pure-theme/
│   └── pure-updater/
├── themes/
│   ├── catppuccin-frappe.json
│   └── catppuccin-latte.json
├── settings.json
└── models.json
```

## Design philosophy

- **Simplicity first** — do the simplest thing that works. Avoid over-engineering, abstraction layers, or premature generalization. A 300-line `index.ts` beats a 10-file module split.
- **Pi APIs before everything else** — use what Pi provides before reaching for npm packages or Node.js builtins:
  - `pi.exec()` instead of `child_process`
  - `getAgentDir()` instead of `homedir()` + hardcoded paths
  - `ctx.ui.notify()` / `ctx.ui.custom()` instead of `console.log`
  - `@sinclair/typebox` for schemas (already bundled by Pi)
  - `@mariozechner/pi-tui` components before building custom UI
  - `@mariozechner/pi-ai` `complete()` before fetching an LLM API directly
- **Minimal dependencies** — only add an npm package when Pi genuinely doesn't provide the capability (e.g. `croner` for cron parsing, `nanoid` for IDs). Every dependency is a maintenance cost.
- **No build step** — Pi loads `.ts` via Jiti at runtime. No compilers, no bundlers, no tsconfig.
- **Project overrides global** — when a project-level config file exists (at `<project>/.pi/pure/{config,cache}/pure-<name>.json`), it takes precedence over the global one (at `~/.pi/agent/pure/{config,cache}/pure-<name>.json`). Extensions always check project first, fall back to global. This lets projects customize extension behavior without affecting the user's global setup.
- **Self-contained, ecosystem-ready** — each extension is one directory with no cross-extension dependencies. Copy it anywhere and it works standalone. When part of the pure ecosystem, it integrates seamlessly through shared conventions: `pure-<name>` naming, `~/.pi/agent/pure/{config,cache}/` storage, `pure.<name>.*` settings namespace, and consistent README/CHANGELOG format.

## Extensions

| Extension         | Tool        | Command       | Purpose                                                           |
| ----------------- | ----------- | ------------- | ----------------------------------------------------------------- |
| `pure-cron`       | `pure_cron` | `/pure-cron`  | Schedule recurring/one-shot agent prompts                         |
| `pure-sessions`   | —           | `/sesh`       | Auto-name sessions, browse/resume/rename                          |
| `pure-statusline` | —           | `/statusline` | Configurable multi-line footer with segments, tool counters       |
| `pure-theme`      | —           | `/theme`      | Sync theme with system dark/light mode                            |
| `pure-updater`    | —           | `/update`     | Check for pi updates, prompt on new versions, install and restart |
| `pure-vibes`      | —           | `/vibe`       | AI-generated themed working messages                              |

### Extension conventions

- **Name**: `pure-<name>` (directory, config file, widget ID, message type, storage paths)
- **Tool/command names**: avoid the `pure-` prefix when a better name exists. Use `pure_<name>` or `/pure-<name>` only as a fallback — prefer short, descriptive names (e.g. `/sesh` over `/pure-sessions`, `/theme` over `/pure-theme`).
- **Structure**: single `index.ts` entry point. Keep everything in one file — split only when there's a clear benefit (readability, reuse across extensions). Pure-cron is the threshold example where splitting becomes worth considering.
- **package.json**: only include when the extension has npm dependencies (e.g. `pure-cron` needs `croner` + `nanoid`). Zero-dependency extensions omit it entirely — Pi auto-discovers `*/index.ts` regardless. Adding it back later is trivial if deps are needed.
- **Self-contained**: each extension has its own inline path helpers — no cross-extension dependencies.
- **TypeBox schemas**: use `@sinclair/typebox` (`Type`, `Static`) for tool parameter validation.
- **Settings namespace**: `pure.<name>.*` in `~/.pi/agent/settings.json` (e.g. `pure.cron.widget_show_default`, `pure.theme.sync_on_start`).
- **Data storage** (unified layout): All pure-* extensions use the same directory structure via inline path helpers:
  - Global: `~/.pi/agent/pure/{config,cache}/pure-<name>.json`
  - Project: `<project>/.pi/pure/{config,cache}/pure-<name>.json`
  - `config/` = user-edited persistent settings. `cache/` = machine-generated, regeneratable.
  - **Project overrides global.** The canonical resolution pattern: read project config first — if it exists, use it; otherwise fall back to global. This applies to all config reads. Cache reads follow the same pattern when it makes sense (e.g. classification caches may be project-specific).
  - Config files use the same schema at both scopes — a project config is a drop-in replacement for the global one, not a patch. Users can copy the global file to `.pi/pure/config/` and customize it.
  - Scaffold the global config on first load if it doesn't exist (so users know where to edit). Never scaffold project config — that's opt-in.
  - Auto-migration from old flat paths on first load.
- **Config files**: `pure-<name>.json` stored via inline path helpers (see above).
- **CHANGELOG.md**: every extension directory must include a GitHub-style changelog (`## [version] - YYYY-MM-DD` entries). Update it when adding features, fixing bugs, or making breaking changes.
- **README.md**: every extension directory must include a README with a description, usage, and a **Sources / Inspiration** section linking to or citing any projects, articles, APIs, or ideas that inspired the extension. For forked extensions, include the upstream repo URL — this is the **primary source** used to check for upstream updates.

### Creating new extensions

Read the local skill `.pi/skills/create-pure-extension/SKILL.md` when creating, forking, or scaffolding a new extension. It covers both fork-based and from-scratch workflows with step-by-step instructions.

## Local paths

- Extensions: `~/.pi/agent/extensions/`
- Themes: `~/.pi/agent/themes/`
- Agent settings: `~/.pi/agent/settings.json`
- Custom models: `~/.pi/agent/models.json` (hot-reloads on `/model` open)

## Key Pi API packages

| Package                         | What it provides                          | Common imports                                              |
| ------------------------------- | ----------------------------------------- | ----------------------------------------------------------- |
| `@mariozechner/pi-coding-agent` | Extension API, DynamicBorder, getAgentDir | `ExtensionAPI`, `ExtensionContext`, `DynamicBorder`         |
| `@mariozechner/pi-ai`           | LLM calls, model types                    | `complete()`, `Api`, `Model`, `StringEnum`                  |
| `@mariozechner/pi-tui`          | Terminal UI components                    | `Container`, `Text`, `SelectList`, `SettingsList`, `Spacer` |
| `@sinclair/typebox`             | JSON schema / type validation             | `Type`, `Static`                                            |

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

## Check, format, and lint

**Tool**: [Biome](https://biomejs.dev/) — installed globally (`npm install -g @biomejs/biome`). Config in `biome.json`.

Run these **after finishing development** on any extension, before syncing to global:

```bash
# Check everything (format + lint + import sorting):
biome check extensions/

# Auto-fix safe fixes:
biome check --write extensions/

# Auto-fix all fixes (including unsafe):
biome check --write --unsafe extensions/

# Format only:
biome format --write extensions/

# Lint only:
biome lint extensions/
```

### What to fix vs suppress

- **Fix**: all errors and warnings that point to real issues (unused vars, parse errors, wrong radix, etc.)
- **`noExplicitAny` and `noNonNullAssertion` disabled project-wide** in `biome.json` — these are inherent to Pi extensions that interface with dynamic APIs where types aren't fully exported.
- **Fix all errors before syncing** — zero errors required. Warnings are acceptable with inline suppressions.

### Full validation checklist

After developing an extension, before considering the task done:

1. `biome check extensions/` — zero errors
2. Update `CHANGELOG.md` with changes
3. Update `README.md` if behavior changed
4. Only include `package.json` if extension has npm dependencies
5. Test locally (see development workflow below)
6. Ask user for approval before promoting to global
7. Promote: `cp -R extensions/pure-<name>/* ~/.pi/agent/extensions/pure-<name>/`
8. `/reload` in Pi and verify the extension loads without errors

When implementing new extensions or major changes, use the `pi-extension` skill's reference files for best practices and patterns.

## Development workflow

Extensions are developed in `extensions/pure-<name>/` at the project root. This is the **canonical source** — always sync from here to global, never the reverse.

### 1. Develop

Edit files in `extensions/pure-<name>/`. No build step — Pi loads `.ts` via Jiti at runtime. `npm install` only needed for native dependencies (e.g. `croner`, `nanoid`).

### 2. Check & fix

```bash
biome check --write extensions/   # auto-fix
```

Zero errors required. Project-wide disabled rules (`noExplicitAny`, `noNonNullAssertion`) are already handled in `biome.json`; other warnings should be fixed unless there is a strong reason not to.

### 3. Test locally

Copy the extension to `.pi/extensions/` for Pi to load it at project level. **Always disable the global copy first** to avoid conflicts:

```bash
# Disable global copy (move to _disabled)
mv ~/.pi/agent/extensions/pure-<name> ~/.pi/agent/extensions/_disabled/pure-<name>

# Install local test copy
cp -R extensions/pure-<name> .pi/extensions/pure-<name>
```

Then `/reload` in Pi and test. The extension loads from `.pi/extensions/` (project-level auto-discovery).

### 4. Restore global after testing

```bash
# Remove test copy
rm -rf .pi/extensions/pure-<name>

# Re-enable global copy
mv ~/.pi/agent/extensions/_disabled/pure-<name> ~/.pi/agent/extensions/pure-<name>
```

Then `/reload` in Pi.

### 5. Promote to global (requires user approval)

Only after the user explicitly approves:

```bash
cp -R extensions/pure-<name>/* ~/.pi/agent/extensions/pure-<name>/
```

Then `/reload` in Pi and verify the extension loads without errors.
