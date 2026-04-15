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
cp -R /tmp/<source-name> extensions/pure-<name>
```

**Stage A — test the primary source as-is.** Do not rename or refactor yet. First, verify the upstream clone actually loads:

```bash
# Disable any conflicting global extension
mv ~/.pi/agent/extensions/<conflicting-name> ~/.pi/agent/extensions/_disabled/<conflicting-name> 2>/dev/null || true

# Copy to local test location
cp -R extensions/pure-<name> .pi/extensions/pure-<name>
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
biome check --write --unsafe extensions/pure-<name>/
```

Fix all errors. Warnings acceptable if the rule is already disabled project-wide.

### 8. Install for local testing

**Stage B — test the adapted pure-* version.** After renaming, cleanup, path-helper work, and docs:

```bash
# Already in .pi/extensions/ from step 2 — if not:
cp -R extensions/pure-<name> .pi/extensions/pure-<name>
```

Ask the user to `/reload` and test the adapted extension. Do not proceed to promotion until the user explicitly approves.

### 9. Restore and promote (after user approval)

```bash
# Remove test copy
rm -rf .pi/extensions/pure-<name>

# Re-enable any disabled global extensions
mv ~/.pi/agent/extensions/_disabled/<conflicting-name> ~/.pi/agent/extensions/<conflicting-name> 2>/dev/null || true

# Promote to global
cp -R extensions/pure-<name>/* ~/.pi/agent/extensions/pure-<name>/
```

Then `/reload` in Pi and verify.

---

## Workflow B: From-Scratch Creation

When the user wants something entirely new.

### 1. Interview the user

Ask these questions before writing any code:

1. **What does the extension do?** — one-sentence goal
2. **What triggers it?** — command, tool, event hook, or automatic?
3. **Does it need persistence?** — config file, cache, or stateless?
4. **Does it need a UI?** — widget, interactive command, or fire-and-forget?
5. **Does it need external APIs?** — which ones, how authenticated?
6. **Any existing extensions that do something similar?** — check for patterns to reuse

### 2. Design before coding

Based on the interview, decide:

- Extension name (`pure-<name>`)
- What it registers: tool, command, hooks, widget, or combination
- Config structure and settings
- File layout (single `index.ts` or split)

Read the `pi-extension` skill reference files for the relevant areas (tools, commands, hooks, components, etc.), and use pi-dev-kit tools first when they can answer questions without manual digging.

### 3. Implement

Create `extensions/pure-<name>/index.ts` with:

- Inline path helpers (only what's needed)
- Extension entry point (default export function)
- Tool/command/hook registrations
- TypeBox schemas for tool parameters
- Pi built-ins before extra dependencies (`pi.exec()` before `child_process`, `getAgentDir()` before `homedir()`, built-in TUI components before custom UI)

### 4. Create README.md, CHANGELOG.md

Same format as fork-based workflow, but Sources/Inspiration cites ideas/articles/APIs instead of repos.

### 5. Check, format, lint, test, promote

Same steps 7–9 as fork-based workflow.

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

Compare the upstream source against our `extensions/pure-<name>/index.ts`:

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

Apply updates to `extensions/pure-<name>/` following the same conventions as the original fork:

- Keep inline path helpers, pure-* naming, project-overrides-global config
- Maintain our README/CHANGELOG format
- Update CHANGELOG.md with changes brought from upstream

### 5. Check, test, promote

Same steps 7–9 from the fork-based workflow.

---

## Checklist

Before considering the extension ready for user testing:

- [ ] Single `index.ts` entry point (split only if unwieldy)
- [ ] `package.json` ONLY if extension has npm dependencies — zero-dep extensions omit it
- [ ] Inline path helpers (self-contained, no cross-extension deps)
- [ ] Project-overrides-global: config reads check project first, fall back to global (pass `ctx.cwd`)
- [ ] Works standalone outside this repo and also follows pure-* conventions inside the ecosystem
- [ ] TypeBox schemas for tool parameters
- [ ] `biome check` passes with zero errors
- [ ] README.md with Sources / Inspiration section
- [ ] CHANGELOG.md with initial release entry
- [ ] Installed in `.pi/extensions/` for local testing
- [ ] Any conflicting global extensions disabled
- [ ] User has tested and approved before promoting
