# Import a Pure Extension

This skill analyzes one or more external Pi extension source repos, plans the adaptation and implementation, and produces a pure-ecosystem extension adapted to the project's conventions and the user's requirements.

**Scope**: the source must be a Pi extension (using `@mariozechner/pi-*` APIs). For importing general npm packages or scripts, use `create.md` and build from scratch instead.

## When to Use

| Request | Read this instead |
|---------|------------------|
| Build a new extension from scratch | `create.md` |
| Add features to an extension we own | `enhance.md` |
| Sync an extension with upstream | `update.md` |
| Publish to npm | `publish.md` |

---

## Conventions (Source of Truth)

These conventions apply to **all** extension work in this mono repo. Other sub-skills reference this section.

### What to Build

| Goal | Build a... | Key files |
|------|------------|----------|
| Teach Pi a workflow | **Skill** | `SKILL.md` with YAML frontmatter |
| New tool, command, or behavior | **Extension** | `index.ts` entry point |
| Reuse a prompt pattern | **Prompt template** | `.md` with `{{variable}}` |
| Project coding guidelines | **Context file** | `AGENTS.md` |
| Change Pi's appearance | **Theme** | `theme.json` |

**Skill vs Extension**: if `bash` + instructions can do it, prefer a **Skill**. Use **Extension** for event hooks, typed tools, UI components, or policy enforcement.

### Extension Conventions

- **Name**: `pure-<name>`
- **Structure**: single `index.ts`. Split only if unwieldy.
- **package.json**: only if npm deps needed
- **Self-contained**: inline path helpers, no cross-extension deps
- **TypeBox**: `Type`, `Static` for tool parameters
- **Storage paths**:
  - Global: `~/.pi/agent/pure/{config,cache}/pure-<name>.json`
  - Project: `<project>/.pi/pure/{config,cache}/pure-<name>.json`
- **Config reads**: project first, fall back to global
- **CHANGELOG.md**: GitHub-style (`## [version] - YYYY-MM-DD`)

### Path Helpers (inline in every extension)

```typescript
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync } from "fs";
import { join } from "path";

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
    const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
    const dir = join(root, category);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return { dir, file: join(dir, filename) };
}

function readPureJson<T = unknown>(filename: string, category: "config" | "cache", scope: "global" | "project" = "global", cwd?: string): T | undefined {
    const { file } = getPurePath(filename, category, scope, cwd);
    try { return JSON.parse(readFileSync(file, "utf-8")); }
    catch { return undefined; }
}

function loadConfig<T>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
    const project = readPureJson<T>(filename, category, "project", cwd);
    if (project !== undefined) return project;
    return readPureJson<T>(filename, category, "global");
}
```

### Extension Template

```typescript
import { type Static, Type } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// Path helpers (inline from above)
// ...

const parameters = Type.Object({ /* your parameters */ });
type MyToolParams = Static<typeof parameters>;

const myTool = {
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does.",
  parameters,
  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ output: "working..." });
    return { content: [{ type: "text", text: "result" }] };
  },
};

export default function (pi: ExtensionAPI) {
  pi.registerTool(myTool);
}
```

### Mode Awareness

| Mode | `ctx.hasUI` | Behavior |
|------|-------------|----------|
| Interactive | `true` | Full TUI |
| RPC | `true` | JSON protocol |
| Print (`-p`) | `false` | No UI |

- **Fire-and-forget** (no `hasUI` check needed): `ctx.ui.notify()`, `ctx.ui.setStatus()`, `ctx.ui.setWidget()`
- **Dialog methods** (need fallback): `select()`, `confirm()`, `custom()` → return `undefined` / `false` in print mode

### Critical Rules

1. **Execute order**: `(toolCallId, params, signal, onUpdate, ctx)`
2. **Always `onUpdate?.()`** — optional chaining
3. **No `.js` in imports**
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback — use explicit sentinels for close/cancel
5. **Error detection**: check for missing `details` fields (framework sets `{}` on throw)
6. **Signal forwarding**: pass to all async operations
7. **Never `child_process`**: use `pi.exec()`
8. **Never `homedir()`**: use `getAgentDir()`
9. **Typed param alias**: `type MyParams = Static<typeof parameters>`
10. **Entry point pattern**: load config → check enabled → register
11. **API key gating**: check before registering tools — notify if missing
12. **No unused `_signal`**: forward or remove — never prefix with `_` if actually used
13. **Check existing components**: before creating custom TUI, check `pi-tui` or `pi-coding-agent`
14. **Settings UI**: use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

