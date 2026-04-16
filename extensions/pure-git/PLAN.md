# pure-git — Phase 5 Implementation Plan

Advanced worktree features ported from `@zenobius/pi-worktrees`, adapted to pure-git conventions.

## What we're adding

| Feature | Zenobius equivalent | pure-git approach |
|---------|-------------------|-------------------|
| Per-repo settings | `pi-worktrees.config.json` via `@zenobius/pi-extension-config` | `pure-git.json` via `getPurePath()` (pure-ecosystem standard) |
| Template variables | `{{path}}`, `{{name}}`, `{{branch}}`, `{{project}}`, `{{mainWorktree}}` | Same, plus `{{sessionId}}` and `{{timestamp}}` for logs |
| Lifecycle hooks | `onCreate`, `onSwitch`, `onBeforeRemove` | Same, run via `pi.exec()` not `spawn()` |
| Branch name generator | External `pi -p` subprocess | Use Pi's `complete()` API — no external process needed |
| `/worktrees status` | Shows project, branch, isWorktree, main path, total worktrees | Same |
| `/worktrees cd <name>` | Print path to worktree | Same (just shows the path) |
| `/worktrees prune` | `git worktree prune` with dry-run preview | Same |

## Design decisions (diverging from Zenobius)

1. **Config via pure-ecosystem standard** — Use `getPurePath("pure-git.json", "config", cwd)` with project→global override. No external config service dependency.
2. **Hooks via `pi.exec()`** — All hook commands run through `pi.exec()` (async, managed by Pi). Zenobius uses raw `spawn()` — we stay Pi-idiomatic.
3. **Branch name generator via `pi` subprocess** — Same as Zenobius: spawns `pi -p 'branch name for ...'` which creates an actual session in the worktree directory. The user can then immediately switch to that session from the browser. Using `complete()` would skip session creation, losing this benefit.
4. **No glob matching** — Zenobius has complex repo-URL→config matching with glob patterns, specificity scoring, and tie-breaking. We use simple project-name matching: config keyed by project basename or `*` for defaults. Simpler, sufficient for personal use.
5. **Simplified hook display** — Zenobius has configurable pending/success/error templates with ANSI colors. We use themed `ctx.ui.notify()` calls with emoji prefixes (⏳ → ✓/✗). Less config surface, Pi theme-aware.
6. **No StatusIndicator class** — Zenobius has a spinner class. We don't need it — `ctx.ui.notify()` is sufficient for our use case.

## File structure

```
extensions/pure-git/
├── index.ts                    # Entry point (updated)
├── services/
│   ├── git.ts                  # Existing — add getRemoteUrl(), getProjectName()
│   ├── config.ts               # NEW — per-repo settings loading + overrides
│   ├── templates.ts            # NEW — {{var}} expansion
│   └── hooks.ts                # NEW — lifecycle hook runner
├── commands/
│   └── worktrees.ts            # Existing — add status/cd/prune subcommands + hooks
├── README.md
├── CHANGELOG.md
└── FUTURE.md
```

## Config schema (`pure-git.json`)

```jsonc
{
  // Global defaults (in ~/.pi/agent/pure/config/pure-git.json)
  "worktreeRoot": "{{mainWorktree}}/.worktrees",  // Where worktrees live
  "onCreate": "echo 'Created {{path}}'",           // string or array of strings
  "onSwitch": null,                                 // Run when switching to existing worktree
  "onBeforeRemove": null,                           // Run before removing, non-zero blocks removal
  "branchNameGenerator": "pi -p 'branch name for {{prompt}}' --model local/model"  // Spawns pi subprocess, creates a session

  // Per-project overrides (in <project>/.pi/pure/config/pure-git.json)
  "projects": {
    "my-project": {
      "worktreeRoot": "~/worktrees/{{project}}",
      "onCreate": ["mise install", "bun install"],
      "onSwitch": "mise run dev:resume"
    }
  }
}
```

