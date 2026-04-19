# Testing

> Pi version: 0.67.4 | Last updated: 2026-04-17

## Smoke Test (Isolated Subprocess)

Safe, no conflicts — run from the repo root:

```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

Checks: extension loads, registers tools, doesn't crash. Not a functional test.

## Functional Test in a Worktree

The real test — hands the session to the user:

1. Create `.pi/settings.json` in the worktree root: `{ "packages": ["./extensions/pure-<name>"] }`
2. Call `switch_worktree` tool with the branch name
3. User tests the extension interactively
4. Switch back: `switch_worktree` with branch `main`

## Functional Test on Main (Fallback)

Only if no worktree session exists:

1. Add `"./extensions/pure-<name>"` to `.pi/settings.json` packages
2. Ask user to `/reload` and test
3. Remove from `.pi/settings.json` when done

## Manual Testing Checklist

- [ ] Extension loads without errors
- [ ] Tools appear in the tool list and work when called by the LLM
- [ ] Commands appear in autocomplete and work when invoked
- [ ] Custom renderers display correctly (both partial and final states)
- [ ] Missing API key shows a notification, not a crash
- [ ] Works in Print mode (`pi -p "test message"`): no UI errors, graceful degradation
- [ ] If using `ctx.ui.custom()`: RPC fallback is exercised, interactive close paths use explicit non-undefined sentinels

## Testing Hooks

Trigger hooks by exercising the relevant actions:

| Hook | How to trigger |
|------|---------------|
| `tool_call` | Have the LLM call a tool your hook intercepts |
| `session_start` | Reload or start a new session |
| `before_agent_start` | Start any agent turn |
| `input` | Type a message matching your transform pattern |

## Debugging

Extension errors are logged to the pi log file:

```bash
pi --log-level debug
```

If an extension fails to load, pi logs the error and continues without it.

## Linting & Formatting

```bash
biome check --write --unsafe extensions/pure-<name>/
```

Zero errors required. Warnings acceptable with inline suppressions.
