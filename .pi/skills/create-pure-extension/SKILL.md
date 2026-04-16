---
name: create-pure-extension
description: Create a new pure-* extension from scratch for the pi-pure-ecosystem. Use when the user wants to build something new that doesn't exist yet.
---

# Create a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill.

This skill builds a new extension from scratch when no existing extension fits the need.

## When to Use This Skill

| Request | Skill to Use |
|---------|--------------|
| **Build a new extension from scratch** | `create-pure-extension` |
| Import/fork an external extension | `import-pure-extension` |
| Sync an extension with upstream | `update-pure-extension` |
| Add features to an extension we own | `enhance-pure-extension` |

## What to Build

| Goal | Build a... | Key files |
|------|------------|----------|
| Teach Pi a workflow | **Skill** | `SKILL.md` with YAML frontmatter |
| New tool, command, or behavior | **Extension** | `index.ts` entry point |
| Reuse a prompt pattern | **Prompt template** | `.md` with `{{variable}}` |
| Project coding guidelines | **Context file** | `AGENTS.md` |
| Change Pi's appearance | **Theme** | `theme.json` |

### Skill vs Extension

If `bash` + instructions can do it, prefer a **Skill** (simpler). Use **Extension** for event hooks, typed tools, UI components, or policy enforcement.

## Extension Conventions

- **Name**: `pure-<name>`
- **Structure**: single `index.ts`. Split only if unwieldy.
- **package.json**: only if npm deps needed
- **Self-contained**: inline path helpers, no cross-extension deps
- **TypeBox**: `Type`, `Static` for tool parameters
- **Storage paths**:
  - Global: `~/.pi/agent/pure/{config,cache}/pure-<name>.json`
  - Project: `<project>/.pi/pure/{config,cache}/pure-<name>.json`
- **Config reads**: project first, fall back to global
- **CHANGELOG.md**: GitHub-style (`## [version] - YYYY-MM-DD`)

## Workflow: From-Scratch

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

Create `extensions/pure-<name>/index.ts`:

```typescript
import { type Static, Type } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { Container, Text } from "@mariozechner/pi-tui";
import { ToolCallHeader, ToolBody } from "@aliou/pi-utils-ui";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";

// Path helpers
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

// Tool registration
const parameters = Type.Object({
  // ... your parameters
});

type MyToolParams = Static<typeof parameters>;

const myTool = {
  name: "my_tool",
  label: "My Tool",
  description: "What this tool does.",
  parameters,

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ output: "working..." });
    // ... implementation
    return { content: [{ type: "text", text: "result" }] };
  },
};

// Extension entry point
export default function (pi: ExtensionAPI) {
  pi.registerTool(myTool);
  // ... register commands, hooks
}
```

### 4. Create README.md and CHANGELOG.md

README must include **Sources / Inspiration** section.

### 5. Check, lint, test

```bash
biome check --write --unsafe extensions/pure-<name>/
```

**Smoke test:**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply of just ok" 2>&1 | tail -5
```

**Functional test:** Add to `.pi/settings.json`, `/reload`, test.

**If developing in a worktree:**
1. Smoke test: `pi -e "$PWD/.worktrees/<branch>/extensions/pure-<name>" -ne -p "reply of just ok"`
2. Functional test: call `switch_worktree` tool to switch session to worktree, user tests, switch back.

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

## Mode Awareness

Pi runs in different modes. Extensions must handle all:

| Mode | `ctx.hasUI` | Behavior |
|------|-------------|----------|
| Interactive | `true` | Full TUI |
| RPC | `true` | JSON protocol |
| Print (`-p`) | `false` | No UI |

### Three-Tier Pattern

```typescript
handler: async (_args, ctx) => {
  // Tier 1: Print mode
  if (!ctx.hasUI) { console.log("output"); return; }

  // Tier 2: Interactive mode
  const result = await ctx.ui.custom<"closed">((tui, theme, kb, done) => {
    return new MyComponent(theme, () => done("closed"));
  });

  // Tier 3: RPC fallback
  if (result === undefined) { ctx.ui.notify("output", "info"); }
}
```

### Fire-and-Forget (never need `hasUI` check)

`ctx.ui.notify()`, `ctx.ui.setStatus()`, `ctx.ui.setWidget()`

### Dialog Methods (need fallback)

| Method | Print mode |
|--------|------------|
| `select()`, `confirm()`, `custom()` | `undefined` / `false` |

---

## Reference Files

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns |
| `references/modes.md` | Mode awareness |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify |
| `references/hooks.md` | Event handlers |
| `references/components.md` | TUI components |
| `references/providers.md` | Provider registration |

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

- [ ] Interviewed user and captured requirements
- [ ] Designed extension (name, tier, what to register)
- [ ] Created `index.ts` with inline path helpers
- [ ] Registered tools/commands/hooks
- [ ] Created README.md with Sources / Inspiration
- [ ] Created CHANGELOG.md
- [ ] `biome check` passes zero errors
- [ ] Smoke test passed
- [ ] User confirmed functional test
- [ ] Committed and promoted to global
