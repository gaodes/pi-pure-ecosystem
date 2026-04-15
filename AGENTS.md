# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

This is the **development workspace**. Extensions are sourced as a git package (`git:github.com/gaodes/pi-pure-ecosystem` in global settings). Pi clones the repo and loads extensions from there.

**Workflow**: determine activation tier → move globally-active extensions to local settings if needed → develop in `extensions/` → check/lint/format → auto-commit → push to GitHub when a feature is complete or at user request → restore globally-active extensions to global settings → `pi update` or `/reload` in Pi.

## Pi docs — always read first

When working on Pi internals, read the Pi docs before implementing:

- Main: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/README.md`
- Docs: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
- Examples: `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/examples/`
- Follow any linked `.md` files in those docs.

## Pi dev kit — project scope

Forked from [`@aliou/pi-dev-kit`](https://www.npmjs.com/package/@aliou/pi-dev-kit), the **pure-devkit** extension provides tools, commands, and skills for building Pi extensions.

**Always use these tools** instead of manual discovery:

| Tool | Purpose |
|------|----------|
| `pi_docs` | List Pi documentation files (README, docs/, examples/) |
| `pi_changelog` / `pi_changelog_versions` | Read Pi changelog entries (local or fetch from GitHub) |
| `pi_version` | Get the currently running Pi version |
| `detect_package_manager` | Detect the project's package manager |

**Skills**:
- `pi-extension` — comprehensive reference (12 reference files) for creating, updating, and publishing extensions. Read the skill's reference files before implementing new extensions or making significant changes.
- `create-pure-extension` — fork-based and from-scratch workflows for creating pure-* extensions.
- `demo-setup` — set up demo environments for recording extension previews.

**Command**: `/devkit [VERSION]` — guided workflow to update Pi extensions to a target version.

## Project structure

```
pi-pure-ecosystem/
├── .pi/
│   └── settings.json       # Project settings + local pkg refs for in-testing extensions
├── extensions/              # ← develop extensions here (canonical source)
│   ├── global/              # ← loaded globally only (package filter)
│   │   └── pure-<name>/
│   ├── project/             # ← loaded per-project (opt-in via project settings)
│   │   └── pure-<name>/
│   ├── workspace/            # ← loaded per-workspace (opt-in via project settings)
│   │   └── pure-<name>/
│   └── shared/               # ← loaded by all scopes
│       └── pure-<name>/
├── themes/                   # ← loaded globally via package filter
├── biome.json                # Linter/formatter config
├── .gitignore
├── AGENTS.md
└── README.md
```

### Extension scope layout

Package filtering controls what loads where (in `settings.json`):

```json
// Global (~/.pi/agent/settings.json) — baseline globally-active extensions
{
  "packages": [
    {
      "source": "git:github.com/gaodes/pi-pure-ecosystem",
      "extensions": [
        "extensions/global/pure-cron/index.ts",
        "extensions/global/pure-github/index.ts",
        "extensions/global/pure-model-switch/index.ts",
        "extensions/global/pure-sessions/index.ts",
        "extensions/global/pure-theme/index.ts",
        "extensions/global/pure-updater/index.ts"
      ]
    }
  ]
}
```

```json
// Project (<project>/.pi/settings.json) — locally-active extensions
{
  "packages": [
    "../extensions/global/pure-statusline",
    "../extensions/global/pure-vibes",
    "../extensions/project/pure-devkit"
  ]
}
```

> **Package filters must match files, not directories.** Use `extensions/<scope>/*/index.ts` in `settings.json` package filters so Pi finds the extension entry points.
>
> **The `package.json` `pi.extensions` manifest requires explicit file paths.** Directory paths and globs are not reliably resolved in the manifest (per upstream convention). List every `index.ts` explicitly, just like `tmustier/pi-extensions` and other published packages:
> ```json
> "pi": {
>   "extensions": [
>     "./extensions/global/pure-cron/index.ts",
>     "./extensions/global/pure-theme/index.ts"
>   ]
> }
> ```
>
> The package filter in `settings.json` then narrows down which scopes are actually loaded.

Each `pure-<name>/` directory contains:

```
├── index.ts         # Extension entry point
├── CHANGELOG.md     # GitHub-style changelog
├── README.md        # Docs + Sources/Inspiration section
├── package.json     # ONLY if npm dependencies needed
└── ...
```

Global (live git package):

```
~/.pi/agent/
├── extensions/              # ← empty (extensions loaded from git package)
├── git/
│   └── github.com/gaodes/pi-pure-ecosystem/   # ← cloned by pi install
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

| Extension              | Tool            | Command       | Purpose                                                           |
| --------------------- | --------------- | ------------- | ----------------------------------------------------------------- |
| `pure-cron`           | `pure_cron`     | `/cron`  | Schedule recurring/one-shot agent prompts                         |
| `pure-devkit`         | `pi_docs`, `pi_version`, `pi_changelog`, `pi_changelog_versions`, `detect_package_manager` | `/devkit` | Tools and skills for Pi extension development |
| `pure-github`         | `github_repo`, `github_issue`, `github_pr`, `github_workflow` | *(planned)* `/gh-status`, `/gh-pr-create`, `/gh-pr-fix`, `/gh-pr-merge` | GitHub PR/repo/workflow tools |
| `pure-model-switch`   | `switch_model`  | —             | List, search, and switch models with aliases                      |
| `pure-sessions`       | —               | `/sesh`       | Auto-name sessions, browse/resume/rename                          |
| `pure-statusline`     | —               | `/statusline` | Configurable multi-line footer with segments, tool counters       |
| `pure-theme`          | —               | `/theme`      | Sync theme with system dark/light mode                            |
| `pure-updater`        | —               | `/update`     | Check for pi updates, prompt on new versions, install and restart |
| `pure-vibes`          | —               | `/vibe`       | AI-generated themed working messages                              |

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

> Note: biome is configured to only lint extension entry points and source files under `extensions/{global,project,workspace,shared}/*/`.

### What to fix vs suppress

- **Fix**: all errors and warnings that point to real issues (unused vars, parse errors, wrong radix, etc.)
- **`noExplicitAny` and `noNonNullAssertion` disabled project-wide** in `biome.json` — these are inherent to Pi extensions that interface with dynamic APIs where types aren't fully exported.
- **Fix all errors before syncing** — zero errors required. Warnings are acceptable with inline suppressions.

### Full validation checklist

After developing an extension, before considering the task done:

1. `biome check extensions/` — zero errors
2. Update `CHANGELOG.md` with changes
3. Update `README.md` if behavior changed
4. **Ensure the extension is listed in the root `package.json` `pi.extensions` manifest** (all extensions must be explicit)
5. Only include a per-extension `package.json` if it has npm dependencies
6. Test locally (see development workflow below)
7. Commit after each significant logical change
8. **Push when a feature is complete or at user request**
9. Keep `~/.pi/agent/settings.json` and `.pi/settings.json` in sync with the base state
10. Push → `pi update` or `/reload` in Pi to verify

When implementing new extensions or major changes, use the `pi-extension` skill's reference files for best practices and patterns.

## Development workflow

Extensions are developed in `extensions/<scope>/pure-<name>/` at the project root. Every extension is tracked in Git and listed in the root `package.json` manifest. Activation is controlled by whether an extension is referenced in the **global** `~/.pi/agent/settings.json` (git package) or the **local** `.pi/settings.json` (source path).

> **No copying needed.** Pi loads extensions directly from their source directory via local path references in `.pi/settings.json`. Edit → `/reload` → test. Instant iteration.

### Base state

The current setup has two activation tiers. The agent must know which tier an extension belongs to before making changes.

**Globally active** — loaded from the git package in `~/.pi/agent/settings.json`:
- `pure-cron`
- `pure-github`
- `pure-model-switch`
- `pure-sessions`
- `pure-theme`
- `pure-updater`

**Locally active** — loaded from source paths in `.pi/settings.json`:
- `pure-statusline`
- `pure-vibes`
- `pure-devkit`

### Extension scopes

Before creating an extension, decide its scope. Scope determines where it lives and when it loads:

| Scope | Directory | Loads when | Use for |
|-------|-----------|------------|----------|
| `global` | `extensions/global/` | Always (in every session) | Tools, commands, and behavior needed everywhere |
| `project` | `extensions/project/` | When opted in via project `.pi/settings.json` | Development tooling specific to a project |
| `workspace` | `extensions/workspace/` | When opted in via project `.pi/settings.json` | Shared workspace utilities |
| `shared` | `extensions/shared/` | Always (loaded alongside global) | Utilities used by all scopes |

Most extensions are `global`. Use `project` for tools that only make sense in a specific repo (like a dev-kit). Use `shared` for common utilities that other extensions might also need.

### 1. Create (new extension)

1. **Choose the scope** (see table above).
2. Create `extensions/<scope>/pure-<name>/index.ts` (or fork into it).
3. **Add to `package.json` manifest**: append `"./extensions/<scope>/pure-<name>/index.ts"` to `pi.extensions`.
4. Add a local path reference in `.pi/settings.json` so Pi loads the extension directly from source:

```json
{
  "packages": [
    "../extensions/<scope>/pure-<name>"
  ]
}
```

   Paths are relative to the settings file (`.pi/settings.json`), so `../` reaches the project root.

5. `/reload` in Pi and test.
6. When stable and the user wants it globally active, move it from `.pi/settings.json` to `~/.pi/agent/settings.json`, commit, and push.

### 2. Develop & iterate

Edit files in `extensions/<scope>/pure-<name>/`, then `/reload` in Pi. The extension loads directly from source — no copy step needed. Repeat until stable.

### 2b. Smoke test

After making changes, **always smoke-test in a separate Pi process** to catch crashes without risking your working session:

```bash
pi -p "reply with just the word ok" 2>&1 | tail -20
```

Run this from the project directory so `.pi/settings.json` loads local extensions. Check the output for:
- **Extension load errors** (TypeError, SyntaxError, missing imports) — these crash before the prompt runs
- **Exit code** — non-zero means something broke
- **The word `ok`** in output — confirms the agent actually started and responded

If there are errors, fix them before continuing. Do not rely on `/reload` alone — it may silently skip broken extensions.

### 3. Check & fix

```bash
biome check --write extensions/   # auto-fix
```

Zero errors required. Warnings acceptable with inline suppressions.

### 4. Working on an existing extension

**Before editing**, determine the extension's activation tier:

- **Globally active** (listed in `~/.pi/agent/settings.json`):
  1. Remove it from `~/.pi/agent/settings.json`.
  2. Add it to `.pi/settings.json`.
  3. `/reload` and develop.

- **Locally active** (already in `.pi/settings.json`, e.g. `pure-statusline`, `pure-vibes`, `pure-devkit`):
  1. It is already loading from source — edit directly.
  2. `/reload` and develop.

**When finished**:

- **If it was globally active**: Remove it from `.pi/settings.json`, add it back to `~/.pi/agent/settings.json`, commit, and push.
- **If it was locally active** (baseline): Keep it in `.pi/settings.json` as the default. For temporary local extensions, remove from `.pi/settings.json` when done.

### 5. Publish

- **Commit** after every significant logical change.
- **Push** when a feature is complete or at user request.
- Always restore globally active extensions to `~/.pi/agent/settings.json` before pushing, and keep the local baseline (`pure-statusline`, `pure-vibes`, `pure-devkit`) in `.pi/settings.json`.

Then `pi update` or `/reload` in Pi to verify.
