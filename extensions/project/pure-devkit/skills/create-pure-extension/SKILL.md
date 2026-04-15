---
name: create-pure-extension
description: Create a new pure-* extension, either by forking an existing Pi extension or building from scratch. Use when the user asks to create a new extension, add a new pure-* extension, or fork an extension.
---

# Create a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill:

- **Simplicity first** — prefer the smallest workable adaptation
- **Pi built-ins before external tools/packages** — use Pi APIs, `pi-extension`, and pi-dev-kit tools first
- **Standalone, ecosystem-ready** — the extension must work independently but follow pure-* conventions

Two workflows: **fork-based** (inspired by existing extensions) or **from-scratch** (new idea). Use the fork-based workflow unless the user explicitly wants something original.

> **New workflow baseline:** All extensions are tracked in Git and listed in `package.json` from creation. Activation is controlled by which `settings.json` references them: **global** `~/.pi/agent/settings.json` (git package) or **local** `.pi/settings.json` (source path). There is no `.gitignore` phase.

## Workflow A: Fork-Based Creation

When the user identifies one or more extension repos as inspiration.

### 1. Identify sources

Ask the user:

- **Primary inspiration**: which extension to fork (repo URL or local path)?
- **Secondary inspirations**: any other extensions to borrow features from?
- **What to keep, add, or change** from each source?

If the user doesn't specify, interview them briefly to understand the goal.

### 2. Clone and verify the primary source

Before modifying anything significant, read the `pi-extension` skill reference files relevant to the extension type and use pi-dev-kit tools (`pi_docs`, `pi_changelog`, `pi_version`, `detect_package_manager`) when they help.

```bash
# Clone the primary inspiration into the project
git clone <repo-url> /tmp/<source-name>
cp -R /tmp/<source-name> extensions/<scope>/pure-<name>
```

**Stage A — test the primary source as-is.** Do not rename or refactor yet. First, verify the upstream clone actually loads:

1. **Add to `package.json` manifest**: append `"./extensions/<scope>/pure-<name>/index.ts"` to `pi.extensions`.
2. Add a local path reference in `.pi/settings.json`:
```json
{
  "packages": ["../extensions/<scope>/pure-<name>"]
}
```

Then ask the user to `/reload` and test. Wait for confirmation before proceeding.

### 3. Rename to pure-* conventions

Once the user confirms the clone works, rename everything:

- **Directory**: `pure-<name>/`
- **Tool name**: prefer a short descriptive name; fall back to `pure_<name>` only if nothing better fits
- **Command**: prefer a short memorable slash command (e.g. `/sesh`, `/theme`); fall back to `/pure-<name>` only if nothing better fits
- **Widget ID**: `pure-<name>`
- **Message type**: `pure_<name>`
- **Config file**: `pure-<name>.json`
- **Settings namespace**: `pure.<name>.*` in `~/.pi/agent/settings.json`
- **Storage paths**: inline path helpers using `~/.pi/agent/pure/{config,cache}/pure-<name>.json`

### 4. Strip unnecessary files

Remove everything that isn't needed:

- Delete `.git/`, `node_modules/`, lockfiles
- Remove CI configs, `.github/`, test fixtures
- Replace the original README and CHANGELOG with our own project docs
- Preserve attribution and satisfy upstream licensing obligations where required
- Remove any build configs (`tsconfig.json`, `webpack.config.js`, etc.) unless truly needed — Pi loads `.ts` via Jiti
- Keep only the essential source files (ideally a single `index.ts`)
- If multi-file, keep the minimum structure needed
- Do NOT add to `.gitignore` — all extensions are committed to this repo

### 5. Add path helpers (inline, self-contained)

Each extension must have its own inline path helpers — no cross-extension dependencies. Add these functions at the top of `index.ts`:

```typescript
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

function writePureJson(filename: string, category: "config" | "cache", scope: "global" | "project", data: unknown): void {
    const { dir, file } = getPurePath(filename, category, scope);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const tempFile = `${file}.tmp`;
    writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
    renameSync(tempFile, file);
}

function migrateIfNeeded(filename: string, oldGlobalPath: string, newCategory: "config" | "cache"): void {
    // ... auto-migration from old flat paths
}
```

**Project-overrides-global resolution** — for any config read, check project first, fall back to global:

```typescript
function loadConfig<T>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
    const project = readPureJson<T>(filename, category, "project", cwd);
    if (project !== undefined) return project;
    return readPureJson<T>(filename, category, "global");
}
```

Pass `ctx.cwd` from `session_start` / hook contexts so the extension knows which project to check.

