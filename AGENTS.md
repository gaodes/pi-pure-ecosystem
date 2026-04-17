# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

> **Simplicity, functionality, aesthetics** — start with a single file, split when justified. No build step. Use Pi APIs first. Respect the terminal canvas.
>
> This is a guiding preference, not a constraint. Embrace complexity when the feature demands it — split files, add dependencies, or build custom UI as needed. Justify the departure, don't avoid it.

This is the **development repo**. Remote: `github.com/gaodes/pi-pure-ecosystem`, branch `main`. Extensions are declared as a git package in global settings — Pi clones the repo and loads them from there.

## Project structure

```
pi-pure-ecosystem/          # Main worktree (main branch, production-ready)
├── .pi/
│   └── settings.json       # Local source-path overrides
├── .worktrees/              # Feature worktrees (managed via pure-git)
│   └── <feature>/          # Each worktree has the full mono repo
├── extensions/              # All extensions here
│   └── pure-<name>/        # one directory per extension
├── themes/                  # Theme JSON files
├── package.json             # Pi package manifest (extensions + themes)
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

## Repo conventions

- **No build step** — Pi loads `.ts` via Jiti at runtime.
- **Self-contained extensions** — one directory each, no cross-extension dependencies by default. Extract shared code when duplication justifies it.
- **Flat layout, prefer simple** — all extensions in `extensions/`. Prefer a flat structure; nest or restructure when complexity requires it.
- **Lint** — [Biome](https://biomejs.dev/) (`biome check --write --unsafe extensions/`), zero errors.
- **Commits** — conventional style (`feat:`, `fix:`, `refactor:`, `todo:`).
- **Manifest** — root `package.json` lists available extensions in `pi.extensions` and themes in `pi.themes`. Global settings can specify its own extension list, which replaces the manifest's — they are separate declarations, not a subset filter.
- **Changelogs** — no root `CHANGELOG.md`. Every change to an extension must be recorded in its per-extension `CHANGELOG.md`.

## Activation tiers

Extensions load from two sources — check them at runtime to see what's active:

1. **Global** — the git package filter in `~/.pi/agent/settings.json` (`pi list` to inspect)
2. **Local** — project-level overrides in `.pi/settings.json`

Local overrides take precedence. To work on an extension, add it to `.pi/settings.json` packages and remove it from the global git package filter. Restore when done.

> **Planned**: extensions will be published to npm and installed globally from there instead of the git package.

## Development workflow

- **Building, enhancing, importing, or publishing extensions** → use the `pure-extensions-dev` skill (its dispatch table maps tasks to the right sub-skill).
- **Looking up Pi APIs, hooks, tool patterns** → use the skill's `references/` directory.
- **Git worktrees for feature branches** → use the `pure-git` extension (`switch_worktree` tool).

Before implementing new extensions or major changes, read the `pure-extensions-dev` skill first.
