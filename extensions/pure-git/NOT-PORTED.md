# Not Ported from `@zenobius/pi-worktrees`

Features from [zenobi-us/pi-worktrees](https://github.com/zenobi-us/pi-worktrees) that were evaluated but intentionally skipped. Can be revisited if needed.

## Config system

| Feature | Zenobius implementation | Why skipped |
|---------|----------------------|-------------|
| `@zenobius/pi-extension-config` dependency | External config service with migrations, save/load API | pure-git is self-contained — uses `getPurePath()` standard |
| Glob-based repo URL matching | Normalizes URLs, matches against glob patterns with specificity scoring | Over-engineered for personal use — project name matching is sufficient |
| `matchingStrategy` (fail-on-tie/first-wins/last-wins) | Tie-breaking when multiple patterns match with equal specificity | No glob matching, so no ties possible |
| Config migrations (01–05) | Five migration scripts for schema evolution | Extension is new — no legacy configs to migrate |
| `cmdInit` — interactive config setup | TUI-based settings wizard | Users can edit JSON directly; config is simple |
| `cmdSettings` — get/set individual settings | `get` and `set` subcommands for config values | Users can edit JSON directly |
| `cmdTemplates` / `cmdVars` — preview template variables | Shows expanded template output for debugging | Documented in README instead |

## UI

| Feature | Zenobius implementation | Why skipped |
|---------|----------------------|-------------|
| `StatusIndicator` class | Spinner/progress bar with animated frames in status bar | `ctx.ui.notify()` is sufficient for our use case |
| Configurable pending/success/error display templates | `onCreateCmdDisplayPending`, `onCreateCmdDisplaySuccess`, etc. with `{{cmd}}` template | Emoji prefixes (⏳ ✓ ✗) are simpler and require zero config |
| Configurable ANSI colors for hook output | `onCreateCmdDisplayPendingColor`, `onCreateCmdDisplaySuccessColor`, etc. | Pi's theme system handles colors; emoji doesn't need customization |
| `onCreateDisplayOutputMaxLines` config | Control how many output lines to show per hook command | We show last 3 lines by default — sufficient for most cases |

## Logging

| Feature | Zenobius implementation | Why skipped |
|---------|----------------------|-------------|
| Logfile support | Writes hook output to configurable logfile with `{{sessionId}}` and `{{timestamp}}` | Can add later if needed; notify output is sufficient for now |
| Logfile template config | `"logfile": "/tmp/pi-worktree-{sessionId}-{name}.log"` | |
| `resolveLogfilePath()` | Expands logfile template with session/name/timestamp | |

## Branch name generator (partial port)

We ported the subprocess approach but not all the surrounding infrastructure:

| Feature | Status |
|---------|--------|
| `pi` subprocess spawning with timeout | ✅ Ported |
| `PI_WORKTREE_PROMPT` env var | ✅ Ported |
| `git check-ref-format --branch` validation | ✅ Ported |
| Configurable timeout via config | ❌ Hardcoded 10s |
| `--generate` flag (explicit opt-in) | ❌ Not needed — can use directly if configured |

## Hook runner (partial port)

We ported the core hook runner but simplified the output:

| Feature | Status |
|---------|--------|
| Sequential command execution | ✅ Ported |
| Template expansion | ✅ Ported |
| Stop on first failure | ✅ Ported |
| String or string[] commands | ✅ Ported |
| Real-time output streaming via notify | ❌ Simplified — show tail only |
| Per-command state tracking (pending/running/success/failed) | ❌ Simplified — emoji only |
| Command display templates | ❌ Emoji prefixes |
| Logfile writing | ❌ |
