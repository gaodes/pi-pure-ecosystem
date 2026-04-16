---
name: update-pure-extension
description: Update a pure-* extension from the pi-pure-ecosystem by syncing with upstream sources. Use when the user asks to update, sync, or pull changes for an extension we created.
---

# Update a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill updates extensions we maintain in the pure-ecosystem by checking upstream sources for changes and cherry-picking relevant updates.

## When to Use This Skill

| Request | Skill to Use |
|---------|--------------|
| Create a new pure-* extension | `create-pure-extension` |
| **Update an existing pure-* extension from upstream** | `update-pure-extension` |
| Add new features/fix bugs to an extension we own | `enhance-pure-extension` |

## Workflow: Update from Upstream

### 1. Find the primary source

Read the extension's `README.md` → **Sources / Inspiration** section. The first linked repo is the primary source (the upstream the extension was forked from).

If there is no upstream (from-scratch extension), inform the user — there are no upstream changes to pull.

### 2. Check upstream for changes

```bash
# Clone or fetch the upstream repo
git clone --depth 1 <upstream-url> /tmp/<source-name>
```

Compare the upstream source against our `extensions/pure-<name>/index.ts`:

- Read the upstream's main source file(s)
- Check the upstream's CHANGELOG for releases since our fork
- Note any bug fixes, new features, or API adaptations we're missing

### 3. Decide what to bring in

For each upstream change, decide:

- **Cherry-pick**: bug fixes, API signature changes (e.g. Pi version adaptations), security fixes
- **Skip**: features we don't need, changes that conflict with pure-* conventions, upstream patterns we deliberately replaced
- **Adapt**: features we want but need to rework for our path helpers, config resolution, or conventions

Report findings to the user before making changes.

### 4. Make changes

Apply updates to `extensions/pure-<name>/` following the same conventions as the original fork:

- Keep inline path helpers, pure-* naming, project-overrides-global config
- Maintain our README/CHANGELOG format
- Update CHANGELOG.md with changes brought from upstream

### 5. Check, test, and restore activation

**Before editing, determine the extension's activation tier:**

- **Globally active** (listed in `~/.pi/agent/settings.json`):
  1. Remove it from `~/.pi/agent/settings.json`.
  2. Add it to `.pi/settings.json`.
  3. `/reload` and develop.

- **Locally active** (already in `.pi/settings.json`):
  1. Edit directly.
  2. `/reload` and develop.

**When finished, run the three testing gates:**

1. `biome check --write --unsafe extensions/pure-<name>/`
2. **Smoke-test**: `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5`
3. Ask the user to `/reload` and **functionally test**. Do not proceed until confirmed working.
4. **Commit checkpoint**: `git add . && git commit -m "pure-<name>: sync with upstream"`

**Restore activation:**
- If it was globally active, remove it from `.pi/settings.json` and add it back to `~/.pi/agent/settings.json`. Verify global load with `/reload`, then `git push`.
- If it was locally active (baseline), keep it in `.pi/settings.json`.

---

## Reference Files

This skill uses the same reference files as `create-pure-extension`:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print) |
| `references/components.md` | TUI components catalog |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling |
| `references/providers.md` | Provider registration |
| `references/structure.md` | Standalone repo structure |

---

## Critical Rules

1. **Execute parameter order**: `(toolCallId, params, signal, onUpdate, ctx)` — signal before onUpdate
2. **Always use `onUpdate?.()`**: Optional chaining — parameter can be `undefined`
3. **No `.js` in imports**: Use bare module paths
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback — use explicit sentinels for close/cancel
5. **Error detection**: Check for missing expected fields in `details` (framework sets `{}` on throw)
6. **Signal forwarding**: Pass `signal` to all async operations
7. **Never use `child_process`**: Use `pi.exec()` instead
8. **Never use `homedir()`**: Use `getAgentDir()` from `@mariozechner/pi-coding-agent`
9. **Typed param alias**: Define `type MyParams = Static<typeof parameters>` at top of each tool file
10. **Entry point pattern**: load config → check enabled → register
11. **API key gating**: Check before registering tools — notify if missing
12. **Fire-and-forget methods**: `notify`, `setStatus`, etc. don't need `hasUI` check
13. **No unused `_signal`**: Forward or remove — never prefix with `_` if actually used
14. **Check existing components**: Before creating custom TUI, check `pi-tui` or `pi-coding-agent`
15. **Settings UI**: Use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

---

## Checklist

- [ ] Found primary source from README.md → Sources / Inspiration
- [ ] Checked upstream for changes (cloned/fetched, compared, noted differences)
- [ ] Decided what to cherry-pick / skip / adapt
- [ ] Applied changes while keeping pure-* conventions
- [ ] Updated CHANGELOG.md with upstream sync entry
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested: `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok"` exits 0
- [ ] User confirmed functional test
- [ ] Commit checkpoint: `git add . && git commit -m "pure-<name>: sync with upstream"`

**Restore activation if globally active:**
- [ ] Removed from `.pi/settings.json`
- [ ] Added back to `~/.pi/agent/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