### Dependency Audit

For each third-party import, check if Pi provides an equivalent:

| Original | Pi API | Replace? |
|----------|--------|----------|
| `child_process.exec/spawn` | `pi.exec()` | Yes — unless extension needs streaming/pty |
| `os.homedir()` | `getAgentDir()` | Yes — always |
| `fs.*Sync` for JSON config | Inline `getPurePath()` helpers | Yes — shared config/cache pattern |
| `@aliou/*` packages | Inline or `@mariozechner/*` | Yes — third-party, not bundled by Pi |
| `@sinclair/typebox` | Keep — Pi bundles it | Import in code, not in package.json |
| `fetch` | Keep — built-in | No change needed |

**Flag each replacement to the user. Only replace if functionality is preserved.** Let the user make the final call.

### Check, Lint, Test

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test** (isolated subprocess — safe, no conflicts):
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5
```

**Functional test in a worktree**:
1. Call `switch_worktree` tool to switch session to the worktree
2. User tests the extension
3. Switch back to main: `switch_worktree` with branch `main`

### Worktree Workflow

All non-trivial changes happen in a worktree:

```bash
/worktrees create <branch-name>
```

Set up `.worktrees/<branch-name>/.pi/settings.json`:
```json
{ "packages": ["./extensions/pure-<name>"] }
```

If the extension is **globally active**, remove it from `~/.pi/agent/settings.json` to avoid loading it twice.

When done:
```bash
/worktrees clean <branch-name>
```

Then restore globally-active extensions to `~/.pi/agent/settings.json` and `/reload`.

### Reference Files

Load on demand — only when you need specific API details. Each is a deep guide on one topic.

| File | Load when... |
|------|-------------|
| `references/api-reference.md` | You need the full Pi API catalog (packages, tools, hooks, commands, TUI) |
| `references/tools.md` | Implementing tool registration, rendering, error handling |
| `references/modes.md` | Handling Interactive/RPC/Print mode differences |
| `references/commands.md` | Registering slash commands |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/components.md` | TUI component authoring |
| `references/providers.md` | Provider registration |
| `references/structure.md` | Extension directory structure for standalone repos |
| `references/testing.md` | Testing patterns |
| `references/state.md` | State management |
| `references/publish.md` | Publishing workflow details |
| `references/additional-apis.md` | Additional Pi API references |
| `references/documentation.md` | Documentation patterns |

---

## Phase 1: Analysis

### 1. Gather sources

The user provides **at least one link** to a repo or extension to import. They may provide multiple.

For each source, clone into a temporary directory:
```bash
git clone --depth 1 <repo-url> /tmp/<source-name>
```

For each source:
- Read README, package.json, source files
- Understand what it does, its structure, and quality
- Check if the source itself credits inspirations (other repos it forked/derived from) — trace the full lineage

Then read the project conventions:
- Read `AGENTS.md` at the repo root — this defines naming, structure, API usage, and workflow rules
- Consult `references/api-reference.md` for the full Pi API surface (packages, tools, hooks, commands, components)

> **Cleanup**: delete temporary clones (`rm -rf /tmp/<source-name>`) after Phase 2 planning is complete and you no longer need to reference the raw source.

### 2. Analyze and decide

Analyze all sources together with the user's request and decide on:

**Primary source** (if multiple):
- Pick one repo to base the extension on
- Note improvements from other sources for future implementation
- If only one source: it becomes the primary by default

**Approach:**

| Approach | When to use |
|----------|------------|
| **Clone and adapt** | The source is a well-structured Pi extension that mostly works. Copy it, rename, strip, adapt. |
| **Write from scratch** | The source is messy, uses wrong patterns, or the user wants significant changes. Use it as a reference but implement clean. |

