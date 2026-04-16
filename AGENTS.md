# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

This is the **development workspace**. Extensions are sourced as a git package (`git:github.com/gaodes/pi-pure-ecosystem` in global settings). Pi clones the repo and loads extensions from there.

**High-level workflow**: use `/worktrees create` for new features → develop in the extension directory within the worktree → `/worktrees clean` when done → promote from main.

> **For Git operations**, use `pure-git` (`/worktrees` command). See its README for details.
> **For creating extensions**, use the `create-pure-extension` skill.

> **For detailed step-by-step instructions** on creating, forking, updating, or promoting extensions, use the **`create-pure-extension`** skill.

## Project structure

```
pi-pure-ecosystem/          # Main worktree (main branch, production-ready)
├── .pi/
│   └── settings.json       # Local source-path overrides
├── .worktrees/              # Feature worktrees (managed via /worktrees)
│   └── <feature>/          # Each worktree has the full mono repo
├── extensions/              # ← flat, all extensions here
│   └── pure-<name>/        # one directory per extension
├── themes/
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

### Activation tiers (base state)

**Globally active** — loaded from the git package in `~/.pi/agent/settings.json`:
- `pure-cron`, `pure-github`, `pure-model-switch`, `pure-sessions`, `pure-theme`, `pure-updater`

**Locally active** — loaded from source paths in `.pi/settings.json`:
- `pure-statusline`, `pure-vibes`, `pure-devkit`

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
| `pure-git`            | `switch_worktree`    | `/worktrees` | Git worktree management: create, list, clean, switch |
| `pure-github`         | `github_repo`, `github_issue`, `github_pr`, `github_workflow` | *(planned)* `/gh-status`, `/gh-pr-create`, `/gh-pr-fix`, `/gh-pr-merge` | GitHub PR/repo/workflow tools |
| `pure-model-switch`   | `switch_model`  | —             | List, search, and switch models with aliases                      |
| `pure-sessions`       | —               | `/sesh`       | Auto-name sessions, browse/resume/rename                          |
| `pure-statusline`     | —               | `/statusline` | Configurable multi-line footer with segments, tool counters       |
| `pure-theme`          | —               | `/theme`      | Sync theme with system dark/light mode                            |
| `pure-updater`        | —               | `/update`     | Check for pi updates, prompt on new versions, install and restart |
| `pure-vibes`          | —               | `/vibe`       | AI-generated themed working messages                              |

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
6. Smoke-test (isolated subprocess): `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5`
7. Commit after significant changes
8. Push when a feature is complete or at user request
9. Restore globally-active extensions to `~/.pi/agent/settings.json`
10. `pi update` or `/reload`

When implementing new extensions or major changes, read the relevant skill first: `create-pure-extension`, `import-pure-extension`, `update-pure-extension`, or `enhance-pure-extension`.

## Git Workflow (Mono Repo)

This is a **mono repo** — all extensions live in `extensions/`. Use Git worktrees for parallel development.

### Branch Naming

| Type | Pattern | Example |
|------|---------|--------|
| Feature | `<name>-<feature>` | `github-review`, `sessions-bookmarks` |
| Topic | `<type>/<description>` | `fix/cron-tz-bug`, `docs/api-examples` |

### Worktree Lifecycle

1. **Start**: `/worktrees create <branch-name>`
   - Creates branch from `main`
   - Creates worktree at `.worktrees/<branch-name>/`

2. **Develop**: `cd .worktrees/<branch-name>/extensions/pure-<name>/`
   - Work on the specific extension
   - Commit to the feature branch

3. **Finish**: `/worktrees clean <branch-name>`
   - Merges branch to `main`
   - Deletes worktree and branch

4. **Promote**: From main worktree
   - Test and verify
   - Move from local to global settings

### Best Practice: `cd` Into Extension Directory

When working in a feature worktree, `cd` into the extension directory:
```bash
cd .worktrees/<branch-name>/extensions/pure-<name>/
```

This keeps changes isolated to the intended extension within the mono repo.

### Testing in Worktrees

Each worktree is a full copy of the repo with its own `.pi/` directory.

**Agent-side smoke test** (automated, safe from anywhere):
```bash
pi -e "$PWD/.worktrees/<branch>/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5
```

**User-side functional test** (via `switch_worktree` tool):
1. Agent sets up the worktree's `.pi/settings.json` with the extension path.
2. Agent calls the `switch_worktree` tool with the branch name.
3. Pi session switches to the worktree — user tests the extension there.
4. Agent or user switches back: `switch_worktree` with `main`, or `/worktrees switch main`.
5. Main worktree is completely unaffected until merge.

This is the preferred testing path. The agent can hand off testing to the user by switching the session, and switch back when done.

**Fallback: user-side in main context** (only if no worktree session exists):
1. Temporarily point main's `.pi/settings.json` to the worktree extension path.
2. User `/reload` and tests.
3. Restore original path when done.

### Worktree `.pi/settings.json` setup

When developing in a worktree, the agent must create `.pi/settings.json` inside the worktree to load the extension being developed:

```json
{
  "packages": ["./extensions/pure-<name>"]
}
```

This lets Pi load the extension from the worktree copy, not from main.
