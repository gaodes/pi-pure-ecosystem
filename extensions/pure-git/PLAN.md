# Plan: `pure-git` Extension

## Context

The `pi-pure-ecosystem` project uses Git worktrees for parallel extension development. Rather than bundling Git operations into `pure-devkit`, a dedicated extension provides a clean separation of concerns.

- **`pure-devkit`**: Extension development tools (docs, smoke testing, scaffolding)
- **`pure-git`**: Git operations (worktrees, branches)

## Extension Landscape Analysis

Evaluated 10 existing Pi Git extensions to identify the best reference for implementation:

| Extension | Type | Core Features | Verdict |
|-----------|------|--------------|---------|
| **@zenobius/pi-worktrees** | Commands | Worktree CRUD, config, hooks, templates, branch generator | **★ Best fit for worktree mgmt** |
| **qualiti/pi-git-commands** | Commands | `/commit`, `/push`, `/commit-and-push`, `/commit-pr` with AI msg gen | Good for future commit commands |
| @aretw0/git-skills | Skills (SKILL.md) | Commit conventions, git workflow, github, glab | Prompt skills only, not executable |
| mjakl/pi-git-research | Tools + Skills | Clone/explore repos for research | Niche — research, not workflow |
| @hyperprior/pi-commit | Extension | Git commit helper (minimal, no README) | Too minimal to evaluate |
| pi-prompt-stash | Extension | Save/restore prompt drafts | Not git operations |
| @artale/pi-git-hooks | Extension | Hook manager (pre-commit, commit-msg, pre-push) | Future candidate |
| @artale/pi-git-graph | Extension | ASCII commit graph, branch map, contributor stats | Future candidate |
| @artale/pi-changelog | Extension | Auto-generate changelogs from git history | Future candidate (we have devkit tools) |

### Winner: **@zenobius/pi-worktrees** (zenobi-us/pi-worktrees)

Reasons:
- **Most complete worktree implementation**: create, list, remove, prune, status, cd, settings, templates
- **Well-structured codebase**: `src/cmds/*.ts`, `src/services/*.ts`, `src/ui/*.ts`
- **Safety checks**: prevents main/current worktree removal, confirmation prompts, force-remove fallback
- **Per-repo config**: glob-matched settings with template variables and hooks
- **Production quality**: comprehensive error handling, logging, UI feedback

### Runner-up: **qualiti/pi-git-commands-extension**

Excellent commit/push/PR implementation (1168 lines). Uses `pi.exec()` idiomatically, has AI-powered commit message generation, branch name generation, PR creation via gh CLI. Good reference for future expansion.

### Key differences from pi-worktrees that pure-git must address:

1. **Use `pi.exec()` not `execSync`**: pi-worktrees uses `child_process.execSync` — the Pi-idiomatic way is `pi.exec()` (as qualiti does). This is essential for Pi's process management.
2. **Self-contained**: pi-worktrees depends on `@zenobius/pi-extension-config` for config migration. pure-git must be self-contained per ecosystem policy.
3. **Simplified config**: Skip the glob-matching config system. Use `.worktrees/` directory convention with optional per-project `.pi/settings.json` overrides.
4. **No external deps**: pure-git must have zero npm dependencies beyond Pi peer dependencies.

## Approach

Build `pure-git` taking the **architecture and safety patterns from @zenobius/pi-worktrees** but simplified for the pure-ecosystem philosophy. The extension registers a single `/worktrees` command with subcommands.

### Extension Name

**`pure-git`** — Git tools for Pi extension development.

### Structure

```
extensions/pure-git/
├── index.ts              # Entry point — registers /worktrees command
├── commands/
│   └── worktrees.ts      # Command handler with create/list/clean subcommands
├── services/
│   └── git.ts            # Git operations via pi.exec()
├── README.md
└── CHANGELOG.md
```

### Commands

#### `/worktrees [action] [name]`

Manages Git worktrees in the `.worktrees/` directory.

| Action | Description |
|--------|-------------|
| `create <name> [base-branch]` | Create branch + worktree |
| `list` | List all worktrees |
| `clean [name]` | Merge to main, delete worktree + branch |

**Usage examples:**
```
/worktrees create github-review
/worktrees create sessions-bookmarks main
/worktrees list
/worktrees clean github-review
```

## Files to Create

