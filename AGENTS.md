# Pi Pure Ecosystem

Part of the `pilab` workspace. Global and workspace-level `AGENTS.md` rules apply; this file adds project-specific conventions.

Personal Pi extensions, themes, and configuration. Extensions and themes use the `pure-` prefix. Skills use kebab-case names without a required prefix. Developed for local use — published only if broadly useful.

> **Simplicity, functionality, aesthetics** — start with a single file, split when justified. Use Pi APIs first. Respect the terminal canvas.
>
> This is a guiding preference, not a constraint. Embrace complexity when the feature demands it — add dependencies, or build custom UI as needed. Justify the departure, don't avoid it.

This is the **development repo**. Remote: `https://github.com/gaodes/pi-pure-ecosystem`, branch `main`. This repo ships as a git package filtered by global settings — Pi clones it and loads resources from there.

## Project structure

```
pi-pure-ecosystem/
├── .pi/
│   ├── settings.json       # Local package overrides and settings
│   └── skills/             # Project-specific loaded skills
├── .worktrees/             # Feature worktrees
│   └── <feature>/          # Each worktree has the full mono repo
├── extensions/             # All extensions here
│   └── pure-<name>/       # One directory per extension
├── skills/                 # Skills development workspace
│   └── <skill-name>/      # One directory per skill
├── themes/                 # Theme JSON files
├── package.json            # Pi package manifest (extensions + themes)
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

## Repo conventions

- **Self-contained extensions** — one directory each, no cross-extension dependencies by default. Prefer self-containment; leverage shared resources (e.g., utility extensions) when duplication justifies it.
- **No build step** — Pi loads `.ts` via Jiti at runtime.
- **Flat layout** — all extensions live as top-level directories in `extensions/`. Subdirectories within an extension are fine when complexity requires it.
- **Lint** — Biome (`biome check --write --unsafe extensions/ skills/`), zero errors.
- **Commits** — conventional style with scope: `type(name): description`. Primary types: `feat:`, `fix:`, `refactor:`, `todo:`. Other conventional commit types are acceptable when appropriate. Scope is the skill, extension, or theme being changed.
- **Manifest** — root `package.json` lists available extensions in `pi.extensions` and themes in `pi.themes`. Global settings can define its own extension list, which overrides the manifest at runtime — the manifest file is not modified.
- **Changelogs** — no root `CHANGELOG.md`. Every change to an extension must be recorded in its per-extension `CHANGELOG.md`.
- **First-class citizen** — all extensions are built to first-class Pi Ecosystem standards (see below). Personal use extensions still meet this bar — it ensures quality and prepares for publishing.

## First-Class Citizen Standard

All `pure-*` extensions meet Pi Ecosystem first-class standards:

| Standard | Implementation |
|----------|----------------|
| **API compliance** | Use Pi APIs first (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`). Only add npm deps when Pi doesn't provide the capability. |
| **Terminal-aware** | Respect terminal canvas: 256-color fallback, screen reader accessibility, no blocking operations in TUI. |
| **Hot-reload ready** | Extensions work with `/reload`; themes reload automatically on edit. |
| **Branching-safe** | Persist state via tool result `details` for session tree support. |
| **Error-resilient** | Handle load errors gracefully. Pi silently swallows some failures — log and recover. |
| **Minimal footprint** | No unnecessary deps. Pi bundles core packages — use peer deps for shared Pi packages. |
| **Type-safe** | Biome lint with zero errors. |

## Publishing Workflow

When an extension is broadly useful and meets first-class citizen standards:

1. **Prepare** — per-extension `CHANGELOG.md` complete; Biome lint passes
2. **Test** — local test via project `.pi/settings.json` override before committing
3. **Manifest** — add to root `package.json` `pi.extensions` (if not already)
4. **Publish** — publish to npm with `keywords: ["pi-package"]`
5. **Document** — update extension table in README

Production extensions may be published to npm independently from this mono repo. See [docs/packages.md](https://github.com/badlogic/pi-mono/blob/main/docs/packages.md) for Pi package structure.

## Activation tiers

Extensions load from two sources — check them at runtime to see what's active:

1. **Global** — the git package filter in `~/.pi/agent/settings.json`
2. **Local** — project-level overrides in `.pi/settings.json`

To work on an extension, add its path to `.pi/settings.json` under `packages` and remove the same extension from the global git package filter to avoid double-loading. Restore when done.

> **Planned**: production-ready extensions will be published to npm for global installation, replacing the git package.

## Development workflow

- **Tooling preference** — prefer relevant internal Pi tools, extensions, and skills first; fall back to bash only when nothing suitable exists.
- **Creating, importing, improving, or evaluating skills** → use the `skill-manager` skill.
- **Looking up Pi APIs, hooks, tool patterns** → use the skill-manager's `references/` directory and Pi's built-in documentation (resolve the path from the Pi installation directory).
- **Git worktrees for feature branches** → use the `pure-git` extension (`switch_worktree` tool). Prefer pure-git workflow; fall back to bash.
- **Extension development** — write extensions directly in `extensions/pure-<name>/`. See Pi's extension docs for the API.
- **Testing** — test extensions locally via project `.pi/settings.json` before committing. Use `--mode json` or isolated subprocess for smoke tests.
