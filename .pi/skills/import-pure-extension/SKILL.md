---
name: import-pure-extension
description: Import an existing Pi extension into the pi-pure-ecosystem by forking from an external source. Use when the user asks to import, fork, or adapt an external extension.
---

# Import a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill imports an existing extension into the pure-ecosystem by analyzing one or more source repos, planning the adaptation, and implementing it.

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

### 2. Select primary source

If multiple sources are provided:
- Analyze all repos together with the user's request
- **Decide on one primary repo** to base the extension on
- Note improvements from other sources for future implementation

If only one source: it becomes the primary by default.

Present the decision to the user:
- Which repo is primary and why
- What features to implement now vs. later
- Any inspirations/upstream-of-upstream found

### 3. Assess approach

Decide whether to:

| Approach | When to use |
|----------|------------|
| **Clone and adapt** | The source is a well-structured Pi extension that mostly works. Copy it, rename, strip, adapt. |
| **Write from scratch** | The source is messy, uses wrong patterns, or the user wants significant changes. Use it as a reference but implement clean. |

Factors:
- Code quality and compatibility with Pi APIs
- How much needs to change (rename, deps, patterns)
- Whether the source uses deprecated APIs or anti-patterns

Present the recommendation to the user with rationale.

### 4. Name the extension

Choose a name following the `pure-<name>` convention:
- Short, descriptive, memorable
- Should reflect what the extension does, not where it came from
- Avoid names that conflict with existing extensions

Ask the user to confirm the name.

---

## Phase 2: Planning

### 5. Create a plan file

On a **new branch** (use worktree if parallel development is needed):

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

## Sources for future updates
- <primary-repo-url>
- <secondary-repo-url> (for feature X, Y)
```

### 6. User reviews plan

Present the plan to the user. Iterate together until satisfied.

**Do not proceed to implementation until the user explicitly says to start.**

---

## Phase 3: Implementation

### 7. Implement the extension

Based on the plan:

**If cloning and adapting:**
1. Copy source files into `extensions/pure-<name>/`
2. Strip: `.git/`, `node_modules/`, lockfiles, CI configs, `.github/`, test fixtures
3. Flatten `src/` to root — pure-* convention is flat structure
4. Rename to pure-* conventions (tool names, commands, storage paths)
5. Replace deps with Pi APIs where functionality is preserved (see Dependency Audit below)
6. Add `pure-utils` dependency if config/cache storage is needed (import from `@gaodes/pi-pure-utils`)
7. Create minimal `package.json` (name + version only — full manifest at publish time)
8. Create `CHANGELOG.md` with initial entry
9. Create `.upstream` file for automation
10. Create `README.md` with full Sources / Inspiration lineage

**If writing from scratch:**
1. Create directory structure following pure-* conventions
2. Implement features from the plan, using the source as reference
3. Follow all the same steps 6-10 above

#### Dependency Audit

For each third-party import in the source, check if Pi provides an equivalent:

| Original | Pi API | Replace? |
|----------|--------|----------|
| `child_process.exec/spawn` | `pi.exec()` | Yes — unless extension needs streaming/pty |
| `os.homedir()` | `getAgentDir()` | Yes — always |
| `fs.*Sync` for JSON config | `pure-utils` helpers | Yes — if using config/cache pattern |
| `fetch` | Keep — built-in | No change needed |
| `@sinclair/typebox` | Keep — Pi bundles it | Peer dep, not direct dep |

**Flag each replacement to the user. Only replace if functionality is preserved.** Let the user make the final call.

#### Sources / Inspiration

README must include the full derivation chain:
- **Primary source** — the repo you forked from
- **Upstream of upstream** — if the primary source itself was derived from another project
- **Other sources** — repos that contributed ideas but aren't the primary

Example:
```markdown
## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Original decision guide. Licensed MIT.
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

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test (isolated subprocess — safe, no conflicts):**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

Ask user to add to `.pi/settings.json` locally and `/reload` for functional test.

**If developing in a worktree:**
1. Smoke test: `pi -e "$PWD/.worktrees/<branch>/extensions/pure-<name>" -ne -p "reply of just ok"`
2. Functional test: call `switch_worktree` tool to switch session, user tests, switch back.

---

## Phase 4: Ship

### 9. Commit

```bash
git add extensions/pure-<name>/
git commit -m "pure-<name>: initial import from <source>"
```

### 10. Publish and activate

1. **Publish to npm** using the `publish-pure-extension` skill:
   - Bump version in `package.json` and `CHANGELOG.md` if needed
   - Full manifest gets created at this point
   - Publish: `npm publish --access public`

2. **Activate globally** — add to `~/.pi/agent/settings.json` as an npm package:
   ```json
   "npm:@gaodes/pi-pure-<name>"
   ```

3. **Remove from local `.pi/settings.json`** if it was there for testing

4. **Verify**: `pi list` should show the new extension

**Exception**: If the user asks to test from GitHub before npm, add to the git package entry temporarily. Remove once published to npm.

### 11. Push

```bash
git push
```

If in a worktree, merge first: `/worktrees clean <branch-name>`

---

## Reference Files

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print) |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify |
| `references/hooks.md` | Event handlers |

---

## Critical Rules

1. **Execute order**: `(toolCallId, params, signal, onUpdate, ctx)`
2. **Always `onUpdate?.()`** — optional chaining
3. **No `.js` in imports**
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback
5. **Signal forwarding**: pass to all async operations
6. **Never `child_process`**: use `pi.exec()`
7. **Never `homedir()`**: use `getAgentDir()`
8. **Typed param alias**: `type MyParams = Static<typeof parameters>`
9. **Entry point pattern**: load config → check enabled → register
10. **API key gating**: check before registering tools — notify if missing
11. **Depends on `pure-utils`**: if using config/cache, import from `@gaodes/pi-pure-utils`. State dependency gracefully — provide install instructions if missing, don't crash Pi.
12. **Check existing components**: before creating custom TUI, check `pi-tui` or `pi-coding-agent`
13. **Settings UI**: use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

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
- [ ] Committed
- [ ] Published to npm via `publish-pure-extension` skill
- [ ] Activated globally as npm package
- [ ] Pushed to remote
