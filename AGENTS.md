# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

This is the **development workspace**. Extensions are sourced as a git package (`git:github.com/gaodes/pi-pure-ecosystem` in global settings). Pi clones the repo and loads extensions from there.

**High-level workflow**: determine activation tier → move globally-active extensions to local settings if needed → develop in `extensions/` → check/lint/format → commit → push to GitHub when a feature is complete or at user request → restore globally-active extensions to global settings → `pi update` or `/reload` in Pi.

> **For detailed step-by-step instructions** on creating, forking, updating, or promoting extensions, use the **`create-pure-extension`** skill.

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
- `pi-extension` — comprehensive reference (12 reference files) for creating, updating, and publishing extensions.
- `create-pure-extension` — fork-based and from-scratch workflows for creating pure-* extensions.
- `demo-setup` — set up demo environments for recording extension previews.

**Command**: `/devkit [VERSION]` — guided workflow to update Pi extensions to a target version.

## Project structure

```
pi-pure-ecosystem/
├── .pi/
│   └── settings.json       # Local source-path overrides
├── extensions/              # ← canonical source
│   ├── global/
│   │   └── pure-<name>/
│   ├── project/
│   │   └── pure-<name>/
│   ├── workspace/
│   │   └── pure-<name>/
│   └── shared/
│       └── pure-<name>/
├── themes/
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

> All extensions are tracked in Git and listed in the root `package.json` `pi.extensions` manifest from creation.

### Activation tiers (base state)

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

When working on an extension, if it is globally active, temporarily move it to `.pi/settings.json`. When finished, restore it to `~/.pi/agent/settings.json`.

## Design philosophy

- **Simplicity first** — a 300-line `index.ts` beats a 10-file module split.
- **Pi APIs before everything else** — use `pi.exec()`, `getAgentDir()`, `ctx.ui.notify()`, `@sinclair/typebox`, `@mariozechner/pi-tui`, and `complete()` before reaching for external packages or raw Node APIs.
- **Minimal dependencies** — only add npm packages when Pi genuinely lacks the capability.
- **No build step** — Pi loads `.ts` via Jiti at runtime.
- **Project overrides global** — project-level configs at `<project>/.pi/pure/{config,cache}/pure-<name>.json` take precedence over global ones at `~/.pi/agent/pure/{config,cache}/pure-<name>.json`.
- **Self-contained, ecosystem-ready** — each extension is one directory with no cross-extension dependencies.

## Extensions

| Extension              | Tool            | Command       | Purpose                                                           |
| --------------------- | --------------- | ------------- | ----------------------------------------------------------------- |
| `pure-cron`           | `pure_cron`     | `/cron`       | Schedule recurring/one-shot agent prompts                         |
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
- **Tool/command names**: prefer short descriptive names; fall back to `pure_<name>` or `/pure-<name>` only if nothing better fits.
- **Structure**: single `index.ts` entry point. Split only when readability clearly benefits.
- **package.json** (per-extension): only if npm dependencies are needed. Zero-dependency extensions omit it.
- **Self-contained**: inline path helpers, no cross-extension dependencies.
- **TypeBox schemas**: use `@sinclair/typebox` (`Type`, `Static`) for tool parameters.
- **Settings namespace**: `pure.<name>.*`
- **Storage paths**:
  - Global: `~/.pi/agent/pure/{config,cache}/pure-<name>.json`
  - Project: `<project>/.pi/pure/{config,cache}/pure-<name>.json`
- **Config reads**: project first, fall back to global.
- **Scaffold global config** on first load if missing. Never scaffold project config (opt-in).
- **Auto-migrate** from old flat paths on first load.
- **CHANGELOG.md**: GitHub-style (`## [version] - YYYY-MM-DD`). Update when behavior changes.
- **README.md**: must include a **Sources / Inspiration** section. For forked extensions, the first linked repo is the primary upstream source.

### Creating new extensions

Read the **`create-pure-extension`** skill for fork-based and from-scratch workflows. It covers interviewing, cloning upstream sources, renaming to pure-* conventions, adding inline path helpers, README/CHANGELOG scaffolding, local testing, and promotion.

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

- **`DynamicBorder`** — import from `@mariozechner/pi-coding-agent`, NOT `@mariozechner/pi-tui`. Must be a runtime import.
- **`ctx.ui.custom()` keybindings** — 3rd param is a `KeybindingsManager`. Use `kb.matches(data, "tui.select.up")` with full namespace IDs (`tui.select.up/down/confirm/cancel`), NOT bare names like `selectUp`.
- **Session events** — only `session_start`, `session_shutdown`, `session_before_switch`, `session_before_fork`, `session_before_compact`, `session_compact`, `session_before_tree`, `session_tree`. No `session_switch` or `session_fork`.

## Custom UI (ctx.ui.custom)

- **Avoid overlay mode** — `{ overlay: true }` breaks terminal connections.
- **SelectList ghosting** — can ghost on scroll in non-overlay mode; prefer `SettingsList` for simple lists, or test carefully.
- **SelectList navigation** — wraps around by default (cyclic).

## Theme development

- Theme JSON must have all 51 required `colors` fields (`additionalProperties: false`).
- Color values: var references, hex strings, empty string, or 0–255 integers.
- `vars` accepts any string/int values.
- Validate against schema: `https://raw.githubusercontent.com/badlogic/pi-mono/main/packages/coding-agent/src/modes/interactive/theme/theme-schema.json`
- Use `ctx.ui.theme.fg("accent", "text")` for themed text.

## Models configuration

- `models.json` supports custom providers: `openai-completions`, `openai-responses`, `anthropic-messages`, `google-generative-ai`.
- `apiKey` supports env var names, literal strings, or `!command` shell execution.
- Custom models on built-in providers merge by `id` (upsert).
- Current custom providers: `minimax-custom` (MiniMax-M2.5, MiniMax-M2.1).

## Check, format, and lint

**Tool**: [Biome](https://biomejs.dev/) — installed globally. Config in `biome.json`.

```bash
biome check --write --unsafe extensions/
```

Zero errors required. Warnings acceptable with inline suppressions.

### Full validation checklist

1. `biome check extensions/` — zero errors
2. Update `CHANGELOG.md`
3. Update `README.md` if behavior changed
4. Listed in root `package.json` `pi.extensions`
5. Only include per-extension `package.json` if deps are needed
6. Smoke-test (isolated subprocess): `pi -e "$PWD/extensions/<scope>/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5`
7. Commit after significant changes
8. Push when a feature is complete or at user request
9. Restore globally-active extensions to `~/.pi/agent/settings.json`
10. `pi update` or `/reload`

When implementing new extensions or major changes, read the `pi-extension` and `create-pure-extension` skills first.
