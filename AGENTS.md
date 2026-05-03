# Pi Pure Ecosystem

Part of the `pilab` workspace. Global and workspace-level `AGENTS.md` rules apply; this file adds project-specific conventions.

Personal Pi extensions, skills, themes, prompts, and supporting packages. Extension package directories use the `pure-` prefix. Skills use kebab-case names without a required prefix. Themes use descriptive kebab-case filenames and may preserve upstream palette names when that is clearer. Local-only resources still meet the same quality bar as publishable ones.

> **Simplicity, functionality, aesthetics** — start with a single file, split when justified. Use Pi APIs first. Respect the terminal canvas.
>
> This is a guiding preference, not a constraint. Embrace complexity when the feature demands it — add dependencies, or build custom UI as needed. Justify the departure, don't avoid it.

This is the **development repo**. Remote: `https://github.com/gaodes/pi-pure-ecosystem`, branch `main`. This repo ships as a git package filtered by settings, and selected resources are also published to npm under the `@gaodes` scope.

## Resource types in this ecosystem

All Pure ecosystem resources are **first-class citizens**:

- **Extensions** — runtime behavior, tools, commands, event hooks, TUI customization
- **Skills** — reusable workflows and operational playbooks
- **Themes** — complete Pi TUI theme definitions
- **Prompt templates** — lightweight reusable prompts when a full skill is unnecessary

Local-only resources still follow first-class standards. Publishability is a consequence of discipline, not a separate mode.

## Project structure

```text
pi-pure-ecosystem/
├── .pi/
│   ├── settings.json       # Project-level package shadowing and local overrides
│   └── skills/             # Project-specific loaded skills
├── .worktrees/             # Feature worktrees
│   └── <feature>/          # Each worktree contains the full mono repo
├── extensions/             # All extension packages
│   └── pure-<name>/        # One directory per extension/package
├── skills/                 # Skill development workspace
│   └── <skill-name>/       # One directory per skill
├── themes/                 # Theme JSON files
├── package.json            # Pi package manifest (extensions + themes)
├── biome.json
├── .gitignore
├── AGENTS.md
└── README.md
```

## Core conventions

- **No build step by default** — Pi loads `.ts` through Jiti at runtime.
- **Flat extension layout** — all extension packages live directly under `extensions/`.
- **Biome is standard** — use Biome for linting/formatting; keep changed files clean.
- **Per-resource changelogs** — no root `CHANGELOG.md`; each published or publishable package keeps its own `CHANGELOG.md`.
- **Conventional commits with scope** — `type(scope): description`; scope is the extension, skill, theme, or package being changed.
- **Manifest is declarative** — root `package.json` lists package resources; runtime loading can still be narrowed by settings filters.
- **Document and ship together** — when behavior, architecture, workflow, package role, or user-visible output changes, update the relevant docs in the same task.
- **Docs and changelogs are required deliverables** — if a change affects usage, behavior, migration, packaging, or publishing, update the relevant README/docs and that package's `CHANGELOG.md` in the same task, before release prep or task completion.

## Naming and placement conventions

- **Extension packages** — live in `extensions/pure-<name>/`. These are the packages we develop and publish independently to GitHub and npm.
- **Published package names** — use each package's own `package.json` as the source of truth. Local directory naming is stable (`pure-<name>`), while the published npm name may include scope or package-prefix differences. Example: directory `pure-dev-kit` → npm package `@gaodes/pure-dev-kit`.
- **Project-level development skills** — live in `skills/<skill-name>/`, use kebab-case, and are for repo/local development workflows. If used, they are loaded through the default Pi agent configuration for this project. They are not standalone npm publish targets.
- **Extension-bundled skills/prompts** — live inside the extension package that ships them (for example `extensions/pure-dev-kit/src/skills/` and `src/prompts/`).
- **Themes** — live in `themes/*.json`, use descriptive kebab-case filenames, and may preserve upstream palette names when appropriate (for example `catppuccin-latte.json`). They are maintained in this repo but are not standalone npm publish targets.
- **Everything at repo root exists for development** — only extension packages are independently published to npm; skills and themes are developed here for local/project use and git-distributed workflows.

