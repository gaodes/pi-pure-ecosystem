---
name: import-pure-extension
description: Import an existing Pi extension into the pi-pure-ecosystem by forking from an external source. Use when the user asks to import, fork, or adapt an external extension.
---

# Import a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill imports an existing extension into the pure-ecosystem by forking it and adapting to pure-* conventions.

## When to Use This Skill

| Request | Skill to Use |
|---------|--------------|
| **Import/fork an external extension** | `import-pure-extension` |
| Build a new extension from scratch | `create-pure-extension` |
| Sync an extension with upstream | `update-pure-extension` |
| Add features to an extension we own | `enhance-pure-extension` |

## Workflow: Import Extension

### 1. Identify sources

Ask the user:
- **Primary source**: which extension to fork (repo URL)?
- **What to keep, add, or change**?

### 2. Clone and verify

```bash
git clone <repo-url> /tmp/<source-name>
cp -R /tmp/<source-name> extensions/pure-<name>
```

**Test as-is before modifying:**
1. Add to `package.json`: `"./extensions/pure-<name>/index.ts"`
2. Add local path in `.pi/settings.json`: `{"packages": ["../extensions/pure-<name>"]}`
3. Run smoke test and ask user to `/reload` for functional test.

Wait for user confirmation before proceeding.

### 3. Rename to pure-* conventions

- **Directory**: `pure-<name>/`
- **Tool/command names**: prefer short, fall back to `pure_<name>` or `/pure-<name>`
- **Storage paths**: inline helpers using `~/.pi/agent/pure/{config,cache}/pure-<name>.json`

### 4. Strip unnecessary files

Delete: `.git/`, `node_modules/`, lockfiles, CI configs, `.github/`, test fixtures

Keep: essential source files (ideally single `index.ts`)

### 5. Add path helpers (inline)

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

function loadConfig<T>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
    const project = readPureJson<T>(filename, category, "project", cwd);
    if (project !== undefined) return project;
    return readPureJson<T>(filename, category, "global");
}
```

### 6. Create README.md and CHANGELOG.md

README must include **Sources / Inspiration** section linking to upstream.

### 7. Check, lint, test

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test:**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5
```

**Functional test:** Ask user to `/reload` and test.

### 8. Commit and promote

```bash
git add . && git commit -m "pure-<name>: initial import from <source>"
git push
```

**Promote:**
1. Remove from `.pi/settings.json`
2. Add to `~/.pi/agent/settings.json`
3. `/reload` to verify global load

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
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback — use explicit sentinels for close/cancel
5. **Error detection**: check for missing `details` fields (framework sets `{}` on throw)
6. **Signal forwarding**: pass to all async operations
7. **Never `child_process`**: use `pi.exec()`
8. **Never `homedir()`**: use `getAgentDir()`
9. **Typed param alias**: `type MyParams = Static<typeof parameters>`
10. **Entry point pattern**: load config → check enabled → register
11. **API key gating**: check before registering tools — notify if missing
12. **Fire-and-forget methods**: `notify`, `setStatus`, etc. don't need `hasUI` check
13. **No unused `_signal`**: forward or remove — never prefix with `_` if actually used
14. **Check existing components**: before creating custom TUI, check `pi-tui` or `pi-coding-agent`
15. **Settings UI**: use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

---

## Checklist

- [ ] Cloned and verified primary source works
- [ ] Renamed to pure-* conventions
- [ ] Stripped unnecessary files
- [ ] Added inline path helpers
- [ ] Created README.md with Sources / Inspiration
- [ ] Created CHANGELOG.md
- [ ] `biome check` passes zero errors
- [ ] Smoke test passed
- [ ] User confirmed functional test
- [ ] Committed and promoted to global
