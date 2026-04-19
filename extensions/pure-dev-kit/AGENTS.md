# pi-dev-kit

Forked extension: this package was cloned from upstream `@aliou/pi-dev-kit` (formerly `@aliou/pi-extension-dev`).
Current work in this repo focuses on adaptation and maintenance under `@gaodes`.

Public Pi extension providing tools and prompts for building, maintaining, and updating Pi extensions.

## Stack

- TypeScript (strict mode), pnpm 10.26.1, Biome, Changesets

## Scripts

- `pnpm typecheck`, `pnpm lint`, `pnpm format`, `pnpm changeset`

## Structure

- `src/index.ts` - entry, `src/commands/` - slash commands, `src/tools/` - tool impls, `src/skills/` - dev guidance, `src/prompts/` - templates
