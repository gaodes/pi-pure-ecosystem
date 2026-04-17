---
name: import-pure-extension
description: Import an existing Pi extension into the pi-pure-ecosystem by forking from an external source. Use when the user asks to import, fork, or adapt an external extension.
---

# Import a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill imports an existing **Pi extension** into the pure-ecosystem by analyzing one or more source repos, planning the adaptation, and implementing it.

**Scope**: the source must be a Pi extension (using `@mariozechner/pi-*` APIs). For importing general npm packages or scripts, use `create-pure-extension` and build from scratch instead.

## When to Use This Skill

| Request | Skill to Use |
|---------|--------------|
| **Import/fork an external extension** | `import-pure-extension` |
| Build a new extension from scratch | `create-pure-extension` |
| Sync an extension with upstream | `update-pure-extension` |
| Add features to an extension we own | `enhance-pure-extension` |

---

## Phase 1: Analysis

### 1. Gather sources

The user provides **at least one link** to a repo or extension to import. They may provide multiple.

For each source:
- Clone or browse the repo
- Read README, package.json, source files
- Understand what it does, its structure, and quality
- Check if the source itself credits inspirations (other repos it forked/derived from) — trace the full lineage

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

**Name:**
- Follow the `pure-<name>` convention
- Short, descriptive, memorable
- Should reflect what the extension does, not where it came from
- Avoid names that conflict with existing extensions

**Check for conflicts:**
```bash
ls extensions/pure-<name>/ 2>/dev/null && echo "EXISTS" || echo "OK"
```
If the directory already exists, either pick a different name or use `enhance-pure-extension` instead.

### 3. Present analysis for approval

Present everything to the user in one consolidated summary:
- Primary source (why chosen) + upstream lineage found
- Approach (clone-adapt or write-from-scratch) with rationale
- Proposed name
- Features to implement now vs. later

Get user approval before proceeding to planning.

**Heuristic for "now" vs. "later" features:**
- **Now**: core functionality the extension needs to be useful, features the user specifically requested
- **Later**: nice-to-haves, features that need additional deps or significant refactoring, things from secondary sources

---

## Phase 2: Planning

### 4. Create a plan file

Create a worktree for the import:

```bash
git worktree add .worktrees/<name>-import -b <name>-import
cd .worktrees/<name>-import
```

Then create the extension directory:

```bash
mkdir -p extensions/pure-<name>
```

Create `extensions/pure-<name>/PLAN.md` with:

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
| `child_process.exec` | `pi.exec()` | Pi API convention |
| `os.homedir()` | `getAgentDir()` | Pi API convention |

## License
<original license type> — preserved from <primary-source>

## Sources for future updates
- <primary-repo-url>
- <secondary-repo-url> (for feature X, Y)
```

### 5. User reviews plan

Present the plan to the user. Iterate together until satisfied.

**Do not proceed to implementation until the user explicitly says to start.**

---

## Phase 3: Implementation

### 6. Implement the extension

Based on the plan:

**If cloning and adapting:**
1. Copy source files into `extensions/pure-<name>/`
2. Strip: `.git/`, `node_modules/`, lockfiles, CI configs, `.github/`, test fixtures
3. Flatten `src/` to root when the extension is small (≤5 files). Keep subdirectories when justified by size or logical separation (e.g. `services/`, `tools/`). Don't force flat structure if it hurts readability.
4. Rename to pure-* conventions (tool names, commands, storage paths)

**If writing from scratch:**
1. Create directory structure following pure-* conventions
2. Implement each feature from the "Features to implement now" section of PLAN.md, using the source as reference. Start with core functionality, then add secondary features.

**Then for both approaches:**
5. Check the source license — preserve it in a `LICENSE` file and note it in README
6. Replace deps with Pi APIs where functionality is preserved (see Dependency Audit below)
7. Add `pure-utils` dependency if config/cache storage is needed (import from `@gaodes/pi-pure-utils`)
8. Create minimal `package.json` — name and version only (full manifest at publish time):
   ```json
   { "name": "@gaodes/pi-pure-<name>", "version": "0.1.0" }
   ```
9. Create `.npmignore` (standard template: `node_modules/`, `CHANGELOG.md`, `.DS_Store`, `*.tmp`)
10. Create `CHANGELOG.md` with initial entry
11. Create `.upstream` file for automation
12. Create `README.md` with full Sources / Inspiration lineage

#### Dependency Audit

For each third-party import in the source, check if Pi provides an equivalent:

| Original | Pi API | Replace? |
|----------|--------|----------|
| `child_process.exec/spawn` | `pi.exec()` | Yes — unless extension needs streaming/pty |
| `os.homedir()` | `getAgentDir()` | Yes — always |
| `fs.*Sync` for JSON config | `pure-utils` helpers | Yes — if using config/cache pattern. Note: `@gaodes/pi-pure-utils` is planned but not yet created. |
| `fetch` | Keep — built-in | No change needed |
| `@sinclair/typebox` | Keep — Pi bundles it | Peer dep, not direct dep |
| Any other third-party import | Check if Pi provides equivalent | Keep if no Pi equivalent |

**Flag each replacement to the user. Only replace if functionality is preserved.** Let the user make the final call.

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

### 7. Check, lint, test

Run from the **repo root** (or worktree root if in a worktree):

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test (isolated subprocess — safe, no conflicts):**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

If either fails, fix the issues and re-run until both pass.

Ask user to add to `.pi/settings.json` locally and `/reload` for functional test.

**If developing in a worktree:**
1. Create `.pi/settings.json` in the worktree root (see AGENTS.md "Worktree `.pi/settings.json` setup"):
   ```json
   { "packages": ["./extensions/pure-<name>"] }
   ```
2. Smoke test (from worktree root): `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok"`
3. Functional test: call `switch_worktree` tool to switch session, user tests, switch back.

