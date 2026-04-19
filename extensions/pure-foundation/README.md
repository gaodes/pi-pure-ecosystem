# pure-foundation

Shared foundation layer for `pure-*` extensions.

This package centralizes reusable building blocks across the Pure ecosystem:

- Tool UI components and fields
- Generic widgets and panel primitives
- Terminal rendering helpers
- Common utility helpers

## Scope

`pure-foundation` is a **shared library extension**, not a feature extension. It should contain stable reusable primitives and helpers, not extension-specific business logic.

## Current modules

- `tools/` — tool rendering components (`ToolCallHeader`, `ToolBody`, `ToolFooter`, fields, states)
- `widgets/` — higher-level reusable TUI widgets
- `primitives/` — low-level terminal helpers
- `ui/components.ts` — compatibility exports for `ToolCallHeader`, `ToolBody`, `ToolFooter`, etc.
- `utils/` — shared non-UI helpers (currently `findPiInstallation()`)

## Upstream source

UI modules were synced from:

- `@aliou/pi-utils-ui` (local source mirror under `ext-testing/.pi/npm/node_modules/@aliou/pi-utils-ui`)

## Usage

```ts
import { ToolCallHeader, ToolBody, ToolFooter } from "../pure-foundation/ui/components";
```

or

```ts
import { ToolCallHeader } from "../pure-foundation/tools/ToolCallHeader";
```

## Notes

- Keep APIs stable and additive where possible.
- Prefer compatibility re-exports when reorganizing module paths.
- `pure-utils` remains unchanged; this package is the new shared foundation track.
