# Critical Rules

> Pi version: 0.67.4 | Last updated: 2026-04-17

Rules for writing Pi extensions in the pure-ecosystem. Update this file when Pi API changes.

1. **Execute order**: `(toolCallId, params, signal, onUpdate, ctx)` — always this order, no shortcuts.
2. **Optional chaining on `onUpdate`**: always `onUpdate?.()`, never `onUpdate()`.
3. **No `.js` in imports**: Jiti resolves `.ts` directly. `import "./foo"` not `import "./foo.js"`.
4. **`ctx.ui.custom()` needs RPC fallback**: returns `undefined` in RPC and Print modes. Use explicit sentinels for close/cancel (not `undefined`).
5. **Check for missing `details` fields**: the framework sets `{}` on throw — verify expected fields exist.
6. **Forward signal to all async operations**: pass `signal` to fetch, timeouts, any cancellable work.
7. **Never `child_process`**: use `pi.exec()` for all shell execution.
8. **Never `os.homedir()`**: use `getAgentDir()` from `@mariozechner/pi-coding-agent`.
9. **Typed param alias**: `type MyParams = Static<typeof parameters>` — always alias, never inline.
10. **Entry point pattern**: load config → check enabled → register tools/commands/hooks.
11. **API key gating**: check for required keys before registering tools. `notify()` the user if missing.
12. **No unused `_signal`**: if you forward it, don't prefix with `_`. If you don't use it, remove it.
13. **Check existing components**: before creating custom TUI, check `pi-tui` or `pi-coding-agent` for built-ins.
14. **Settings UI**: use `registerSettingsCommand` when the extension is configurable.