## Shared foundation and utility governance

Extensions are **self-contained by default**, but stable reusable cross-extension primitives belong in the shared layer instead of being re-copied.

### Current shared package roles

- **`pure-dev-kit`** — the extension-development toolbox. It provides extension-dev tools, commands, prompts, and skills. Use it first when working on Pi extension development in this repo.
- **`pure-foundation`** — the current published shared foundation layer. It exports reusable UI/components/primitives/widgets/helpers and is already consumed by packages such as `pure-dev-kit`.
- **`pure-utils`** — legacy and retired. Some existing extensions may still use it, so when maintaining those packages the agent should understand that legacy role. Do not expand it for new shared work; prefer `pure-foundation` as the active shared foundation layer and touch `pure-utils` only for maintenance, migration, or compatibility.

### What belongs in the shared layer

Promote code into the shared layer when it is:

- reused by multiple extensions
- clearly an ecosystem primitive
- stable enough to preserve API compatibility

Typical examples:

- reusable tool call/result render helpers
- shared TUI primitives or widgets
- common Pi/environment discovery helpers
- common parsing/formatting helpers
- compatibility re-exports for shared building blocks

### What stays local to an extension

Keep code local when it is:

- extension-specific business logic
- unstable or exploratory
- tightly coupled to one extension's feature behavior
- not yet reused outside one package

### Duplication rule

Do **not** copy the same reusable helper into multiple extensions.

- If the helper is specific or still proving itself, keep it local.
- If it becomes stable and reused, move it into the shared layer.
- When touching existing shared code, follow the package already used by dependents instead of starting a new shared home.

## First-Class Citizen Standard

All Pure ecosystem resources should meet this bar.

| Standard                       | Implementation expectation                                                                                                                                                                |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **API correctness**            | Use Pi APIs first (`@mariozechner/pi-coding-agent`, `@mariozechner/pi-tui`, `@mariozechner/pi-ai`). Use current lifecycle/event names and supported extension points.                     |
| **Terminal-aware**             | Respect width, wrapping, fallback colors, and stable rendering in the TUI. Avoid noisy or fragile layouts.                                                                                |
| **Hot-reload ready**           | Extensions should behave correctly on `/reload`; themes should reload cleanly when edited.                                                                                                |
| **Session / branch safe**      | Persist reconstructable state in tool `details` or durable session entries when appropriate. Avoid important state existing only in memory.                                               |
| **Error-resilient**            | Fail clearly, recover where reasonable, and remember Pi may swallow some load errors. Validate loading behavior instead of assuming success.                                              |
| **Tool correctness**           | Use `StringEnum` where needed, `prepareArguments` for compatibility when needed, throw from `execute()` for real tool errors, and use `promptSnippet` / `promptGuidelines` intentionally. |
| **File mutation safety**       | Any file-mutating custom tool should use `withFileMutationQueue()` so it cooperates with Pi's parallel tool execution model.                                                              |
| **Output discipline**          | Truncate oversized outputs appropriately and preserve a path to the full output when needed.                                                                                              |
| **Shared-layer discipline**    | Reusable stable helpers go into the shared layer; extension-specific logic stays local.                                                                                                   |
| **Testing discipline**         | Smoke-test before promotion. Validate repo-root behavior, isolated behavior, and publish-like behavior where relevant.                                                                    |
| **Packaging correctness**      | Use correct manifest paths, peerDependencies vs dependencies, and do not bundle Pi core packages incorrectly.                                                                             |
| **Type and lint safety**       | Biome clean for changed files; keep TypeScript and package metadata consistent.                                                                                                           |
| **Docs and changelog hygiene** | Update docs, READMEs, and per-package changelogs when behavior changes.                                                                                                                   |

## Extensions

Extensions are the main product surface of this repo.

- Every `pure-*` extension is expected to behave like a first-class Pi package.
- Prefer Pi APIs before adding external runtime dependencies.
- Keep extension-specific logic inside the extension unless it has proven shared value.
- Keep renderers compact by default; expand for detail only when helpful.
- Use project-local smoke tests before calling work complete.
- If an extension becomes broadly useful, prepare it for npm publication rather than lowering its quality because it started as local tooling.

