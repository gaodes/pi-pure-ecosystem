# pure-github — Development Plan

Forked from [@the-forge-flow/gh-pi](https://github.com/MonsieurBarti/GH-PI) v0.2.4 on 2025-04-15.

This file tracks planned features sourced from other Pi GitHub extensions. Each item references its origin and estimated scope.

---

## Phase 1 — Commands from espennilsen/pi-github

Port the command-based workflows from [@e9n/pi-github](https://github.com/espennilsen/pi/tree/main/extensions/pi-github). These add user-triggered TUI commands that complement the existing LLM tools.

### 1.1 `/gh-status` — Repo dashboard command

**Source**: espennilsen `commands.ts` → `gh-status`

Shows a compact repo overview: open PR count (mine + review-requested), open issues, current branch PR, CI status. Replaces multiple individual tool calls with one user command.

**Scope**: New file `commands.ts`, `repo-ref.ts` helper. Medium.

**Implementation notes**:
- Port `registerDualCommand` helper (registers `/gh-*` + `/github-*` from one definition)
- Port `extractRepoRef` / `resolveRepo` / `repoFlag` from espennilsen's `repo-ref.ts`
- Use `pi.exec()` instead of `execFile`
- Track `cwd` from `session_start` context

### 1.2 `/gh-pr-create` — LLM-assisted PR creation

**Source**: espennilsen `commands.ts` → `gh-pr-create`

Workflow: push branch → gather diff → LLM generates title/body → confirm with user → create PR. Sends a structured prompt to the agent via `pi.sendUserMessage()`.

**Scope**: New file `pr-create.ts`. Medium.

**Implementation notes**:
- Use `pi.exec()` instead of `execFile`
- Truncate large diffs (>50KB) before sending to LLM
- Ask user for confirmation before creating

### 1.3 `/gh-pr-fix` — PR review thread resolution

**Source**: espennilsen `pr-fix.ts`

Workflow: fetch unresolved review threads via GraphQL → present to agent → agent fixes → user confirms → push → resolve threads via GraphQL → post summary comment. This is the most complex command.

**Scope**: New file `pr-fix.ts`. Large.

**Implementation notes**:
- Port GraphQL queries for review threads
- Port `ghGraphql()` helper using `pi.exec("gh", ["api", "graphql", ...])`
- Support thread ID resolution
- Register prompt template for the fix flow
- Reset state on `session_shutdown` (not `session_switch`/`session_fork` — those events don't exist in current Pi)

### 1.4 `/gh-pr-merge` — Merge with branch cleanup

**Source**: espennilsen `pr-merge.ts`

Workflow: find PR → fetch details → merge (squash/merge/rebase) → post summary comment → delete remote branch → delete local branch → pull base.

**Scope**: New file `pr-merge.ts`. Medium.

**Implementation notes**:
- Support `--squash` (default), `--merge`, `--rebase` flags
- Post summary comment with file list and stats
- Handle worktree branches (skip deletion if checked out in worktree)
- Use `pi.exec()` for all git/gh calls

### 1.5 `/gh-pr-review` — Show review feedback

**Source**: espennilsen `commands.ts` → `gh-pr-review`

Shows PR review decision and individual review comments. Auto-detects PR from current branch.

**Scope**: Add to `commands.ts`. Small.

### 1.6 `/gh-prs` and `/gh-issues` — List commands

**Source**: espennilsen `commands.ts` → `gh-prs`, `gh-issues`

Quick TUI commands to list open PRs/issues with filters. Uses `ctx.ui.notify()` for output.

**Scope**: Add to `commands.ts`. Small each.

### 1.7 `/gh-notifications` — Unread notifications

**Source**: espennilsen `commands.ts` → `gh-notifications`

Fetches unread GitHub notifications via `gh api /notifications`. Shows type icons and reason.

**Scope**: Add to `commands.ts`. Small.

### 1.8 `/gh-actions` — Workflow runs command

**Source**: espennilsen `commands.ts` → `gh-actions`

Lists recent workflow runs with status icons. Lower priority since we already have the `github_workflow` tool.

**Scope**: Add to `commands.ts`. Small.

### 1.9 Infrastructure for commands

**Scope**: Shared across all commands.

- [ ] Port `registerDualCommand` pattern from espennilsen
- [ ] Create `repo-ref.ts` (repo reference parsing: owner/repo, URL, #number)
- [ ] Port `gh.ts` helpers: `ghJson()`, `ghGraphql()`, `getCurrentBranch()` — all using `pi.exec()`
- [ ] Track `cwd` from `session_start` context (for git commands)
- [ ] `defaultOwner` setting support from `pure.github.defaultOwner`

---

## Phase 2 — Remote repo browsing from maria-rcks/pi-github

Port remote repo inspection tools from [pi-github](https://github.com/maria-rcks/pi-github). These add the ability to read, search, and browse any GitHub repo without cloning.

### 2.1 `github_browse` tool — Remote file reading

**Source**: maria-rcks `src/github/fetchers.ts` → `fetchRepoFile`

Read a file from any public GitHub repo (or authenticated private repo) using the `gh api` endpoint for repo contents. Base64 decode, line range support.

**Scope**: New file `browse-tools.ts`. Medium.

**Implementation notes**:
- Use `pi.exec("gh", ["api", ...])` instead of direct `fetch()` calls
- Support `startLine`/`endLine` for partial reads
- Support `ref` parameter for branch/tag/commit

### 2.2 `github_browse` tool — Directory listing

**Source**: maria-rcks → `fetchRepoDirectory`

List directory contents of any GitHub repo path.

**Scope**: Add to `browse-tools.ts`. Small.

### 2.3 `github_browse` tool — Code search

**Source**: maria-rcks → `searchRepoCode`

Search code within a repo using GitHub's code search API. Supports path filtering.

**Scope**: Add to `browse-tools.ts`. Small.

### 2.4 `github_browse` tool — File glob

**Source**: maria-rcks → `fetchRepoTreeFiles` + `globMatch`

Fetch the full repo tree and filter by glob pattern. Useful for finding all `*.test.ts` files, etc.

**Scope**: Add to `browse-tools.ts`. Small.

### 2.5 `github_browse` tool — Commit search

**Source**: maria-rcks → `searchRepoCommits`

Search commits by query, author, date range.

**Scope**: Add to `browse-tools.ts`. Small.

### 2.6 `github_browse` tool — PR overview & checks

**Source**: maria-rcks → `fetchPrOverview`, `fetchPrChecks`, `fetchPrCommits`

Dedicated actions for PR overview (metadata + files + reviews + checks in one call), per-file diff, and commit listing.

**Scope**: Add to `browse-tools.ts`. Medium.

### 2.7 Thread formatting

**Source**: maria-rcks → `renderThreadMarkdown`

Format GitHub issue/PR/discussion threads as chronological markdown with filters (author, kind, since, until, contains).

**Scope**: New file `thread-format.ts`. Medium.

**Implementation notes**:
- Auto-detect entity type (issue/PR/discussion)
- Support pagination
- Thread caching for repeated access

### 2.8 Image extraction

**Source**: maria-rcks → `collectImages`, `downloadImage`

Extract image references from threads and download by ID. Lower priority.

**Scope**: Add to `thread-format.ts` or separate `image-tools.ts`. Low priority.

---

## Phase 3 — Nice-to-haves from PriNova

### 3.1 Custom TUI renderers

**Source**: @prinova/pi-github-tools

Themed renderers using Pi's TUI components for tool output. Uses `theme.fg()` for colored output.

**Scope**: Low priority. Consider only if default text output is insufficient.

### 3.2 PAT file support

**Source**: @prinova/pi-github-tools

Support `GITHUB_PAT_FILE` for reading token from a file (NixOS, Docker secrets). Not needed since we use `gh` CLI auth.

**Scope**: Skip — not needed with `gh` CLI auth model.

---

## Phase 4 — Pure ecosystem integration

### 4.1 Config file support

Add `~/.pi/agent/pure/config/pure-github.json` for persistent settings.

Settings to support:
- `defaultOwner` — default GitHub owner/org for commands
- `mergeStrategy` — default merge strategy for `/gh-pr-merge`
- `notifications.enabled` — whether to check notifications on session start

**Scope**: Inline path helpers + config resolution. Small.

### 4.2 Session start enhancements

- Show CI status for current branch on session start (if in a git repo)
- Show review-requested count

**Scope**: Small additions to `session_start` handler.

---

## File structure (target)

```
extensions/global/pure-github/
├── index.ts           # Entry — registers tools + commands, lifecycle
├── gh-client.ts       # GHClient class wrapping pi.exec() (from GH-PI)
├── repo-tools.ts      # github_repo tool (from GH-PI)
├── issue-tools.ts     # github_issue tool (from GH-PI)
├── pr-tools.ts        # github_pr tool (from GH-PI)
├── workflow-tools.ts  # github_workflow tool (from GH-PI)
├── browse-tools.ts    # github_browse tool (Phase 2, from maria-rcks)
├── commands.ts        # All /gh-* commands (Phase 1, from espennilsen)
├── pr-create.ts       # /gh-pr-create (Phase 1.2)
├── pr-fix.ts          # /gh-pr-fix (Phase 1.3)
├── pr-merge.ts        # /gh-pr-merge (Phase 1.4)
├── repo-ref.ts        # Repo ref parsing (Phase 1.9)
├── format.ts          # Summary formatters (from GH-PI, extend as needed)
├── error-handler.ts   # GHError types (from GH-PI)
├── thread-format.ts   # Thread formatting (Phase 2.7, from maria-rcks)
├── CHANGELOG.md
├── README.md
└── PLAN.md            # This file
```

---

## Priority order

1. **Phase 1.9** — Command infrastructure (`registerDualCommand`, `repo-ref.ts`, `ghJson`, `cwd` tracking)
2. **Phase 1.1** — `/gh-status` (high impact, low effort)
3. **Phase 1.2** — `/gh-pr-create` (high impact)
4. **Phase 1.4** — `/gh-pr-merge` (high impact)
5. **Phase 1.3** — `/gh-pr-fix` (complex but very valuable)
6. **Phase 1.5–1.8** — Remaining commands (low effort each)
7. **Phase 2.1–2.5** — Remote repo browsing (high value for agent autonomy)
8. **Phase 4.1** — Config file support
9. **Phase 2.6–2.8** — PR overview, thread formatting, images
10. **Phase 3** — Nice-to-haves (low priority)
