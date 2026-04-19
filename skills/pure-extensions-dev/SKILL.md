---
name: pure-extensions-dev
description: Create, import, enhance, update, or publish pure-* extensions for the pi-pure-ecosystem. Use when working on extensions in this mono repo.
---

# Pure Extension Development

## Dispatch

Read the sub-skill file that matches the task:

| Task | File | When |
|------|------|------|
| Build from scratch | `create.md` | User wants something new that doesn't exist |
| Import/fork external | `import.md` | User asks to import, fork, or adapt an external Pi extension |
| Enhance existing | `enhance.md` | Add features, fix bugs, modify an extension we own |
| Sync upstream | `update.md` | Pull changes from the original source |
| Publish to npm | `publish.md` | Publish, release, or push to npm |
| Self-update | `self-update.md` | Update this skill itself or its references |

If the request doesn't clearly match one, ask before proceeding.

---

## Design Philosophy

**Simplicity, functionality, aesthetics** — in that order.

### Simplicity
- A 300-line `index.ts` beats a 10-file module split.
- No build step — Pi loads `.ts` via Jiti at runtime.
- No cross-extension dependencies by default. Prefer self-containment; leverage shared resources when duplication justifies it.
- Only add npm packages when Pi genuinely lacks the capability.

### Functionality
- Pi APIs before everything else — use `pi.exec()`, `getAgentDir()`, `ctx.ui.notify()`, `@sinclair/typebox`, `@mariozechner/pi-tui`, and `complete()` before reaching for external packages or raw Node APIs.
- Project-level configs override global ones: `<project>/.pi/pure/` takes precedence over `~/.pi/agent/pure/`.
- Design for all three Pi modes: Interactive, RPC, and Print.

### Aesthetics
- Use theme tokens and `ctx.ui.theme.fg()` for colored text — never hardcode colors.
- Prefer built-in Pi TUI components (`SettingsList`, `SelectList`, `Container`) over custom rendering.
- Test UI in both light and dark themes. Test in Ghostty.
- Keep output concise and scannable. The terminal is a small canvas.

## Extension Conventions

### Naming & Structure

- **Name**: `pure-<name>` (`pi-devkit` is deprecated — future shared tools will live in `pure-utils`)
- **Entry point**: `index.ts` at extension root
- **Structure**: single `index.ts`. Split when justified.
- **package.json**: only if npm deps needed. Pi packages are **peer dependencies**, never `dependencies`.
- **Self-contained**: inline path helpers, no cross-extension deps by default.
- **Config reads**: project first, fall back to global.

### What to Build

| Goal | Type | Key files |
|------|------|-----------|
| Teach Pi a workflow | Skill | `SKILL.md` with YAML frontmatter |
| New tool/command/behavior | Extension | `index.ts` |
| Reuse a prompt pattern | Prompt template | `.md` with `{{variable}}` |
| Change appearance | Theme | `theme.json` |

If `bash` + instructions can do it → **Skill**. Need hooks, typed tools, UI → **Extension**.

> **Note**: Skills and Themes are listed as build targets but dedicated creation workflows are not yet defined. Use the general extension workflow as a guide, or ask.

### Mode Awareness

Pi runs in three modes — extensions must handle all:

| Mode | `ctx.hasUI` | UI available |
|------|-------------|-------------|
| Interactive | `true` | Full TUI |
| RPC (`--mode rpc`) | `true` | JSON protocol (host handles UI) |
| Print (`-p`) | `false` | No UI at all |

**Fire-and-forget** — safe in any mode: `notify()`, `setStatus()`, `setWidget()`, `setTitle()`

**Dialog methods** — need fallback: `select()`, `confirm()`, `input()`, `custom()`

Read `references/modes.md` for full details, examples, and method behavior tables.

---

## Worktree Workflow

All non-trivial changes happen in a worktree. The agent creates, configures, and cleans up worktrees using bash and tools — not slash commands.

**Create** a branch and worktree — prefer the `pure-git` extension (`switch_worktree` tool); fall back to bash:
```bash
git checkout main && git checkout -b <branch-name>
git worktree add .worktrees/<branch-name> <branch-name>
```

**Set up** `.worktrees/<branch-name>/.pi/settings.json`:
```json
{ "packages": ["./extensions/pure-<name>"] }
```

If the extension is **globally active**, remove it from `~/.pi/agent/settings.json` to avoid double-loading.

**Test:** call `switch_worktree` tool with the branch name → user tests → `switch_worktree` with branch `main` to return.

**Finish** — merge and clean up from the main repo root (prefer `pure-git`; fall back to bash):
```bash
cd <main-repo-root>
git checkout main && git merge <branch-name>
git worktree remove .worktrees/<branch-name>
git branch -d <branch-name>
```

Restore globally-active extensions to `~/.pi/agent/settings.json` and `/reload`.

---

## Check, Lint, Test

```bash
biome check --write --unsafe extensions/pure-<name>/
```

Smoke test (isolated subprocess):
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

Functional test in worktree: call `switch_worktree` → user tests → switch back to main.

---

## Assets

Templates in `assets/` are scaffolded when creating or importing extensions. Copy and fill in `{{variables}}`.

| Asset | Used by |
|-------|---------|
| `extension-index.ts` | create, import — tool-based extension with path helpers |
| `extension-command-only.ts` | create, import — command + hooks only (no tool) |
| `package.json` | create, import — minimal manifest |
| `package-with-deps.json` | create, import — manifest with runtime deps |
| `package-publish.json` | publish — full publishable manifest |
| `.npmignore` | create, import |
| `.upstream.json` | import — upstream tracking |
| `PLAN.md` | import — planning template |
| `README.md` | create, import — with Sources / Inspiration section |
| `CHANGELOG.md` | create, import — initial entry |
| `LICENSE` | create, import — MIT template |

---

## Reference Files

Load on demand — only when you need specific details.

### Shared conventions (read frequently)

| File | Load when... |
|------|-------------|
| `references/pure-extensions-catalog.md` | Before creating or modifying extensions — see what already exists |
| `references/tool-preferences.md` | Choosing between internal tools and bash commands |
| `references/critical-rules.md` | Writing extension code — the 14 rules |
| `references/dependency-audit.md` | Deciding whether to replace a third-party import |
| `references/path-helpers.md` | Implementing config/cache storage |

### Pi API deep dives (load for specific tasks)

| File | Load when... |
|------|-------------|
| `references/api-reference.md` | Need the full Pi API catalog |
| `references/modes.md` | Handling Interactive/RPC/Print mode differences |
| `references/tools.md` | Implementing tool registration, rendering, error handling |
| `references/commands.md` | Registering slash commands |
| `references/messages.md` | sendMessage, notify, custom renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/components.md` | TUI component authoring |
| `references/providers.md` | Provider registration |

| `references/testing.md` | Testing patterns |
| `references/state.md` | State management |
| `references/packaging.md` | Setting up package.json, peer deps, publishing |
| `references/additional-apis.md` | Additional Pi API references |
| `references/documentation.md` | Documentation patterns |