## Skills

Skills are first-class resources in this repo, not an afterthought.

Use a **skill** when you need:

- a reusable workflow
- a development or release playbook
- structured instructions that do not require runtime hooks or tool registration

Use an **extension** when you need:

- tools, commands, events, UI, runtime state, or integration logic

Use a **prompt template** when you need:

- a lightweight reusable prompt without a full workflow package

Skill conventions:

- kebab-case names
- specific `description` that makes triggering obvious
- Agent Skills-compatible frontmatter
- supporting files referenced by relative paths
- durable workflows belong in `skills/`, not buried in README prose

For extension authoring workflows, prefer the project's extension-dev skills and related tooling rather than reinventing local process each time.

## Themes

Themes are first-class ecosystem outputs.

- Theme files should follow the Pi theme schema and define all required tokens.
- Test themes across real TUI states: normal text, markdown, tools, selected rows, borders, long wrapped content, and status states.
- Prioritize readability and contrast over novelty.
- Theme-aware extensions should consume theme tokens correctly instead of hardcoding visual assumptions.
- When a reusable theme/rendering helper belongs across multiple packages, promote it into the shared layer.

## Prompt templates

Prompt templates are valid first-class resources when the need is narrow and text-centric.

- Use a prompt template for lightweight reusable prompting.
- Promote a prompt into a skill when it grows operational steps, branching guidance, or helper-file references.
- Do not bury extension-development workflow logic in prompt templates when it should live in a skill or extension tool.

## Pure Dev Kit workflow preference

`pure-dev-kit` is the default toolbox for developing Pi extensions in this repo.

### Use Pure Dev Kit tools first

For Pi extension-development tasks, prefer this **complete Pure Dev Kit tool roster** before manual discovery:

- `pi_version` — confirm installed Pi version
- `pi_docs` — list bundled Pi docs/examples
- `pi_changelog_versions` — discover available Pi release versions
- `pi_changelog` — inspect release notes for a specific version or latest
- `detect_package_manager` — determine package manager and install/run commands for the current project

Related Pure Dev Kit resources to use intentionally:

- `/extensions:update [VERSION]` — guided extension update flow
- `pi-extension` skill — structured extension authoring/playbook references

Manual file/URL inspection is still allowed, but it should happen **after** these tools narrow the target.

## Activation and loading model

Think about loading in three layers:

1. **Resource source**
   - local path
   - npm package
   - git package

2. **Active scope**
   - global settings (`~/.pi/agent/settings.json`)
   - project settings (`.pi/settings.json`)
   - temporary execution (`pi -e ...`)

3. **Package filtering**
   - object-form package entries can disable or narrow extensions/skills/prompts/themes per scope

Use isolated loads when needed:

- `pi -e <path-or-package>`
- `pi --no-extensions -e <path-or-package>`

## Local-first loading policy for owned extensions

Inside this development repo, **owned** packages should load from local source first.

### Policy

If an extension is ours (`gaodes`) and is also installed globally:

- keep the global install intact for normal usage outside this repo
- do **not** uninstall it merely to work on it here
- inside this repo, use **project-level shadowing** so local source wins

### Canonical shadowing pattern

In `.pi/settings.json`:

1. Add the package source in object form with empty resource arrays to shadow it at project scope.
2. Add the local path immediately after it.

Example pattern:

```json
{
  "packages": [
    { "source": "npm:@gaodes/pure-foundation", "extensions": [] },
    {
      "source": "npm:@gaodes/pure-dev-kit",
      "extensions": [],
      "skills": [],
      "prompts": []
    },
    "../extensions/pure-foundation",
    "../extensions/pure-dev-kit"
  ]
}
```

This keeps global installs available while forcing local precedence in this repo.

## Repo bootstrap checklist

At the start of a new session in this repo:

