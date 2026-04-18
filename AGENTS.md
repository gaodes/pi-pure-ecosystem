# Pi Pure Ecosystem

Personal Pi extensions, themes, and configuration. Extensions and themes use the `pure-` prefix. Skills use kebab-case names without a required prefix. Developed for local use — published only if broadly useful.

> **Simplicity, functionality, aesthetics** — start with a single file, split when justified. No build step. Use Pi APIs first. Respect the terminal canvas.
>
> This is a guiding preference, not a constraint. Embrace complexity when the feature demands it — add dependencies, or build custom UI as needed. Justify the departure, don't avoid it.

This is the **development repo**. Remote: `github.com/gaodes/pi-pure-ecosystem`, branch `main`. This repo ships as a git package filtered by global settings — Pi clones it and loads resources from there.

## Project structure

```
pi-pure-ecosystem/          # Main worktree (main branch, production-ready)
├── .pi/
│   ├── settings.json       # Local package overrides and settings
│   └── skills/             # Project-specific loaded skills
├── .worktrees/              # Feature worktrees (prefer pure-git workflow; fall back to bash)
│   └── <feature>/          # Each worktree has the full mono repo
├── extensions/              # All extensions here
│   └── pure-<name>/        # one directory per extension
├── skills/                  # Skills development workspace
│   └── <skill-name>/      # One directory per skill
├── themes/                  # Theme JSON files
├── package.json             # Pi package manifest (extensions + themes)
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

## Repo conventions

- **No build step** — Pi loads `.ts` via Jiti at runtime.
- **Self-contained extensions** — one directory each, no cross-extension dependencies by default. Prefer self-containment; leverage shared resources (e.g., utility extensions) when duplication justifies it.
- **Flat layout, prefer simple** — all extensions live as top-level directories in `extensions/`. Subdirectories within an extension are fine when complexity requires it.
- **Lint** — [Biome](https://biomejs.dev/) (`biome check --write --unsafe extensions/`), zero errors.
- **Commits** — conventional style with scope: `type(name): description`. Types: `feat:`, `fix:`, `refactor:`, `todo:`. Scope (`name`) is the skill, extension, or theme being changed. Example: `feat(skill-manager): add description optimization reference`.
- **Manifest** — root `package.json` lists available extensions in `pi.extensions` and themes in `pi.themes`. Global settings can define its own extension list, which overrides the manifest's at runtime — the manifest file is not modified.
- **Changelogs** — no root `CHANGELOG.md`. Every change to an extension must be recorded in its per-extension `CHANGELOG.md`.

## Activation tiers

Extensions load from two sources — check them at runtime to see what's active:

1. **Global** — the git package filter in `~/.pi/agent/settings.json` (read the file to inspect the active filter)
2. **Local** — project-level overrides in `.pi/settings.json`

To work on an extension, add its path to `.pi/settings.json` under `packages` and remove the same extension from the global git package filter to avoid double-loading. Restore when done.

> **Planned**: all production-ready extensions, extension skills, and themes will be published to npm for global installation, replacing the git package.

## Development workflow

- **Tooling preference** — prefer relevant internal Pi tools, extensions, and skills first; fall back to bash only when nothing suitable exists.
- **Creating, importing, improving, or evaluating skills** → use the `skill-manager` skill. It handles the full skill lifecycle from creation through publishing.
- **Looking up Pi APIs, hooks, tool patterns** → use the skill-manager's `references/` directory and Pi's built-in documentation (`/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`).
- **Git worktrees for feature branches** → use the `pure-git` extension (`switch_worktree` tool).
- **Extension development** — write extensions directly in `extensions/pure-<name>/`. See Pi's extension docs for the API (`docs/extensions.md`).