---

## Phase 4: Commit

### 8. Commit and push

Delete `PLAN.md` — the planning history is preserved in git, but it shouldn't ship with the extension:

```bash
rm extensions/pure-<name>/PLAN.md
git add extensions/pure-<name>/
git commit -m "pure-<name>: initial import from <source>"
```

If in a worktree, clean up the worktree from the **main repo root**:

```bash
cd <main-repo-root>
git worktree remove .worktrees/<name>-import
git checkout main
git merge <name>-import
git branch -d <name>-import
```

Or use the user-facing command: `/worktrees clean <name>-import`. Then push:

```bash
git push
```

Otherwise (no worktree):

```bash
git push
```

**This completes the import.** Publishing to npm and global activation are separate steps — use the `publish-pure-extension` skill when the user is ready.

---

## Reference Files

The `references/` directory contains detailed Pi API reference material for tool authoring, rendering, commands, hooks, modes, and more. Consult these when implementing extension features during import.

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, execute signature, rendering patterns, error handling |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print) |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify |
| `references/hooks.md` | Event handlers |
| `references/components.md` | TUI component authoring |
| `references/structure.md` | Extension directory structure |
| `references/testing.md` | Testing patterns |
| `references/state.md` | State management |
| `references/publish.md` | Publishing workflow details |

---

## Critical Rules (Import-Specific)

These rules are specific to the import workflow. For general Pi extension rules (execute order, signal forwarding, no child_process, etc.), see `AGENTS.md`.

1. **Dependency audit**: flag every Pi API replacement to the user — only replace if functionality is preserved. User makes the final call.
2. **Depends on `pure-utils`**: if using config/cache, import from `@gaodes/pi-pure-utils`. State dependency gracefully — provide install instructions if missing, don't crash Pi.
3. **License preservation**: check source license, preserve in `LICENSE` file, note in README.
4. **Full source lineage**: trace upstream-of-upstream. README Sources / Inspiration must show the complete derivation chain.
5. **`.upstream` file**: always create for future sync automation — primary URL + SHA + date, plus secondary sources.
6. **PLAN.md gate**: never proceed to implementation until the user explicitly approves the plan.

---

## Checklist

- [ ] All sources analyzed, primary selected
- [ ] Approach decided (clone-adapt or scratch)
- [ ] Extension named and confirmed by user
- [ ] Plan created on a branch, reviewed and approved
- [ ] Full source lineage traced (upstream of upstream)
- [ ] Dependencies audited — Pi API replacements flagged and confirmed
- [ ] `pure-utils` imported if config/cache needed
- [ ] README.md with Sources / Inspiration (full chain)
- [ ] CHANGELOG.md with initial entry + import SHA
- [ ] `.upstream` file created
- [ ] Minimal `package.json` (name + version)
- [ ] `biome check` passes zero errors
- [ ] Smoke test passed
- [ ] User confirmed functional test
- [ ] Source license checked and preserved in `LICENSE` file
- [ ] `.npmignore` created
- [ ] PLAN.md deleted after implementation
- [ ] Committed and pushed

---

**After import**: use the `publish-pure-extension` skill to publish to npm and activate globally.