1. Confirm project-level shadowing in `.pi/settings.json` for the owned packages being worked on.
2. Confirm there are no duplicate tool registration conflicts.
3. Run a quick smoke test in repo root.
4. If working on a publish candidate, run preflight checks early.

## Development workflow

- Prefer relevant Pi tools, extensions, and skills first; use bash when nothing more specific fits.
- Use `pure-dev-kit` first for Pi docs/version/changelog/package-manager questions in extension-development tasks.
- Use `pure-git` for worktree-centric workflows. It is a local package in this repo and provides the `/worktrees` command family plus the `switch_worktree` tool for session-aware worktree switching.
- Build extensions directly in `extensions/pure-<name>/`.
- Build stable shared primitives in the designated shared layer rather than copying them between extensions.
- Treat docs and changelog maintenance as part of the implementation task, not follow-up cleanup.

## Testing and validation workflow

### Minimum validation

- Smoke-test from **repo root** using local extension paths (developer context).
- For extension loading checks, prefer explicit subprocess loads, e.g.:
  - `pi --no-extensions -e ./extensions/<name> -p "..."`
  - `pi --no-extensions -e ./extensions/<name> -e ./extensions/<other> -p "..."`
- If behavior may depend on cwd, also test from a **neutral temp directory**.
- Use `pi list` as a source-of-truth check before debugging load behavior.
- Use `pi --mode json` or isolated subprocess smoke tests where appropriate.

### Publish-ready validation

For publish candidates:

- run Biome checks on changed files
- run `npm pack --dry-run`
- test the packed tarball in a temp dir
- verify functional behavior from the tarball install, not just local source loading

Prefer tarball-based tests over `npm install /path/to/dir`, which can hide packaging issues.

### Dual-context validation rule (local + global)

For owned packages (`@gaodes/*`), validate in both contexts:

1. **Local dev context** (this repo, local paths shadow global)
   - confirms current source behavior before release

2. **Global installed context** (spawn Pi from a different directory, outside this repo)
   - confirms real user behavior after `pi update` / global install
   - avoids false confidence from project-local overrides

When testing global behavior, launch a fresh subprocess/session from a neutral directory (e.g. `/tmp`) and run the target command/tool there.

## Publishing and packaging workflow

When publishing an extension/package from this repo:

1. **Scope the release unit**
   - keep the release focused on one package unless a coupled publish is intentional

2. **Prepare metadata**
   - update that package's `CHANGELOG.md`
   - bump the package version as needed in package metadata
   - keep any mirrored release metadata in sync if the package uses it (for example `extensions/pure-dev-kit/tmp/package.json`, which mirrors lightweight publish metadata)
   - make sure the version bump and changelog entry are both in place before publish

3. **Preflight quality checks**
   - lint/type-check relevant files
   - run `npm pack --dry-run`
   - confirm packaging boundaries (`files`, `.npmignore`, shipped metadata)

4. **Runtime smoke tests**
   - test repo-root behavior
   - test tarball-install behavior in a temp dir

5. **Commit and push**
   - after tests are valid, stage only release-relevant files and create the release commit automatically
   - use scoped conventional commits
   - **ask for explicit confirmation before pushing** to the canonical branch

6. **Publish**
   - publish from the package directory
   - when packages are coupled, publish dependency-first
   - **ask for explicit confirmation before npm publish**

7. **Post-publish verification**
   - verify registry version
   - if npm briefly returns 404/not found, wait and retry
   - validate real install behavior in a clean temp directory
   - run one global-context command smoke test from outside this repo after `pi update` (or equivalent global package refresh)

### Packaging guidance

- Use `pi install npm:...`, `pi install git:...`, or local paths as appropriate.
- Use object-form package filtering in settings when narrowing active resources.
- Keep manifest paths explicit and correct.
- Include gallery metadata (`video`, `image`) when appropriate for published packages.
- Treat per-package changelogs as mandatory, not optional.

### Versioning policy

Use explicit semantic-versioning discipline for published packages in this repo:

- **Patch** — small fixes, polish, compatible maintenance work, small improvements, or additive tweaks that do not materially change package scope or migration expectations.
- **Minor** — larger additive features, meaningful new capabilities, or noticeable but backward-compatible workflow improvements.
- **Major** — breaking changes, contract changes, loader/activation changes, public API changes, migration-requiring package reorganizations, or **large refactorings** that materially change how the package is used or maintained.

When deciding between patch and minor, prefer:

- **patch** for small or low-risk improvements
- **minor** for clearly user-visible additive capability

When a refactor meaningfully changes contracts, architecture, migration expectations, or package roles, treat it as **major**, even if the feature list looks similar.

## `.upstream.json` contract

Every extension/package directory should include `.upstream.json` documenting upstream lineage and synchronization intent.

Required shape:

```json
{
  "version": 1,
  "updatedAt": "YYYY-MM-DD",
  "primary": {
    "name": "<upstream name>",
    "type": "repo | package",
    "url": "<https://... | npm:...>",
    "license": "<optional license>",
    "relationship": "fork | synced-source | upstream"
  },
  "otherSources": [
    {
      "name": "<optional secondary source>",
      "type": "repo | package",
      "url": "<https://... | npm:...>",
      "license": "<optional license>",
      "relationship": "historical-ancestor | reference"
    }
  ]
}
```

Use this to document:

- canonical lineage
- sync intent
- historical ancestry
- source-of-truth relationships

`license` is optional. Include it when it is useful for preserving upstream attribution or licensing context.

## Commit and maintenance expectations

Use scoped conventional commits. Common types here include:

- `feat:`
- `fix:`
- `refactor:`
- `docs:`
- `chore:`
- `test:`
- `perf:`
- `ci:`
- `todo:` when intentionally tracking incomplete work

Additional rules:

- scope narrowly to the package/resource being changed
- in a dirty monorepo, stage intentionally
- update docs when behavior, workflow, packaging, or migration expectations change
- update per-package changelog when shipping user-visible changes
- make version bumps consistent with the versioning policy above before publishing
- after validation passes, the agent should commit automatically (scoped, intentional staging)
- the agent must request confirmation before any push and before any npm publish

## Session closure and AGENTS.md self-improvement

At the end of each session, the agent should run a brief process retro and improve this `AGENTS.md` when durable learnings emerge.

Required behavior:

- read the **entire** `AGENTS.md` before editing it, so updates are placed in the correct section and do not break document structure
- add only durable, reusable guidance (not transient task noise)
- integrate findings into existing sections when possible; create a new subsection only when the topic does not fit cleanly
- keep wording concise, mechanism-focused, and aligned with repository conventions
  \*\*

### Compact execution checklists

#### Release gate checklist (before release actions)

- [ ] Local validation passed (repo-root + neutral/global-like context)
- [ ] `npm pack --dry-run` checked for expected package contents
- [ ] docs/changelog/version metadata updated and consistent
- [ ] scoped commit created from intentionally staged files
- [ ] user confirmation received for **push**
- [ ] user confirmation received for **npm publish**

#### Session-end checklist (before task closure)

- [ ] run brief retro of what worked/failed this session
- [ ] read full `AGENTS.md` before any self-improvement edit
- [ ] add only durable guidance, integrated into existing sections when possible
- [ ] avoid transient/noisy updates and keep wording concise/mechanism-focused

## Known quirks and anti-stumble checks

- **Duplicate registration conflicts** usually mean the same package is active globally and locally; fix this with project-level shadowing, not by uninstalling the global package.
- **Project overrides can hide global reality**; test both repo-local and temp-dir/global-like contexts when debugging.
- **Project settings arrays replace, they do not append**; in `.pi/settings.json`, fields like `packages`, `extensions`, `skills`, `prompts`, and `themes` override the global arrays entirely, while nested objects still merge.
- **`pi list` is mandatory** before deep debugging of load origin questions.
- **Developer utility tools should degrade gracefully** where practical; prefer useful fallback behavior plus provenance over brittle failure in general repo workflows.
- **This repo may be dirty for unrelated reasons**; release commits must stay intentionally scoped.
- **npm propagation is not instant**; verify twice before assuming publish failure.