**Resolution order**: `projects[<basename>]` → top-level defaults → built-in defaults.

## Implementation order

### Step 1: `services/templates.ts`
- `TemplateContext` interface with `path`, `name`, `branch`, `project`, `mainWorktree`, `sessionId`, `timestamp`
- `expandTemplate(template, ctx)` — replaces `{{var}}` patterns
- `sanitizePathPart(value)` — for safe log file names

### Step 2: `services/config.ts`
- `GitConfig` interface (worktreeRoot, onCreate, onSwitch, onBeforeRemove)
- `loadConfig(cwd)` — reads `pure-git.json` from pure config dirs (project → global)
- `resolveConfig(cwd)` — merges project-specific into defaults
- Built-in defaults: `worktreeRoot = "{{mainWorktree}}/.worktrees"`, `onCreate = null`

### Step 3: `services/hooks.ts`
- `HookContext` — same as TemplateContext
- `runHook(ctx, commands, exec, notify)` — runs commands sequentially via `pi.exec()`
  - Accepts string or string[] for commands
  - Expands templates before execution
  - Stops on first failure, returns `{ success, executed, failed? }`
  - Logs output via notify (⏳ running, ✓ success, ✗ failed)
- `generateBranchName(template, input, cwd)` — spawns `pi` subprocess with timeout
  - Shell-quotes the input, replaces `{{prompt}}` in template
  - Validates output via `git check-ref-format --branch`
  - Returns `{ ok, branchName }` or `{ ok: false, code, message }`
  - Sets `PI_WORKTREE_PROMPT` env var for subprocess access

### Step 4: Update `services/git.ts`
- Add `getRemoteUrl(exec, cwd)` — get origin URL
- Add `getProjectName(exec, cwd)` — basename of main worktree path
- Already has everything else needed

### Step 5: Update `commands/worktrees.ts`

**New subcommands:**
- `/worktrees status` — Show current worktree info (project, branch, path, isWorktree, total)
- `/worktrees cd <name>` — Print path to worktree (just shows the path)
- `/worktrees prune` — Dry-run then prune stale worktree references

**Hook integration in existing commands:**
- `create` → run `onCreate` hook after worktree creation
- `create` (existing worktree) → run `onSwitch` hook
- `clean`/`delete` → run `onBeforeRemove` hook (non-zero blocks removal)

**Browser integration:**
- `c` create → runs `onCreate` hook after creation
- `⏎` switch → runs `onSwitch` hook on switch
- `d`/`x` delete → runs `onBeforeRemove` hook before removal

### Step 6: Update `index.ts`
- No changes needed — all registration happens in worktrees.ts

### Step 7: Update docs
- README.md — document new subcommands, config, hooks, template variables
- CHANGELOG.md — add v0.3.0 entry

## What we're NOT porting

| Zenobius feature | Why skip |
|-----------------|----------|
| `@zenobius/pi-extension-config` dependency | pure-git is self-contained |
| Glob-based repo matching with specificity scoring | Over-engineered for personal use |
| `StatusIndicator` spinner class | `ctx.ui.notify()` is sufficient |
| Configurable pending/success/error display templates | Emoji prefixes are simpler |
| `cmdInit` interactive config setup | Users can edit JSON directly |
| `cmdSettings` get/set individual settings | Users can edit JSON directly |
| `cmdTemplates` preview template variables | Documented in README instead |
| `matchingStrategy` (fail-on-tie/first-wins/last-wins) | No glob matching needed |
| Logfile support | Can add later if needed |

## Estimated complexity

| File | Lines | Effort |
|------|-------|--------|
| `services/templates.ts` | ~25 | Trivial |
| `services/config.ts` | ~80 | Moderate |
| `services/hooks.ts` | ~160 | Significant |
| `services/git.ts` additions | ~15 | Trivial |
| `commands/worktrees.ts` updates | ~150 | Significant |
| Docs | ~60 | Easy |
| **Total** | **~490** | |