Only include the helpers the extension actually needs:
- `getPurePath` — always needed (foundation for all others)
- `readPureJson` — if it reads data files
- `writePureJson` — if it writes data files or scaffolds defaults
- `loadConfig` — if it reads config with project-first resolution
- `migrateIfNeeded` — if migrating from an old storage location

### 6. Create README.md and CHANGELOG.md

**README.md** must include:

- Description and features
- Commands and usage
- Tool parameters (if it registers a tool)
- Settings and configuration
- Installation note
- **Sources / Inspiration** section linking to all upstream repos

**CHANGELOG.md** — GitHub-style, first entry:

```markdown
## [1.0.0] - YYYY-MM-DD

### Added

- Forked from <source-repo>
- Renamed to pure-<name> conventions
- <list of changes from original>
```

### 7. Check, format, and lint

```bash
biome check --write --unsafe extensions/<scope>/pure-<name>/
```

Fix all errors. Warnings acceptable if the rule is already disabled project-wide.

### 8. Local testing (Stage B)

After renaming, cleanup, path-helper work, and docs, run the extension through three gates before promotion.

The extension should already be referenced in `.pi/settings.json` from step 2. If not, add it:
```json
{
  "packages": ["../extensions/<scope>/pure-<name>"]
}
```

**Gate 1 — Smoke test (automated, mandatory)**

Run from the project directory:
```bash
pi -p "reply with just the word ok" 2>&1 | tail -20
```

Check for:
- **Extension load errors** (TypeError, SyntaxError, missing imports) — these crash before the prompt runs
- **Exit code** — non-zero means something broke
- **The word `ok`** in output — confirms the agent actually started and responded

Fix any errors before continuing. Do not rely on `/reload` alone — it may silently skip broken extensions.

**Gate 2 — Functional test (user, mandatory)**

Ask the user to `/reload` and test the adapted extension:
- **Tool**: invoke it in a session
- **Command**: run the slash command
- **Widget / event**: verify it renders or triggers as expected

Do not proceed to promotion until the user explicitly confirms it works.

**Gate 3 — Commit checkpoint (mandatory)**

Commit the changes before promotion so the working tree is clean:
```bash
git add .
git status
git commit -m "pure-<name>: <description of changes>"
```

### 9. Promote (after user approval)

Promotion means moving an extension from **local-only** loading to **global** loading via the git package.

**Pre-promotion checklist**
- [ ] Working tree is clean (everything committed)
- [ ] Smoke test passed
- [ ] Functional test passed
- [ ] `package.json` already lists the extension

**Migrate activation**
1. **Remove** the local path reference from `.pi/settings.json`.
2. **Add** the extension to `~/.pi/agent/settings.json` inside the git package's `extensions` array.

**Verify global load**
`/reload` in Pi and confirm the extension loads from the git package (e.g. the tool appears in `?` or the command is available).

**Push**
```bash
git push
```
Then run `pi update` or `/reload` in a fresh session to confirm the remote package works.

**Rollback plan**
If global load fails, immediately move the extension back to `.pi/settings.json`, remove it from `~/.pi/agent/settings.json`, and investigate.

> **Project-scoped extensions skip promotion.** They remain in `.pi/settings.json` — they are not added to the global git package.

---

## Workflow B: From-Scratch Creation

When the user wants something entirely new.

### 1. Interview the user

Ask these questions before writing any code:

1. **What scope?** — `global` (always loaded), `project` (opt-in per-project), `workspace` (opt-in per-workspace), or `shared` (always, utilities)?
2. **What does the extension do?** — one-sentence goal
3. **What triggers it?** — command, tool, event hook, or automatic?
4. **Does it need persistence?** — config file, cache, or stateless?
5. **Does it need a UI?** — widget, interactive command, or fire-and-forget?
6. **Does it need external APIs?** — which ones, how authenticated?
7. **Any existing extensions that do something similar?** — check for patterns to reuse

### 2. Design before coding

Based on the interview, decide:

- Extension scope (from step 1)
- Extension name (`pure-<name>`)
- What it registers: tool, command, hooks, widget, or combination
- Config structure and settings
- File layout (single `index.ts` or split)

Read the `pi-extension` skill reference files for the relevant areas (tools, commands, hooks, components, etc.), and use pi-dev-kit tools first when they can answer questions without manual digging.

### 3. Implement

Create `extensions/<scope>/pure-<name>/index.ts` with:

