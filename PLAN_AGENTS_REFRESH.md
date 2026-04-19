# Plan: Refresh pi-pure-ecosystem AGENTS.md

Date: 2026-04-19
Status: Revised draft for review — implementation pending

## Context

The `AGENTS.md` governing the pi-pure-ecosystem has accumulated stale references, missing sections, and outdated patterns since Pi 0.67.x. It still provides a strong foundation, but it no longer fully reflects:

- the current Pi documentation
- the current Pure ecosystem architecture
- the intended workflow for developing, testing, shadowing, and publishing owned extensions from this repo
- the actual local roles of `pure-dev-kit` and `pure-foundation`, both of which are published npm packages in this ecosystem

Sources consulted:
- Pi core docs at `/opt/homebrew/lib/node_modules/@mariozechner/pi-coding-agent/docs/`
  - `extensions.md`
  - `skills.md`
  - `themes.md`
  - `packages.md`
  - `development.md`
  - `tui.md`
- Community resources and examples
  - `tomsej/pi-ext`
  - lobehub skill examples
  - Pi package/gallery conventions
  - Pi examples and package docs
- Internal memory cards on:
  - extension API gotchas
  - Pi 0.67 session-event changes
  - package/filter behavior
  - theme pitfalls
  - pure-ecosystem workflow patterns

---

## Core adjustment to the governing philosophy

Before editing the file, the plan needs one architectural correction.

### Replace this older assumption
- Extensions are self-contained and should avoid shared code by default.

### With this updated ecosystem rule
- **All Pure ecosystem resources are first-class citizens**: extensions, skills, themes, and prompts/templates where applicable.
- **Extensions are self-contained by default**, but **stable reusable cross-extension tools, UI primitives, render helpers, and shared ecosystem utilities belong in the shared utility layer**.
- **Do not duplicate reusable tools across multiple extensions.** If a helper becomes clearly reusable and stable, promote it into the shared utility layer.
- Keep **extension-specific business logic local**. Promote only proven shared primitives.

### Important architecture note to preserve in the rewrite
There is now a terminology/architecture point that the rewrite must handle explicitly:
- earlier planning used **`pure-utils`** as the shared utility destination
- the newly appended AGENTS addendum describes **`pure-foundation`** as the shared foundation/UI layer and gives it an explicit role

The rewritten `AGENTS.md` should **not silently collapse or ignore that distinction**.
Instead, it should either:
1. reconcile the names and roles clearly, or
2. document the current intended architecture precisely if both concepts are still meaningful

This is now a required part of the rewrite.

---

## New preservation target: the appended local workflow addendum

The section appended after the separator — starting with **"Local-First Loading Policy for Owned Extensions"** — contains concrete, repo-specific workflow examples that should be **preserved and normalized**, not erased.

The rewrite should retain the substance of that addendum while integrating it more cleanly into the overall document.

### These concrete policies/examples must survive the rewrite
- local-first loading for owned extensions
- project-level package shadowing instead of uninstalling owned global packages
- canonical `.pi/settings.json` shadowing pattern
- verification via `pi list`
- cwd-sensitive smoke testing (repo root + neutral temp dir)
- new-session bootstrap checklist for extension development/publishing
- per-extension `.upstream.json` contract
- explicit roles for shared foundation/dev tooling packages
- Pure Dev Kit tool-first workflow expectations
- tarball-first publish verification flow
- dependency-first publish ordering where packages are coupled
- anti-stumble checks (duplicate registration, dirty monorepo risk, npm propagation delay)

---

## Pass 1: Fix stale or incorrect content

### 1. Fix broken documentation references
- Remove or replace the dead `badlogic/pi-mono` URL in the publishing section.
- Point to local Pi docs or describe the docs generically without hardcoding stale GitHub URLs.

### 2. Fix inaccurate project structure
- Remove `.worktrees/` from the structure if it is not actually present in the repo.
- Ensure the listed structure reflects the real repo layout, not aspirational layout.