Factors:
- Code quality and compatibility with Pi APIs
- How much needs to change (rename, deps, patterns)
- Whether the source uses deprecated APIs or anti-patterns

**Dependency pre-audit:**

Before deciding the approach, scan the source for third-party imports that will need replacement. This informs the clone-adapt vs scratch decision — heavy dependency replacement favors scratch. See the Dependency Audit table in Conventions above for the full replacement map.

**Name:**
- Follow the `pure-<name>` convention
- Short, descriptive, memorable
- Should reflect what the extension does, not where it came from
- Avoid names that conflict with existing extensions

**Check for conflicts:**
```bash
ls extensions/pure-<name>/ 2>/dev/null && echo "EXISTS" || echo "OK"
```
If the directory already exists, either pick a different name or use `enhance.md` instead.

**Check for integration opportunities:**

Scan existing extensions in `extensions/` for:
- Shared utility patterns (config/cache helpers)
- Overlapping tool registrations or commands that could conflict
- Opportunities to reuse code from existing extensions instead of duplicating

Record findings in the PLAN.md (see "Integration notes" section in the template).

### 3. Present analysis for approval

Present everything to the user in one consolidated summary:
- Primary source (why chosen) + upstream lineage found
- Approach (clone-adapt or write-from-scratch) with rationale
- Dependency pre-audit results — imports that will need replacement
- Integration findings — shared patterns or conflicts with existing extensions
- Proposed name
- Features to implement now vs. later

Get user approval before proceeding to planning.

**Heuristic for "now" vs. "later" features:**
- **Now**: core functionality the extension needs to be useful, features the user specifically requested
- **Later**: nice-to-haves, features that need additional deps or significant refactoring, things from secondary sources

---

## Phase 2: Planning

### 4. Create a plan file

Create a branch from main and the extension directory:

```bash
git checkout main
git checkout -b <name>-import
mkdir -p extensions/pure-<name>
```

Create `extensions/pure-<name>/PLAN.md` with the template below, then commit it:

```bash
git add extensions/pure-<name>/PLAN.md
git commit -m "pure-<name>: plan for import from <primary-source-repo-name>"
```

Template:

```markdown
# pure-<name>

## Source
- **Primary**: <repo-url> @ <commit-sha>
- **Inspirations**: <upstream-of-upstream if any>

## Approach
<clone-and-adapt or write-from-scratch>

## Features to implement now
- [ ] Feature 1
- [ ] Feature 2

## Features for later
- Feature 3 (from <source-repo>)
- Feature 4 (from <source-repo>)

## Breaking changes from source
- Rename X to Y
- Removed Z because...

## Dependency replacements
| Original | Replacement | Reason |
|----------|------------|--------|
| _example: `child_process.exec` | `pi.exec()` | Pi API convention_ |
| _example: `os.homedir()` | `getAgentDir()` | Pi API convention_ |

## Integration notes
- Shared patterns with existing extensions: <e.g. "needs getPurePath() — copy from pure-cron">
- Potential conflicts: <e.g. "tool name overlaps with pure-xyz">
- Reuse opportunities: <e.g. "pure-abc already has similar client logic">

## License
<original license type> — preserved from <primary-source>

> If the source has no license or is proprietary, **stop and inform the user** before proceeding. Importing proprietary code may violate the source's terms.

## Sources for future updates
- <primary-repo-url>
- <secondary-repo-url> (for feature X, Y)
```

### 5. User reviews plan

Present the plan to the user. Iterate together until satisfied.

**Do not proceed to implementation until the user explicitly says to start.**

### 6. Set up development environment

After plan approval, create a worktree for the implementation:

```bash
git checkout main
git worktree add .worktrees/<name>-import <name>-import
cd .worktrees/<name>-import
```

> **CWD tracking**: after `cd`, all subsequent commands run from the worktree root (`<main-repo-root>/.worktrees/<name>-import/`). Verify with `pwd` if unsure. When step 9 says `cd <main-repo-root>`, use the original main repo path (e.g. `cd ~/Agents/workspaces/pilab/projects/pi-pure-ecosystem`).

For **development on main** (no worktree) — stay on `<name>-import` from step 4:
```bash
# Already on <name>-import, ready to implement
```

---

