# pure-github — Development Plan

Forked from [@the-forge-flow/gh-pi](https://github.com/MonsieurBarti/GH-PI) v0.2.4 on 2025-04-15.

This file tracks planned features sourced from other Pi GitHub extensions. Each item references its origin and estimated scope.

---

## Completed

- **Phase 1.1** `/gh-status` repo dashboard
- **Phase 1.9** Command infrastructure (`registerDualCommand`, `repo-ref.ts`, `ghJson`, `ghGraphql`, `getCurrentBranch`, `cwd` tracking, config-based `defaultOwner`)
- **Phase 2** Remote repo browsing (`github_browse` with 18 actions including thread formatting and image extraction)
- **Phase 4** Pure ecosystem integration (config file support + startup status notifications)

---

## Backlog — Phase 1 Commands from espennilsen/pi-github

Port the command-based workflows from [@e9n/pi-github](https://github.com/espennilsen/pi/tree/main/extensions/pi-github).

### `/gh-pr-create` — LLM-assisted PR creation

**Source**: espennilsen `commands.ts` → `gh-pr-create`

Workflow: push branch → gather diff → LLM generates title/body → confirm with user → create PR. Sends a structured prompt to the agent via `pi.sendUserMessage()`.

**Scope**: New file `pr-create.ts`. Medium.

**Implementation notes**:
- Use `pi.exec()` instead of `execFile`
- Truncate large diffs (>50KB) before sending to LLM
- Ask user for confirmation before creating

### `/gh-pr-fix` — PR review thread resolution

**Source**: espennilsen `pr-fix.ts`

Workflow: fetch unresolved review threads via GraphQL → present to agent → agent fixes → user confirms → push → resolve threads via GraphQL → post summary comment. This is the most complex command.

**Scope**: New file `pr-fix.ts`. Large.

**Implementation notes**:
- Port GraphQL queries for review threads
- `ghGraphql()` helper already exists in `gh-helpers.ts`
- Support thread ID resolution
- Register prompt template for the fix flow
- Reset state on `session_shutdown`

### `/gh-pr-merge` — Merge with branch cleanup

**Source**: espennilsen `pr-merge.ts`

Workflow: find PR → fetch details → merge (squash/merge/rebase) → post summary comment → delete remote branch → delete local branch → pull base.

**Scope**: New file `pr-merge.ts`. Medium.

**Implementation notes**:
- Support `--squash` (default from config), `--merge`, `--rebase` flags
- Post summary comment with file list and stats
- Handle worktree branches (skip deletion if checked out in worktree)
- Use `pi.exec()` for all git/gh calls

### `/gh-pr-review` — Show review feedback

**Source**: espennilsen `commands.ts` → `gh-pr-review`

Shows PR review decision and individual review comments. Auto-detects PR from current branch.

**Scope**: Add to `commands.ts`. Small.

### `/gh-prs` and `/gh-issues` — List commands

**Source**: espennilsen `commands.ts` → `gh-prs`, `gh-issues`

Quick TUI commands to list open PRs/issues with filters. Uses `ctx.ui.notify()` for output.

**Scope**: Add to `commands.ts`. Small each.

### `/gh-notifications` — Unread notifications

**Source**: espennilsen `commands.ts` → `gh-notifications`

Fetches unread GitHub notifications via `gh api /notifications`. Shows type icons and reason.

**Scope**: Add to `commands.ts`. Small.

### `/gh-actions` — Workflow runs command

**Source**: espennilsen `commands.ts` → `gh-actions`

Lists recent workflow runs with status icons. Lower priority since we already have the `github_workflow` tool.

**Scope**: Add to `commands.ts`. Small.

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

## Current file structure

```
extensions/global/pure-github/
├── index.ts           # Entry — registers tools + commands, lifecycle
├── gh-client.ts       # GHClient class wrapping pi.exec()
├── repo-tools.ts      # github_repo tool
├── issue-tools.ts     # github_issue tool
├── pr-tools.ts        # github_pr tool
├── workflow-tools.ts  # github_workflow tool
├── browse-tools.ts    # github_browse tool (remote repo inspection)
├── commands.ts        # /gh-status + future commands
├── repo-ref.ts        # Repo ref parsing
├── format.ts          # Summary formatters
├── error-handler.ts   # GHError types
├── gh-helpers.ts      # ghJson / ghGraphql / getCurrentBranch
├── config.ts          # Config loader (pure ecosystem style)
├── CHANGELOG.md
├── README.md
└── PLAN.md            # This file
```

## Priority order

1. `/gh-pr-create` — high impact, medium effort
2. `/gh-pr-merge` — high impact, medium effort
3. `/gh-pr-fix` — very valuable, large effort
4. `/gh-pr-review` — small effort
5. `/gh-prs` and `/gh-issues` — small effort each
6. `/gh-notifications` — small effort
7. `/gh-actions` — small effort, lowest priority command
8. Phase 3 — nice-to-haves (low priority)
