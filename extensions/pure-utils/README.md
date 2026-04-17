# pure-utils

Shared utilities and reference tools for Pi extension development. Replaces the deprecated `pi-devkit` extension.

## Sources / Inspiration

The initial tools are ported from the deprecated `pi-devkit` extension, which was forked from:

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) v0.6.1 — Primary source. Licensed MIT.
- `pi-devkit` local fork: `extensions/pi-devkit/tools/{package-manager,version,docs,changelog}.ts`, `utils.ts`, `ui.ts`

## Tools

| Tool | Purpose |
|------|---------|
| `detect_package_manager` | Detect npm/yarn/pnpm/bun from lockfiles and package.json |
| `pi_version` | Get the installed Pi version |
| `pi_docs` | List Pi documentation files (README, docs/, examples/) |
| `pi_changelog` | Get changelog entry for a specific Pi version |
| `pi_changelog_versions` | List all available changelog versions |

## Utilities

| File | Export | Purpose |
|------|--------|---------|
| `utils/find-pi-installation.ts` | `findPiInstallation()` | Locate the running Pi installation directory |
| `ui/components.ts` | `ToolCallHeader`, `ToolBody`, `ToolFooter` | Reusable TUI components for tool rendering |

## Philosophy

This extension provides infrastructure that other extensions and skills can use. It does not register commands or hooks — only tools.