1. `extensions/pure-git/FUTURE.md` — Future improvement roadmap (created first)
2. `extensions/pure-git/index.ts` — Entry point
3. `extensions/pure-git/commands/worktrees.ts` — Subcommand handler
4. `extensions/pure-git/services/git.ts` — Git operations (pi.exec wrapper)
5. `extensions/pure-git/README.md` — Documentation
6. `extensions/pure-git/CHANGELOG.md` — Changelog

## Files to Modify

1. Root `package.json` — Add `"./extensions/pure-git/index.ts"` to `pi.extensions`
2. `.pi/settings.json` — Add local path reference for testing
3. `.gitignore` — Ensure `.worktrees/` is ignored (should already be)

## Reuse

### From @zenobius/pi-worktrees (zenobi-us/pi-worktrees)

| Pattern | Source File | What to Adapt |
|---------|------------|---------------|
| Worktree listing with porcelain parsing | `src/services/git.ts` → `listWorktrees()` | Parse `git worktree list --porcelain` output |
| Branch existence check | `src/services/git.ts` → `git(['rev-parse', '--verify', branchName])` | Check before creating |
| Git exclude for worktree dir | `src/services/git.ts` → `ensureExcluded()` | Ensure `.worktrees/` excluded from git tracking |
| WorktreeInfo type | `src/services/git.ts` → `WorktreeInfo` | path, branch, head, isMain, isCurrent |
| Safety: protected worktree check | `src/cmds/cmdRemove.ts` → `isProtectedWorktree()` | Cannot remove main or current |
| Force-remove fallback | `src/cmds/cmdRemove.ts` → `removeWorktreeWithConfirm()` | Handle dirty worktrees |
| Status indicators | `src/ui/status.ts` → `StatusIndicator` | busy/positive/critical status |

### From qualiti/pi-git-commands-extension

| Pattern | Source File | What to Adapt |
|---------|------------|---------------|
| `pi.exec()` wrapper | `extensions/git-commands.ts` → `run()` | Pi-idiomatic process execution |
| Repo state inspection | `extensions/git-commands.ts` → `inspectRepo()` | Branch, ahead/behind, dirty status |

### From existing pure-ecosystem

| Pattern | Source File | What to Reuse |
|---------|------------|---------------|
| Command registration pattern | `pure-devkit/index.ts` | `pi.registerCommand()` with handler |
| Extension factory signature | `pure-devkit/index.ts` | `export default function (pi: ExtensionAPI)` |

## Implementation Details

### `services/git.ts` — Git Operations

Uses `pi.exec()` instead of `execSync` for Pi-idiomatic process management.

```typescript
// Key functions:
isGitRepo(cwd: string): Promise<boolean>
getMainWorktreePath(cwd: string): Promise<string>
listWorktrees(cwd: string): Promise<WorktreeInfo[]>
getCurrentBranch(cwd: string): Promise<string>
branchExists(cwd: string, branch: string): Promise<boolean>
createBranch(cwd: string, name: string, base: string): Promise<void>
createWorktree(cwd: string, path: string, branch: string): Promise<void>
removeWorktree(cwd: string, path: string, force?: boolean): Promise<void>
deleteBranch(cwd: string, name: string): Promise<void>
mergeBranch(cwd: string, branch: string): Promise<MergeResult>
ensureWorktreeDirExcluded(cwd: string, worktreeDir: string): Promise<void>
isWorktreeDirty(cwd: string, path: string): Promise<boolean>
getAheadBehind(cwd: string, branch: string, base: string): Promise<{ahead: number, behind: number}>
```

### `commands/worktrees.ts` — Subcommand Handler

Adapted from pi-worktrees command dispatch pattern. Routes subcommand to handler.

### `/worktrees create <name> [base-branch]`

1. **Validate inputs**: `name` alphanumeric + hyphens, `base-branch` defaults to current branch
2. **Check for existing**: branch and worktree must not exist
3. **Create branch**: `git branch <name> <base-branch>`
4. **Create worktree**: `git worktree add .worktrees/<name>/ <name>`
5. **Ensure excluded**: Add `.worktrees/` to `.git/info/exclude`
6. **Output**: Branch name, worktree path, next steps

### `/worktrees list`

1. **List worktrees**: `git worktree list --porcelain` parsed into `WorktreeInfo[]`
2. **Display**: branch name, path, clean/dirty status, ahead/behind counts, main highlight
3. **Format**:
   ```
   Worktrees (.worktrees/):

   * main            /path/to/main               (main, clean)
   • github-review   .worktrees/github-review    (clean)
   • sessions-book   .worktrees/sessions-book    (2 ahead, dirty)
   ```