## Phase 3: Implementation

### 7. Implement the extension

Based on the plan:

**If cloning and adapting:**
- Copy source files into `extensions/pure-<name>/` (alongside the existing PLAN.md — exclude any source `PLAN.md` from the copy):
  ```bash
  rsync -av --exclude='PLAN.md' /tmp/<source-name>/ extensions/pure-<name>/
  ```
- Strip: `.git/`, `node_modules/`, lockfiles, CI configs, `.github/`, test fixtures
- Flatten `src/` to root when the extension is small (≤5 files). Keep subdirectories when justified by size or logical separation (e.g. `services/`, `tools/`). Don't force flat structure if it hurts readability.
- Rename to pure-* conventions (tool names, commands, storage paths)
- Ensure the entry point is `index.ts` at the extension root (rename if source uses `main.ts`, `src/index.ts`, etc.)

**If writing from scratch:**
- Create directory structure following pure-* conventions
- Ensure the entry point is `index.ts` at the extension root
- Implement each feature from the "Features to implement now" section of PLAN.md, using the source as reference. Start with core functionality, then add secondary features.

**Then for both approaches:**
- Check the source license — preserve it in a `LICENSE` file and note it in README
- Replace deps with Pi APIs where functionality is preserved (see Dependency Audit in Conventions)
- Inline the `getPurePath()` helpers from Conventions above for config/cache storage
- If the source imports from `@aliou/*` packages, replace with inline implementations or equivalents from `@mariozechner/pi-tui` and `@mariozechner/pi-coding-agent`
- Create `package.json` with name, version, and any runtime dependencies from the source. The publish skill will expand the manifest later.
  ```json
  {
    "name": "@gaodes/pi-pure-<name>",
    "version": "0.1.0",
    "dependencies": { "<runtime-dep>": "<version>" }
  }
  ```
  Omit `dependencies` if the source has no runtime deps. **Never put `@mariozechner/pi-*` packages in `dependencies`** — they're peer dependencies and will be added at publish time.
- Create `.npmignore` (standard template: `node_modules/`, `CHANGELOG.md`, `.DS_Store`, `*.tmp`)
  > **Note**: `node_modules/` is typically covered by the root `.gitignore`. If not, create a `.gitignore` in the extension directory with `node_modules/`.
- Install dependencies if `package.json` has any: `(cd extensions/pure-<name> && npm install)`
- Create `CHANGELOG.md` with initial entry:
  ```markdown
  ## [0.1.0] - YYYY-MM-DD
  ### Added
  - Initial import from [<primary-source-repo-name>](<repo-url>)
  ```
- Create `.upstream` file for automation
- Create `README.md` with full Sources / Inspiration lineage

#### Sources / Inspiration

README must include the full derivation chain:
- **Primary source** — the repo you forked from, with license
- **Upstream of upstream** — if the primary source itself was derived from another project
- **Other sources** — repos that contributed ideas but aren't the primary
- **License** — the original source's license type

Example:
```markdown
## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Original decision guide. Licensed MIT.

## License

MIT (inherited from primary source)
```

#### `.upstream` file

Machine-readable file for future sync automation:

```json
{
  "primary": {
    "url": "<repo-url>",
    "sha": "<commit-sha-at-import>",
    "importedAt": "YYYY-MM-DD"
  },
  "sources": [
    { "url": "<secondary-repo>", "note": "Feature X, Y for future" }
  ]
}
```

### 8. Check, lint, test

Run from the **repo root** (or worktree root if in a worktree):

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test (isolated subprocess — safe, no conflicts):**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

If either fails, fix the issues and re-run. If issues persist after 3 attempts, stop and consult the user — the extension may need fundamental changes.

**Functional test — choose one based on your setup:**

For **worktree** development:
1. Create `.pi/settings.json` in the worktree root:
   ```json
   { "packages": ["./extensions/pure-<name>"] }
   ```
2. Functional test: call `switch_worktree` tool to switch session, user tests, switch back.

For **development on main** (no worktree):
1. Add `"./extensions/pure-<name>"` to `.pi/settings.json` packages
2. Ask user to `/reload` and test

**Do not proceed to commit (step 9) until the user confirms the functional test passes.**

