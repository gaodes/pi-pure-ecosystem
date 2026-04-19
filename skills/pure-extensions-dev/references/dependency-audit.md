# Dependency Audit

> Pi version: 0.67.4 | Last updated: 2026-04-17

For each third-party import, check if Pi provides an equivalent. Flag every replacement to the user — only replace if functionality is preserved. User makes the final call.

## Replacement Table

| Original | Pi API / Alternative | Replace? | Notes |
|----------|---------------------|----------|-------|
| `child_process.exec/spawn` | `pi.exec()` | Yes | Unless extension needs streaming/pty |
| `os.homedir()` | `getAgentDir()` | Yes | Always |
| `@aliou/*` packages | Inline or `@mariozechner/*` | Yes | Third-party, not bundled by Pi |
| `fs.*Sync` for JSON config | Inline `getPurePath()` helpers | Yes | See `references/path-helpers.md` |
| `@sinclair/typebox` | Keep — Pi bundles it | No | Import in code, not in package.json |
| `fetch` | Keep — built-in | No | No change needed |
| `@aliou/pi-utils-ui` | `pure-foundation/ui/components.ts` | Yes | ToolCallHeader, ToolBody, ToolFooter. Inline or import from sibling extension. |

## Peer Dependencies (never in `dependencies`)

These Pi packages are always peer dependencies:

- `@mariozechner/pi-coding-agent`
- `@mariozechner/pi-ai`
- `@mariozechner/pi-tui`
- `@sinclair/typebox`

Add them to `peerDependencies` in `package-publish.json` only (not in `package.json`).

## Runtime Dependencies

Only add to `dependencies` when Pi genuinely lacks the capability. Examples from existing extensions:

| Dep | Extension | Why kept |
|-----|-----------|----------|
| `croner` | `pure-cron` | Cron expression parsing — no Pi equivalent |
| `nanoid` | `pure-cron` | Short unique IDs — no Pi equivalent |
