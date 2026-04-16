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

Also check whether the upstream has added new credits or inspirations since our last sync — if so, update our README's Sources section to reflect the full lineage.

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

### 4. Create worktree and apply changes

All upstream syncs are done in a worktree to keep main clean.

```bash
/worktrees create <branch-name>
```

Set up the worktree's `.pi/settings.json` to load the extension:
```json
{ "packages": ["./extensions/pure-<name>"] }
```

Write this to `.worktrees/<branch-name>/.pi/settings.json`.

If the extension is **globally active**, also remove it from `~/.pi/agent/settings.json`.

Apply updates to the worktree's `extensions/pure-<name>/` following the same conventions as the original fork:

- Keep inline path helpers, pure-* naming, project-overrides-global config
- Maintain our README/CHANGELOG format
- Update CHANGELOG.md with changes brought from upstream

Commit to the feature branch as you go.

### 5. Test

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

### 6. Merge and restore activation

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

- [ ] Found primary source from README.md → Sources / Inspiration
- [ ] Checked upstream for changes (cloned/fetched, compared, noted differences)
- [ ] Decided what to cherry-pick / skip / adapt
- [ ] Created worktree for the sync
- [ ] Set up worktree's `.pi/settings.json` with extension path
- [ ] Removed globally-active extension from `~/.pi/agent/settings.json` (if applicable)
- [ ] Applied changes while keeping pure-* conventions
- [ ] Updated CHANGELOG.md with upstream sync entry
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested in worktree subprocess
- [ ] User confirmed functional test via `switch_worktree`
- [ ] Merged to main via `/worktrees clean`

**Restore activation if globally active:**
- [ ] Added back to `~/.pi/agent/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
