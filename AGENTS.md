# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Named with the `pure-` prefix convention. Developed for local use — published only if broadly useful.

> **Simplicity, functionality, aesthetics** — start with a single file, split when justified. No build step. Use Pi APIs first. Respect the terminal canvas.
>
> This is a guiding preference, not a constraint. Embrace complexity when the feature demands it — split files, add dependencies, or build custom UI as needed. Justify the departure, don't avoid it.

This is the **development workspace**. Remote: `github.com/gaodes/pi-pure-ecosystem`, branch `main`. Extensions are sourced as a git package in global settings — Pi clones the repo and loads them from there.

## Project structure

```
pi-pure-ecosystem/          # Main worktree (main branch, production-ready)
├── .pi/
│   └── settings.json       # Local source-path overrides
├── .worktrees/              # Feature worktrees (managed via pure-git)
│   └── <feature>/          # Each worktree has the full mono repo
├── extensions/              # all extensions here
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
- **Flat layout** — all extensions in `extensions/`. Nest only when a feature's complexity calls for it.
- **Lint** — [Biome](https://biomejs.dev/) (`biome check --write --unsafe extensions/`), zero errors.
- **Commits** — conventional style (`feat:`, `fix:`, `refactor:`, `todo:`).
- **Manifest** — root `package.json` lists available extensions in `pi.extensions` and themes in `pi.themes`. Global settings filters what actually loads — not everything in the manifest is active.
- **Changelogs** — no root `CHANGELOG.md`. Per-extension changelogs are updated on significant changes.

## Activation tiers (current state)

**Globally active** — loaded from the git package in `~/.pi/agent/settings.json`:

- `pure-cron`, `pure-github`, `pure-git`, `pure-model-switch`, `pure-sessions`, `pure-statusline`, `pure-theme`, `pure-updater`

**Locally active** — excluded from the git package for safe local testing:

- `pure-vibes`

Extensions under active development are loaded locally for safe testing. Move to local when working on an extension, restore to global when done.

> **Planned**: extensions will be published to npm and installed globally from there instead of the git package.

## Development workflow

- **Building, enhancing, importing, or publishing extensions** → use the `pure-extensions-dev` skill (sub-skills: `create.md`, `enhance.md`, `import.md`, `publish.md`).
- **Looking up Pi APIs, hooks, tool patterns** → use the skill's `references/` directory.
- **Git worktrees for feature branches** → use the `pure-git` extension (`switch_worktree` tool).

Before implementing new extensions or major changes, read the `pure-extensions-dev` skill first.
