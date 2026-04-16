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

### 2. Determine activation tier

Before editing, check which activation tier the extension is on:

- **Globally active** (listed in `~/.pi/agent/settings.json`):
  1. Remove it from `~/.pi/agent/settings.json`.
  2. Add it to `.pi/settings.json`.
  3. `/reload` and develop.

- **Locally active** (already in `.pi/settings.json`):
  1. Edit directly.
  2. `/reload` and develop.

### 3. Make changes

Implement the enhancement following pure-* conventions:

- Keep inline path helpers, pure-* naming
- Project-overrides-global config (pass `ctx.cwd`)
- Update TypeBox schemas if tool parameters change
- Update CHANGELOG.md with the change

### 4. Check, test, and restore activation

**When finished, run the three testing gates:**

1. `biome check --write --unsafe extensions/pure-<name>/`
2. **Smoke-test**: `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5`
3. Ask the user to `/reload` and **functionally test**. Do not proceed until confirmed working.
4. **Commit checkpoint**: `git add . && git commit -m "pure-<name>: <description>"`

**Restore activation:**
- If it was globally active, remove it from `.pi/settings.json` and add it back to `~/.pi/agent/settings.json`. Verify global load with `/reload`, then `git push`.
- If it was locally active (baseline), keep it in `.pi/settings.json`.

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
- [ ] Moved globally-active extension to local for development
- [ ] Made changes following pure-* conventions
- [ ] Updated CHANGELOG.md with enhancement entry
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested: `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok"` exits 0
- [ ] User confirmed functional test
- [ ] Commit checkpoint: `git add . && git commit -m "pure-<name>: <description>"`

**Restore activation if globally active:**
- [ ] Removed from `.pi/settings.json`
- [ ] Added back to `~/.pi/agent/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
