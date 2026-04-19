# Packaging

> Pi version: 0.67.4 | Last updated: 2026-04-17

How extensions are structured, packaged, and published in this mono repo.

## Extension Structure

Flat layout — no `src/` directory. Entry point is `index.ts` at the extension root.

```
extensions/
  pure-<name>/
    index.ts              # Entry point (default export)
    commands/             # Optional: one file per command
    components/           # Optional: TUI components
    utils/                # Optional: internal helpers
    package.json          # Only if runtime deps needed
    .npmignore
    README.md
    CHANGELOG.md
    LICENSE
    .upstream              # Import tracking (imported extensions only)
```

Not every extension needs subdirectories. Most are a single `index.ts`.

## package.json

### Minimal (no runtime deps)

```json
{
  "name": "@gaodes/pi-pure-<name>",
  "version": "0.1.0",
  "pi": {
    "extensions": ["./index.ts"]
  }
}
```

Omit entirely if the extension has no runtime deps — Pi discovers it via the git package.

### With runtime deps

```json
{
  "name": "@gaodes/pi-pure-<name>",
  "version": "0.1.0",
  "pi": {
    "extensions": ["./index.ts"]
  },
  "dependencies": {
    "<package>": "<version>"
  }
}
```

### Publishable manifest

Expanded at publish time by the publish skill:

```json
{
  "name": "@gaodes/pi-pure-<name>",
  "version": "<version>",
  "description": "<description>",
  "keywords": ["pi", "pi-extension", "<name>"],
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "git+https://github.com/gaodes/pi-pure-ecosystem.git",
    "directory": "extensions/pure-<name>"
  },
  "pi": {
    "extensions": ["./index.ts"]
  },
  "peerDependencies": {
    "@mariozechner/pi-coding-agent": "*",
    "@sinclair/typebox": "*"
  },
  "peerDependenciesMeta": {
    "@mariozechner/pi-coding-agent": { "optional": false },
    "@sinclair/typebox": { "optional": false }
  }
}
```

## Key Fields

| Field | Purpose |
|-------|---------|
| `pi.extensions` | Entry point paths — required for Pi to discover extensions |
| `peerDependencies` | Pi packages used at runtime — always `*` range |
| `dependencies` | Non-Pi runtime deps only — only when Pi lacks the capability |
| `files` / `.npmignore` | Control what ships to npm |

## Peer Dependencies

These Pi packages are always peer dependencies, never `dependencies`:

- `@mariozechner/pi-coding-agent` — core types, APIs, utilities
- `@mariozechner/pi-ai` — `complete()`, `StringEnum`
- `@mariozechner/pi-tui` — TUI components
- `@sinclair/typebox` — `Type`, `Static`

Add to `peerDependencies` only in the publishable manifest. Not needed in the minimal `package.json`.

## Publishing

Published to npm under `@gaodes` scope. The publish skill handles version bump, manifest expansion, and `npm publish`.

### Manual publish (if needed)

```bash
npm publish --access public
```

### Pre-publish checklist

- [ ] `package.json` has name, version, description, keywords
- [ ] `peerDependencies` lists all Pi packages used
- [ ] `peerDependenciesMeta` marks all as non-optional
- [ ] `.npmignore` excludes `node_modules/`, `CHANGELOG.md`, `.DS_Store`, `*.tmp`
- [ ] `biome check` passes
- [ ] Smoke test passes
- [ ] README has Sources / Inspiration section
- [ ] CHANGELOG has entry for this version

## Imports

No `.js` extensions in imports:

```typescript
// Correct
import { myTool } from "./tools/my-tool";

// Wrong
import { myTool } from "./tools/my-tool.js";
```