### 3. Fix outdated Pi lifecycle references
- Ensure the file reflects Pi 0.67+ session/event behavior.
- Replace any implication of removed events/patterns with current ones, especially:
  - `session_before_switch`
  - current reload/resume/fork expectations

### 4. Fix activation/loading model language
The current “Activation tiers” wording is too generic for this repo.

Rewrite it to distinguish:
- **resource source**: local path, npm package, git package
- **active scope**: global settings, project settings, temporary `-e` loads
- **local-first owned-package shadowing policy** inside this development repo

Also preserve isolated testing modes:
- `pi -e <path-or-package>`
- `pi --no-extensions -e ...`
- `.pi/settings.json` project override workflows

---

## Pass 2: Preserve and normalize the new concrete workflow examples

### 5. Preserve the Local-First Loading Policy for Owned Extensions
This should become an explicit repo policy section, not just an appended note.

It should state:
- for **owned extensions** (`gaodes`), keep global installs intact for normal usage
- inside this development repo, **force local source precedence**
- do **not** uninstall or disable owned global packages merely to develop them here
- prefer **project-level shadowing** plus local paths

### 6. Preserve the canonical project shadowing pattern
Keep a concrete `.pi/settings.json` example showing:
- object-form package shadowing with empty resources
- local extension paths loaded immediately after

This example should remain concrete and operational, not abstract.

### 7. Preserve the repo bootstrap checklist
The “New Session Bootstrap for Extension Development + Publishing” section should be normalized into a durable startup checklist for work in this repo.

It should include:
1. confirm local-first package shadowing
2. confirm no duplicate registration conflicts
3. run quick smoke tests in repo root
4. run preflight for publish candidates

### 8. Preserve cwd-sensitive verification rules
The rewrite should explicitly preserve the policy that some tools must be tested from:
- repo root
- neutral temp directory

This belongs in the testing/validation workflow, not as a stray footnote.

### 9. Preserve `.upstream.json` as a repo contract
Add a dedicated section describing:
- `.upstream.json` as required extension metadata
- required fields and purpose
- how it documents lineage, sync intent, and source-of-truth relationships

This is a major addition and should become a formal part of the repo’s extension contract.

### 10. Preserve package role definitions
The addendum includes explicit role definitions for shared foundation/dev-tooling packages.
The rewrite should preserve those ideas in a cleaner structure.

Specifically:
- preserve the role of the shared foundation layer
- preserve the role of the developer-tooling layer
- clarify how these roles relate to the shared utility governance model
- reconcile this with the `pure-utils` direction rather than ignoring the overlap

### 11. Preserve the Pure Dev Kit tool-first workflow guidance
Add a workflow rule that for Pi-version/docs/changelog/package-manager questions, agents should prefer the relevant Pure Dev Kit tools first, instead of manually hunting documentation or version metadata:
- `pi_version`
- `pi_docs`
- `pi_changelog_versions`
- `pi_changelog`
- `detect_package_manager`

These should be documented as the default workflow tools for this repo when developing extensions. Manual file/URL inspection should only happen when those tools are insufficient for the task.

### 12. Preserve the detailed publish runbook
The detailed release flow in the addendum should be preserved as a concrete operational workflow, including:
- scope release unit
- update changelog
- bump patch version
- sync mirrored release metadata where applicable
- run `npm pack --dry-run`
- test packed tarball in temp dir
- commit/push
- publish
- post-publish verification
- dependency-first publish ordering when packages are coupled
- npm propagation delay awareness

---

## Pass 3: Add the missing resource sections

### 13. Add an explicit Extensions section
Strengthen the current repo conventions into a real extension-governance section.

It should define:
- every `pure-*` extension as a **first-class Pi resource**
- Pi APIs first, npm deps only when justified
- branch/session-safe state handling
- hot-reload expectations
- terminal-aware rendering expectations
- extension-specific logic stays local
- reusable stable cross-extension helpers move into the shared utility layer

### 14. Add a Skills section
The repo has a `skills/` directory but the governing document does not explain how skills fit into the ecosystem.

