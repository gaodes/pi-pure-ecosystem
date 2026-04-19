# Create a Pure Extension

Build a new extension from scratch when no existing extension fits the need.

## When to Use

| Request | Read this instead |
|---------|------------------|
| **Build a new extension from scratch** | You're in the right place |
| Import/fork an external extension | `import.md` |
| Add features to an extension we own | `enhance.md` |
| Sync an extension with upstream | `update.md` |
| Publish to npm | `publish.md` |

## Conventions

Read **`import.md` → Conventions** for the full reference: naming, structure, path helpers, templates, mode awareness, critical rules, dependency audit, worktree workflow, and reference file index. All shared rules live there.

## Workflow

### 1. Interview the user

1. What does the extension do?
2. What triggers it? (command, tool, hook, automatic)
3. Does it need persistence?
4. Does it need a UI?
5. Does it need external APIs?

### 2. Design

- Extension name (`pure-<name>`)
- Activation tier: global or local
- What it registers: tool, command, hooks
- Config structure

### 3. Implement

Create `extensions/pure-<name>/index.ts` using the **Extension Template** from `import.md` → Conventions.

Load specific reference files on demand:
- `references/tools.md` when implementing tools
- `references/hooks.md` when adding event handlers
- `references/components.md` when building TUI
- `references/commands.md` when registering commands

### 4. Create README.md and CHANGELOG.md

README must include **Sources / Inspiration** section (even if from-scratch, credit any repos that inspired the design).

### 5. Check, lint, test

Follow the **Check, Lint, Test** section in `import.md` → Conventions.

### 6. Commit and promote

```bash
git add . && git commit -m "pure-<name>: initial creation"
git push
```

**If in a worktree**, merge first:
```bash
/worktrees clean <branch-name>
```

**Promote:**
1. Add to `~/.pi/agent/settings.json`
2. Remove from `.pi/settings.json`
3. `/reload` to verify

---

## Checklist

- [ ] Interviewed user and captured requirements
- [ ] Designed extension (name, tier, what to register)
- [ ] Created `index.ts` with inline path helpers (from `import.md` → Conventions)
- [ ] Registered tools/commands/hooks
- [ ] Created README.md with Sources / Inspiration
- [ ] Created CHANGELOG.md
- [ ] `biome check` passes zero errors
- [ ] Smoke test passed
- [ ] User confirmed functional test
- [ ] Committed and promoted to global
