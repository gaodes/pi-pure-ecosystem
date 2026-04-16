---
name: enhance-pure-extension
description: Enhance or modify a pure-* extension we maintain in the pi-pure-ecosystem. Use when the user asks to add a feature, fix a bug, or change behavior of an existing extension we own.
---

# Enhance a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill adds new features, fixes bugs, or modifies behavior of extensions we maintain in the pure-ecosystem.

## When to Use This Skill

| Request | Skill to Use |
|---------|--------------|
| Create a new pure-* extension | `create-pure-extension` |
| Sync an extension with upstream changes | `update-pure-extension` |
| **Add features, fix bugs, or modify an extension we own** | `enhance-pure-extension` |

## Workflow: Enhance an Extension

### 1. Determine scope

Ask the user:
- **What change do you want?** — new feature, bug fix, behavior change
- **How urgent?** — critical fix vs nice-to-have
- **Any specific implementation ideas?** — user preferences or constraints

### 2. Create a worktree

All enhancements are done in a worktree to keep main clean.

```bash
/worktrees create <branch-name>
```

Then set up the worktree's `.pi/settings.json` to load the extension:
```json
{ "packages": ["./extensions/pure-<name>"] }
```

Write this to `.worktrees/<branch-name>/.pi/settings.json`.

If the extension is **globally active**, also remove it from `~/.pi/agent/settings.json` to avoid loading it twice.

### 3. Make changes

Work in the worktree's extension directory:
```bash
cd .worktrees/<branch-name>/extensions/pure-<name>/
```

Implement the enhancement following pure-* conventions:

- Keep inline path helpers, pure-* naming
- Project-overrides-global config (pass `ctx.cwd`)
- Update TypeBox schemas if tool parameters change
- Update CHANGELOG.md with the change

Commit to the feature branch as you go.

### 4. Test

**Agent-side smoke test** (subprocess, safe from anywhere):
```bash
pi -e "$PWD/.worktrees/<branch>/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5
```

**User-side functional test** (session switch):
1. Run `biome check --write --unsafe` on the worktree files.
2. Call the `switch_worktree` tool with the branch name.
3. Pi session switches to the worktree — user tests the extension.
4. User confirms working (or reports issues).
5. Switch back to main: `switch_worktree` with branch `main`, or `/worktrees switch main`.

Do not proceed to merge until the user confirms the functional test.

### 5. Merge and promote

```bash
/worktrees clean <branch-name>
```

Choose **merge and delete** to merge the branch into main and clean up.

**Restore activation if the extension was globally active:**
1. Add it back to `~/.pi/agent/settings.json`
2. `/reload` to verify global load
3. `git push`

---

## Reference Files

This skill uses the same reference files as `create-pure-extension`:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns, streaming, multi-action tools |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print), three-tier pattern |
| `references/components.md` | TUI components catalog, custom components |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/providers.md` | Provider registration |
| `references/structure.md` | Standalone repo structure |

---

## Critical Rules

1. **Execute order**: `(toolCallId, params, signal, onUpdate, ctx)`
2. **Always `onUpdate?.()`** — optional chaining
3. **No `.js` in imports**
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback — use explicit sentinels for close/cancel
5. **Error detection**: check for missing `details` fields (framework sets `{}` on throw)
6. **Signal forwarding**: pass to all async operations
7. **Never `child_process`**: use `pi.exec()`
8. **Never `homedir()`**: use `getAgentDir()`
9. **Typed param alias**: `type MyParams = Static<typeof parameters>`
10. **Entry point pattern**: load config → check enabled → register
11. **API key gating**: check before registering tools — notify if missing
12. **Fire-and-forget methods**: `notify`, `setStatus`, etc. don't need `hasUI` check
13. **No unused `_signal`**: forward or remove — never prefix with `_` if actually used
14. **Check existing components**: before creating custom TUI, check `pi-tui` or `pi-coding-agent`
15. **Settings UI**: use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

---

## Checklist

- [ ] Determined extension scope (feature, bug fix, behavior change)
- [ ] Created worktree for the change
- [ ] Set up worktree's `.pi/settings.json` with extension path
- [ ] Removed globally-active extension from `~/.pi/agent/settings.json` (if applicable)
- [ ] Made changes following pure-* conventions
- [ ] Updated CHANGELOG.md with enhancement entry
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested in worktree subprocess
- [ ] User confirmed functional test via `switch_worktree`
- [ ] Merged to main via `/worktrees clean`

**Restore activation if globally active:**
- [ ] Added back to `~/.pi/agent/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