- Inline path helpers (only what's needed)
- Extension entry point (default export function)
- Tool/command/hook registrations
- TypeBox schemas for tool parameters
- Pi built-ins before extra dependencies (`pi.exec()` before `child_process`, `getAgentDir()` before `homedir()`, built-in TUI components before custom UI)

### 4. Create README.md, CHANGELOG.md

Same format as fork-based workflow, but Sources/Inspiration cites ideas/articles/APIs instead of repos.

### 5. Check, format, lint, test, and promote

Same gates as fork-based workflow:

1. `biome check --write --unsafe extensions/<scope>/pure-<name>/`
2. Verify the extension is in `package.json` `pi.extensions` and `.pi/settings.json` has a local path reference
3. **Smoke-test**: `pi -p "reply with just the word ok" 2>&1 | tail -20` from the project directory. Check for errors and that the agent responded. Fix any errors before continuing.
4. Ask the user to `/reload` and **functionally test** the extension. Do not proceed until confirmed working.
5. **Commit checkpoint**: `git add . && git commit -m "pure-<name>: <description>"`
6. When approved, promote (remove from `.pi/settings.json`, add to `~/.pi/agent/settings.json`, verify global load, push)

---

## Updating an Extension

When modifying an existing pure-* extension, always check the primary source for upstream changes first.

### 1. Find the primary source

Read the extension's `README.md` → **Sources / Inspiration** section. The first linked repo is the primary source (the upstream the extension was forked from). If there is no upstream (from-scratch extension), skip to step 4.

### 2. Check upstream for changes

```bash
# Clone or fetch the upstream repo
git clone --depth 1 <upstream-url> /tmp/<source-name>
```

Compare the upstream source against our `extensions/<scope>/pure-<name>/index.ts`:

- Read the upstream's main source file(s)
- Check the upstream's CHANGELOG for releases since our fork
- Note any bug fixes, new features, or API adaptations we're missing

### 3. Decide what to bring in

For each upstream change, decide:

- **Cherry-pick**: bug fixes, API signature changes (e.g. Pi version adaptations), security fixes
- **Skip**: features we don't need, changes that conflict with pure-* conventions, upstream patterns we deliberately replaced
- **Adapt**: features we want but need to rework for our path helpers, config resolution, or conventions

Report findings to the user before making changes.

### 4. Make changes

Apply updates to `extensions/<scope>/pure-<name>/` following the same conventions as the original fork:

- Keep inline path helpers, pure-* naming, project-overrides-global config
- Maintain our README/CHANGELOG format
- Update CHANGELOG.md with changes brought from upstream

### 5. Check, test, and restore activation

**Before editing, determine the extension's activation tier:**

- **Globally active** (listed in `~/.pi/agent/settings.json`):
  1. Remove it from `~/.pi/agent/settings.json`.
  2. Add it to `.pi/settings.json`.
  3. `/reload` and develop.

- **Locally active** (already in `.pi/settings.json`):
  1. Edit directly.
  2. `/reload` and develop.

**When finished, run the three testing gates:**

1. `biome check --write --unsafe extensions/<scope>/pure-<name>/`
2. **Smoke-test**: `pi -p "reply with just the word ok" 2>&1 | tail -20`. Fix errors before continuing.
3. Ask the user to `/reload` and **functionally test**. Do not proceed until confirmed working.
4. **Commit checkpoint**: `git add . && git commit -m "pure-<name>: <description>"`

**Restore activation:**
- If it was globally active, remove it from `.pi/settings.json` and add it back to `~/.pi/agent/settings.json`. Verify global load with `/reload`, then `git push`.
- If it was locally active (baseline), keep it in `.pi/settings.json`.

---

## Checklist

Before considering the extension ready for user testing:

- [ ] Single `index.ts` entry point (split only if unwieldy)
- [ ] Added to root `package.json` `pi.extensions` manifest immediately
- [ ] `package.json` (per-extension) ONLY if it has npm dependencies — zero-dep extensions omit it
- [ ] Inline path helpers (self-contained, no cross-extension deps)
- [ ] Project-overrides-global: config reads check project first, fall back to global (pass `ctx.cwd`)
- [ ] Works standalone outside this repo and also follows pure-* conventions inside the ecosystem
- [ ] TypeBox schemas for tool parameters
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested: `pi -p "reply ok"` runs without extension load errors
- [ ] User confirmed functional test
- [ ] README.md with Sources / Inspiration section
- [ ] CHANGELOG.md with initial release entry
- [ ] Local path reference in `.pi/settings.json` for local loading
- [ ] Commit checkpoint done before promotion

**Promotion** (when user says "promote"):
- [ ] Pre-promotion checklist complete
- [ ] Added to `~/.pi/agent/settings.json` git package entry
- [ ] Local path reference removed from `.pi/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