This section should cover:
- when to use a **skill** vs **extension** vs **prompt template**
- naming conventions (kebab-case, lowercase, 1–64 chars, no consecutive hyphens)
- Agent Skills spec compliance
- required frontmatter (`name`, `description`) and useful optional fields (`allowed-tools`, `disable-model-invocation`)
- relationship to `pure-extensions-dev` and `create-skill`
- expectation that skills also meet a first-class quality bar

### 15. Add a Themes section
Themes are first-class Pi resources but currently under-documented in this AGENTS.md.

This section should cover:
- themes as first-class ecosystem outputs
- required theme schema and token completeness
- hot reload behavior
- readability and contrast expectations
- testing themes across real TUI states
- theme-aware extension behavior
- reference patterns from `pure-theme` and `pure-statusline`

### 16. Add a Prompts / Prompt Templates section
Shorter than skills/themes, but still explicit.

This section should cover:
- when a prompt template is preferable to a skill
- where prompt templates belong
- avoiding workflow logic in prompts when it should become a skill

### 17. Add a Shared Utilities / shared foundation section
This is the most important structural addition after the local-first workflow.

The rewrite should be informed by the actual local packages:
- `pure-dev-kit` = published developer-tooling extension (tools, commands, skills, prompts) for building and maintaining Pi extensions
- `pure-foundation` = published shared foundation layer exposing reusable UI/components/primitives/widgets/helpers used across the ecosystem

This section should define:

#### What belongs in the shared utility layer
- shared rendering helpers
- reusable tool call/result UI components
- stable TUI primitives
- common Pi/environment discovery helpers
- common formatting/parsing helpers
- shared utilities used by multiple extensions

#### What does not belong there
- extension-specific product logic
- unstable one-off prototypes
- code only one extension needs
- tightly coupled feature behavior

#### Promotion rule
A helper graduates into the shared utility layer when it is:
- reused by multiple extensions, or
- clearly an ecosystem primitive worth standardizing

#### Duplication rule
- do not re-copy the same reusable helper into multiple extensions
- if it is reusable and stable, move it into the shared layer
- if it is specific or still experimental, keep it local

#### Required reconciliation task
The rewrite must explicitly resolve how this section refers to:
- `pure-utils`
- `pure-foundation`
- any other current shared package naming

The final AGENTS should present one coherent model grounded in the actual local package roles. In particular, it must not ignore that `pure-dev-kit` already depends on `@gaodes/pure-foundation` and uses it as the current shared foundation layer.

---

## Pass 4: Strengthen the existing standards

### 18. Expand the First-Class Citizen Standard
Keep the concept, but make it more concrete and aligned with the Pi docs.

Add explicit standards for:

#### API correctness
- use Pi APIs first
- use current event names and lifecycle hooks
- prefer official extension points over workarounds

#### Tool correctness
- use `StringEnum` when needed for string enums
- use `prepareArguments` for backward compatibility when relevant
- throw from `execute()` to signal errors properly
- use `promptSnippet` / `promptGuidelines` intentionally
- truncate large outputs correctly
- use `withFileMutationQueue()` for file-mutating tools

#### State correctness
- persist reconstructable state in `details`
- survive reload/resume/tree navigation correctly
- avoid fragile in-memory-only assumptions for important state

#### UI correctness
- keep default render compact
- show detail on expansion
- use theme tokens correctly
- respect terminal width and wrapping
- use custom shells only when justified

#### Testing correctness
- smoke-test before promotion
- verify load behavior
- verify isolation behavior
- test hot reload where relevant

#### Packaging correctness
- correct manifest paths
- correct peerDependencies vs dependencies usage
- avoid bundling Pi core packages incorrectly

#### Developer utility behavior
Preserve the spirit of the addendum’s tool expectations:
- developer utility tools should degrade gracefully where appropriate
- prefer usable fallback behavior over brittle hard failure when the tool is intended for broad repo workflows
- document provenance/diagnostic output when fallback behavior is used