---

## Phase 4: Commit

### 9. Commit and push

Delete `PLAN.md` — the planning history is preserved in git, but it shouldn't ship with the extension:

```bash
rm extensions/pure-<name>/PLAN.md
git add extensions/pure-<name>/
git commit -m "pure-<name>: initial import from <primary-source-repo-name>"
```

If in a worktree, clean up from the **main repo root**:

```bash
cd <main-repo-root>
git checkout main
git merge <name>-import
git worktree remove .worktrees/<name>-import
git branch -d <name>-import
```

Or use the user-facing command: `/worktrees clean <name>-import`. If the merge has conflicts, resolve them before continuing. Then push:

```bash
git push
```

Otherwise (no worktree), merge to main and push:

```bash
git checkout main
git merge <name>-import
git branch -d <name>-import
git push
```

**Cleanup temporary clones:**
```bash
rm -rf /tmp/<source-name>
```

**This completes the import.** The extension is now on `main` and pushed to GitHub.

**What happens next (separate sub-skills):**
- Publishing to npm → read `publish.md`
- Global activation → handled during publish
- Do NOT publish to npm as part of this skill.

> **Cleanup**: if you added the extension to `.pi/settings.json` for testing, remove it after the import is committed — it will be loaded from the global settings after publishing.

---

## Import-Specific Rules

These supplement the Critical Rules in Conventions:

1. **Dependency audit**: flag every Pi API replacement to the user — only replace if functionality is preserved. User makes the final call.
2. **Config/cache helpers**: inline the `getPurePath()` helper from Conventions. Do not crash Pi if the dependency is missing — provide a graceful fallback.
3. **License preservation**: check source license, preserve in `LICENSE` file, note in README.
4. **Full source lineage**: trace upstream-of-upstream. README Sources / Inspiration must show the complete derivation chain.
5. **`.upstream` file**: always create for future sync automation — primary URL + SHA + date, plus secondary sources.
6. **PLAN.md gate**: never proceed to implementation until the user explicitly approves the plan.
7. **Entry point**: the extension must have `index.ts` at its root. Rename if the source uses a different entry point.
8. **`@aliou/*` packages**: these are third-party packages the source author used, not bundled by Pi. Replace with inline implementations or `@mariozechner/*` equivalents.

---

## Checklist

**Phase 1 — Analysis:**
- [ ] All sources cloned to `/tmp/`, analyzed, primary selected
- [ ] AGENTS.md conventions reviewed
- [ ] Pi API reference reviewed (`references/api-reference.md`)
- [ ] Dependency pre-audit completed — imports needing replacement identified
- [ ] Existing extensions scanned for integration opportunities
- [ ] Approach decided (clone-adapt or scratch)
- [ ] Extension named and confirmed by user

**Phase 2 — Planning:**
- [ ] Plan created on a branch, reviewed and approved
- [ ] Integration notes recorded in PLAN.md
- [ ] Development environment set up (worktree or branch)
- [ ] Full source lineage traced (upstream of upstream)

**Phase 3 — Implementation:**
- [ ] Entry point is `index.ts` at extension root
- [ ] Dependencies audited — Pi API replacements flagged and confirmed
- [ ] `@aliou/*` packages replaced with inline or `@mariozechner/*` equivalents
- [ ] `package.json` created (name + version + runtime deps, no Pi packages)
- [ ] Dependencies installed (`npm install` if needed)
- [ ] `.npmignore` created
- [ ] `README.md` with Sources / Inspiration (full chain)
- [ ] `CHANGELOG.md` with initial entry + import SHA
- [ ] `.upstream` file created
- [ ] Source license checked and preserved in `LICENSE` file
- [ ] `biome check` passes zero errors
- [ ] Smoke test passed
- [ ] User confirmed functional test

**Phase 4 — Commit:**
- [ ] PLAN.md deleted after implementation
- [ ] Temporary clones cleaned up (`/tmp/<source-name>`)
- [ ] Committed and pushed
- [ ] `.pi/settings.json` cleaned up (removed local test entry)

---

**After import**: the extension is on GitHub. To publish to npm and activate globally, read `publish.md`.