### `/worktrees clean <name>`

1. **Validate**: Worktree must exist, cannot be main or current
2. **Check dirty**: If dirty, offer stash or abort
3. **Switch to main**: `git checkout main`
4. **Merge**: `git merge <name>` — handle success, conflicts, nothing-to-merge
5. **Delete worktree**: `git worktree remove .worktrees/<name>/`
6. **Delete branch**: `git branch -d <name>`
7. **Push**: `git push`
8. **Output**: Summary of all steps

## Steps

- [ ] 1. Create `extensions/pure-git/FUTURE.md` — Future improvement roadmap
- [ ] 2. Create `extensions/pure-git/services/git.ts` — Git operations using `pi.exec()`
- [ ] 3. Create `extensions/pure-git/commands/worktrees.ts` — create/list/clean handlers
- [ ] 4. Create `extensions/pure-git/index.ts` — Entry point with command registration
- [ ] 5. Create `extensions/pure-git/README.md` — Documentation
- [ ] 6. Create `extensions/pure-git/CHANGELOG.md` — Initial changelog
- [ ] 7. Add `"./extensions/pure-git/index.ts"` to root `package.json` `pi.extensions`
- [ ] 8. Add local path to `.pi/settings.json` for testing
- [ ] 9. Verify `.worktrees/` in `.gitignore`
- [ ] 10. Smoke test: `pi -e "$PWD/extensions/pure-git" -ne -p "reply with just ok"`
- [ ] 11. Functional test: `/worktrees create test-branch` → `/worktrees list` → `/worktrees clean test-branch`
- [ ] 12. Promote from local to global in `~/.pi/agent/settings.json`

## Future Extensions

The `pure-git` namespace leaves room for additional Git operations inspired by the evaluated extensions:

- **Commit commands** (from qualiti/pi-git-commands): `/commit`, `/push`, `/commit-pr`
- **Git graph** (from @artale/pi-git-graph): ASCII commit graph visualization
- **Git hooks** (from @artale/pi-git-hooks): Hook manager for pre-commit, commit-msg
- **Changelog gen** (from @artale/pi-changelog): Auto-generate from git history

## Pre-requisite: Create Future Improvement Plan

Before creating the extension files, create a `FUTURE.md` file documenting planned enhancements and next-phase features:

- [ ] Create `extensions/pure-git/FUTURE.md` with roadmap for future improvements

### Planned future improvements (to document in FUTURE.md):

1. **Commit commands** — Port patterns from `qualiti/pi-git-commands-extension`:
   - `/git commit [hint]` — AI-powered commit message generation using `pi.exec()` + `complete()`
   - `/git push` — Smart push with conflict detection
   - `/git commit-pr [hint]` — Auto-commit, push, create PR via `gh`
   - Reference: repo analysis of recent commit style, session history for context

2. **Git graph visualization** — Adapt from `@artale/pi-git-graph`:
   - ASCII commit graph with branch topology
   - Contributor stats
   - Interactive branch map

3. **Git hooks manager** — Adapt from `@artale/pi-git-hooks`:
   - Install pre-commit, commit-msg, pre-push hooks from templates
   - Per-project hook configuration

4. **Changelog generation** — Adapt from `@artale/pi-changelog`:
   - Auto-generate from git history + conventional commits
   - Integrate with existing `pure-devkit` changelog tools

5. **Worktree config system** — Graduated from `@zenobius/pi-worktrees`:
   - Per-repo settings via `.pi/settings.json` (no external config service)
   - Template variables: `{{path}}`, `{{name}}`, `{{branch}}`, `{{project}}`
   - Lifecycle hooks: `onCreate`, `onSwitch`, `onBeforeRemove`
   - Branch name generator via Pi AI

6. **Branch management** — Inspired by `@zenobius/pi-worktrees`:
   - `/worktrees status` — Current worktree info with ahead/behind
   - `/worktrees cd <name>` — Print path to worktree
   - `/worktrees prune` — Clean up stale worktree references

## Verification

1. Add to `.pi/settings.json` for local testing
2. Smoke test: `pi -e "$PWD/extensions/pure-git" -ne -p "reply with just ok"`
3. `/worktrees create test-branch` → worktree created in `.worktrees/test-branch/`
4. `/worktrees list` → shows all worktrees with status
5. `/worktrees clean test-branch` → merged to main, worktree deleted, pushed
6. Error cases: duplicate branch name, dirty worktree clean, missing worktree name
7. Promote to `~/.pi/agent/settings.json`