### 19. Expand extension API and workflow coverage
Add guidance for Pi APIs/patterns currently missing from the AGENTS.md:
- `pi.events`
- `pi.setActiveTools()` / `pi.getAllTools()` / `pi.getActiveTools()`
- `pi.registerMessageRenderer()`
- dynamic tool registration
- `ctx.getContextUsage()`
- `ctx.compact()`
- `ctx.getSystemPrompt()`
- `ctx.reload()` command-driven pattern

### 20. Add a resource lifecycle section
Define a clean lifecycle for Pure ecosystem resources:
1. prototype locally
2. validate in isolation
3. promote shared parts into the shared utility layer if reusable
4. document behavior
5. update per-resource changelog
6. publish when broadly useful

This turns the document from a static rules file into a repeatable development system.

---

## Pass 5: Improve workflow, testing, and publishing guidance

### 21. Strengthen development workflow
Expand the workflow section with:
- `pi --mode json` smoke testing
- isolated subprocess testing patterns
- local/global override conflict avoidance
- `pure-git` worktree workflow reference
- `pure-extensions-dev` as the canonical extension-dev workflow helper
- `pure-dev-kit` as the default extension-development toolbox for Pi docs/version/changelog/package-manager questions
- preference order: Pure Dev Kit tools first for extension-development context, then other Pi tools/extensions/skills, then manual inspection, then bash
- `pi list` as a source-of-truth check before debugging load behavior

### 22. Strengthen testing and validation workflow
Add explicit validation guidance for:
- repo-root smoke tests
- neutral temp-dir smoke tests where cwd matters
- tarball-based install tests for publish candidates
- duplicate tool registration detection
- source-of-truth verification before deeper debugging

### 23. Strengthen publishing/package guidance
Modernize publishing guidance with:
- `pi install npm:` / `pi install git:` / local path installs
- package filtering behavior in settings
- correct package-manifest usage
- gallery metadata (`video`, `image`) when publishing
- per-extension changelog discipline
- versioning strategy expectations
- tarball-first publish verification
- dependency-first publish ordering when packages are coupled
- npm propagation delay checks after publish

### 24. Strengthen commit and maintenance guidance
Expand the commit guidance to include:
- `docs:`
- `chore:`
- `test:`
- `perf:`
- `ci:`
- scope expectations
- when documentation updates must accompany code changes
- staging discipline in a dirty monorepo context

---

## Recommended final structure for the rewritten AGENTS.md

1. Philosophy
2. Repo purpose
3. Project structure
4. Resource types in this ecosystem
   - extensions
   - skills
   - themes
   - prompts
5. Core conventions
6. First-Class Citizen Standard
7. Shared utility / foundation governance
8. Pure Dev Kit workflow preference
9. Activation / loading model
10. Local-first loading policy for owned extensions
11. Repo bootstrap checklist
12. Testing / validation workflow
13. Publishing / packaging workflow
14. `.upstream.json` contract
15. Commit / changelog expectations
16. Known quirks / anti-stumble checks

---

## Non-goals (keep as-is unless cleanup is needed)

- Philosophy should remain concise and opinionated
- Flat extension layout remains the default convention
- Biome remains the default lint/format tool
- The first-class citizen concept remains central — it just needs expansion and clarification
- Concrete workflow examples should remain present; they should just be integrated more cleanly

---

## Verification after implementation

1. Read the new `AGENTS.md` as if onboarding a fresh agent to the repo.
2. Confirm there are no dead links, fake directories, or removed API references.
3. Confirm all first-class resource types are covered:
   - extensions
   - skills
   - themes
   - prompts
4. Confirm the shared-utility/shared-foundation model is explicit and coherent.
5. Confirm the local-first owned-extension shadowing policy is preserved clearly.
6. Confirm the `.upstream.json` contract is documented clearly.
7. Confirm the Pure Dev Kit tool-first workflow is preserved and prioritized over manual documentation checks in extension-development context.
8. Confirm the actual local roles of `pure-dev-kit` and `pure-foundation` are reflected accurately.
9. Confirm the tarball-first publishing workflow is preserved.
10. Confirm the document is actionable, not aspirational.
11. Confirm the workflow reflects current Pi docs and current repo reality.
