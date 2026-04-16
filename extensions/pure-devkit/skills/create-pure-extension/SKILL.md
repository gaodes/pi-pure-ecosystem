---
name: create-pure-extension
description: Create a new pure-* extension, either by forking an existing Pi extension or building from scratch. Use when the user asks to create a new extension, add a new pure-* extension, or fork an extension.
---

# Create a Pure Extension

Follow the project `AGENTS.md` design philosophy while using this skill:

- **Simplicity first** — prefer the smallest workable adaptation
- **Pi built-ins before external tools/packages** — use Pi APIs, `create-pure-extension`, and pi-dev-kit tools first
- **Standalone, ecosystem-ready** — the extension must work independently but follow pure-* conventions

This is a **mono repo** — use `/worktrees create` for new features to keep `main` clean.

## What to Build

| Goal | Build a... | Key files to create |
|------|------------|---------------------|
| Teach Pi a workflow or how to use a tool/API/CLI | **Skill** | `SKILL.md` with YAML frontmatter + markdown body |
| Give Pi a new tool, command, or runtime behavior | **Extension** | `index.ts` entry point |
| Reuse a prompt pattern with variables | **Prompt template** | `.md` file with `{{variable}}` placeholders |
| Set project-wide coding guidelines | **Context file** | `AGENTS.md` in project root |
| Change Pi's appearance | **Theme** | `theme.json` with color definitions |

### Skill vs Extension

If `bash` + instructions can do it, prefer a **Skill** (simpler, no code to maintain). If you need event hooks, typed tools, UI components, or policy enforcement, use an **Extension**.

- "Pi should know our deploy process" -> **Skill**
- "Pi should confirm before `rm -rf`" -> **Extension** (event interception)
- "Pi should use Brave Search" -> **Skill** (instructions + CLI scripts)
- "Pi should have a structured `db_query` tool" -> **Extension** (registerTool)

## Extension Conventions

- **Name**: `pure-<name>` (directory, config file, widget ID, message type, storage paths)
- **Tool/command names**: prefer short descriptive names; fall back to `pure_<name>` or `/pure-<name>` only if nothing better fits.
- **Structure**: single `index.ts` entry point. Split only when readability clearly benefits.
- **package.json** (per-extension): only if npm dependencies are needed. Zero-dependency extensions omit it.
- **Self-contained**: inline path helpers, no cross-extension dependencies.
- **TypeBox schemas**: use `@sinclair/typebox` (`Type`, `Static`) for tool parameters.
- **Settings namespace**: `pure.<name>.*`
- **Storage paths**:
  - Global: `~/.pi/agent/pure/{config,cache}/pure-<name>.json`
  - Project: `<project>/.pi/pure/{config,cache}/pure-<name>.json`
- **Config reads**: project first, fall back to global.
- **Scaffold global config** on first load if missing. Never scaffold project config (opt-in).
- **Auto-migrate** from old flat paths on first load.
- **CHANGELOG.md**: GitHub-style (`## [version] - YYYY-MM-DD`). Update when behavior changes.
- **README.md**: must include a **Sources / Inspiration** section. For forked extensions, the first linked repo is the primary upstream source.

## Key Pi APIs

Pi injects these packages via jiti at runtime. Extensions do not need to install them:

```typescript
// Core types
import type {
  ExtensionAPI,
  ExtensionContext,
  AgentToolResult,
  Theme,
  ToolRenderResultOptions,
} from "@mariozechner/pi-coding-agent";

// Rendering utilities
import { getMarkdownTheme, keyHint, truncateHead, formatSize, getAgentDir } from "@mariozechner/pi-coding-agent";

// TUI components
import { Container, Text, SelectList, SettingsList, Spacer, Markdown } from "@mariozechner/pi-tui";

// Tool UI components (from @aliou/pi-utils-ui)
import { ToolCallHeader, ToolBody, ToolFooter } from "@aliou/pi-utils-ui";
```

## Mode Awareness

Pi runs in different modes. Extensions must handle all of them.

### Modes

| Mode | `ctx.hasUI` | Description |
|------|-------------|-------------|
| **Interactive** | `true` | Full TUI. Normal terminal usage. |
| **RPC** (`--mode rpc`) | `true` | JSON protocol. A host handles UI. |
| **Print** (`-p`) | `false` | No UI. Extensions run but cannot prompt. |

### The Three-Tier Pattern

When a command uses `ctx.ui.custom()` for rich display:

```typescript
pi.registerCommand("my-command", {
  handler: async (_args, ctx) => {
    // Tier 1: Print mode — no UI at all
    if (!ctx.hasUI) {
      console.log("Output");
      return;
    }

    // Tier 2: Interactive mode — full TUI component.
    // Use an explicit non-undefined sentinel for close/cancel.
    const result = await ctx.ui.custom<"closed">((tui, theme, _kb, done) => {
      return new MyDisplay(theme, () => done("closed"));
    });

    // Tier 3: RPC mode — custom() returns undefined by design.
    if (result === undefined) {
      ctx.ui.notify("Output", "info");
    }
  },
});
```

### Fire-and-Forget Methods

These methods are safe to call in any mode — never need `ctx.hasUI` check:

- `ctx.ui.notify()` — transient feedback
- `ctx.ui.setStatus()` — status bar
- `ctx.ui.setWidget()` — widget area

### Dialog Methods (need fallback)

These return a value and require handling when UI is unavailable:

| Method | Interactive | RPC | Print |
|--------|-------------|-----|-------|
| `ctx.ui.select()` | TUI picker | request/response | `undefined` |
| `ctx.ui.confirm()` | TUI dialog | request/response | `false` |
| `ctx.ui.custom()` | component | `undefined` | `undefined` |

**Key**: `ctx.ui.custom()` returns `undefined` in both RPC and Print modes. Use explicit sentinels (`"closed"`, `false`, `null`) for close/cancel — not `undefined`.

### tool_call Hooks

For blocking hooks, decide a safe default when no UI is available:

```typescript
pi.on("tool_call", async (event, ctx) => {
  if (isDangerous(event)) {
    if (!ctx.hasUI) {
      return { block: true, reason: "Dangerous command blocked (no UI)" };
    }
    // ... confirm with user
  }
  return undefined;
});
```

## Tool Development

### Basic Tool Registration

```typescript
import { type Static, Type } from "@mariozechner/pi-coding-agent";

const parameters = Type.Object({
  query: Type.String({ description: "Search query" }),
  limit: Type.Optional(Type.Number({ description: "Max results", default: 10 })),
});

// Typed param alias — define once, use everywhere
type MyToolParams = Static<typeof parameters>;

const myTool = {
  name: "my_tool",
  label: "My Tool", // Required: human-readable name
  description: "What this tool does.",
  parameters,

  async execute(
    toolCallId: string,
    params: MyToolParams,
    signal: AbortSignal | undefined,
    onUpdate: AgentToolUpdateCallback | undefined,
    ctx: ExtensionContext,
  ): Promise<AgentToolResult> {
    // Always use optional chaining for onUpdate
    onUpdate?.({ output: "partial" });
    // Always forward signal to fetch/exec calls
    const result = await fetchData(params.query, { signal });
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
  },
};
```

**Execute parameter order**: `(toolCallId, params, signal, onUpdate, ctx)` — signal comes before onUpdate.

### Error Detection

When a tool throws, the framework sets `details: {}` (empty object). Check for missing expected fields:

```typescript
renderResult(result, options, theme) {
  const { details } = result;

  // details is {} when tool threw — expected fields are missing
  if (!details?.results) {
    const textBlock = result.content.find((c) => c.type === "text");
    const errorMsg = (textBlock?.type === "text" && textBlock.text) || "Operation failed";
    return new Text(theme.fg("error", errorMsg), 0, 0);
  }
  // ... normal rendering
}
```

### Tool Naming

- Third-party API tools: prefix with API name (`linkup_web_search`)
- Internal tools: no prefix (`get_current_time`)

### API Key Pattern

Check for API key before registering tools:

```typescript
export default function (pi: ExtensionAPI) {
  const apiKey = process.env.MY_API_KEY;

  if (!apiKey) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify("MY_API_KEY not set. Tools disabled.", "warning");
    });
    return;
  }

  pi.registerTool(createMyTool(apiKey));
}
```

## Display Methods

| Method | Persistence | Use When |
|--------|-------------|----------|
| `ctx.ui.notify()` | Transient | Quick feedback: "Saved", "API key missing" |
| `ctx.ui.custom()` | Until dismissed | Rich interactive display |
| `pi.sendMessage()` | Session history | Persistent results |

## Reference Files

This skill has detailed reference files for deeper topics:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering (ToolCallHeader/ToolBody/ToolFooter), streaming, multi-action tools |
| `references/modes.md` | Full mode behavior matrix, RPC/Print handling |
| `references/components.md` | TUI component catalog, custom components |
| `references/commands.md` | Command registration, vs tools |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/providers.md` | Provider registration, model definitions |
| `references/structure.md` | Standalone repo structure (for reference) |

## Workflow A: Fork-Based Creation

When the user identifies one or more extension repos as inspiration.

### 1. Identify sources

Ask the user:
- **Primary inspiration**: which extension to fork (repo URL or local path)?
- **Secondary inspirations**: any other extensions to borrow features from?
- **What to keep, add, or change** from each source?

### 2. Clone and verify the primary source

```bash
git clone <repo-url> /tmp/<source-name>
cp -R /tmp/<source-name> extensions/pure-<name>
```

**Test the primary source as-is:**
1. Add to `package.json` manifest: `"./extensions/pure-<name>/index.ts"`
2. Add local path in `.pi/settings.json`: `{"packages": ["../extensions/pure-<name>"]}`
3. Run smoke test and ask user to `/reload` for functional testing.

### 3. Rename to pure-* conventions

Once confirmed working, rename everything:
- Directory: `pure-<name>/`
- Tool name, command, widget ID, message type
- Storage paths to inline helpers

### 4. Strip unnecessary files

- Delete `.git/`, `node_modules/`, lockfiles
- Remove CI configs, `.github/`, test fixtures
- Keep only essential source files (ideally single `index.ts`)

### 5. Add path helpers (inline, self-contained)

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

README must include Sources / Inspiration section.

### 7. Check, format, lint

```bash
biome check --write --unsafe extensions/pure-<name>/
```

### 8. Local testing

**Gate 1 — Smoke test:**
```bash
pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok" 2>&1 | tail -5
```

**Gate 2 — Functional test (user confirms):** `/reload` and test tool/command.

**Gate 3 — Commit checkpoint:** `git add . && git commit`

### 9. Promote (after user approval)

1. Remove local path from `.pi/settings.json`
2. Add to `~/.pi/agent/settings.json`
3. Verify global load with `/reload`
4. `git push`

---

## Workflow B: From-Scratch Creation

### 1. Interview the user

1. What does the extension do?
2. What triggers it? (command, tool, hook, automatic)
3. Does it need persistence?
4. Does it need a UI?
5. Does it need external APIs?

### 2. Design before coding

- Extension name (`pure-<name>`)
- Activation tier: global or local
- What it registers: tool, command, hooks
- Config structure

### 3. Implement

Create `extensions/pure-<name>/index.ts` with inline path helpers, extension entry point, tool/command registrations, TypeBox schemas.

### 4. Create README.md, CHANGELOG.md

### 5. Check, format, lint, test, and promote

Same gates as fork-based workflow.

---

## Updating an Extension

### 1. Find the primary source

Read README.md → Sources / Inspiration section.

### 2. Check upstream for changes

Compare upstream changes against our fork and decide what to cherry-pick, skip, or adapt.

### 3. Make changes

Keep inline path helpers, pure-* naming, project-overrides-global config.

### 4. Check, test, restore activation

- Globally active: move to local, develop, restore
- Locally active: edit directly

---

## Critical Rules

1. **Execute parameter order**: `(toolCallId, params, signal, onUpdate, ctx)` — signal before onUpdate
2. **Always use `onUpdate?.()`**: Optional chaining — parameter can be `undefined`
3. **No `.js` in imports**: Use bare module paths
4. **Mode awareness**: `ctx.ui.custom()` needs RPC fallback — use explicit sentinels for close/cancel
5. **Error detection**: Check for missing expected fields in `details` (framework sets `{}` on throw)
6. **Signal forwarding**: Pass `signal` to all async operations (fetch, `pi.exec()`, API clients)
7. **Never use `child_process`**: Use `pi.exec()` instead
8. **Never use `homedir()`**: Use `getAgentDir()` from `@mariozechner/pi-coding-agent`
9. **Typed param alias**: Define `type MyParams = Static<typeof parameters>` at top of each tool file
10. **Entry point pattern**: load config → check enabled → register
11. **API key gating**: Check before registering tools — notify if missing
12. **Fire-and-forget methods**: `notify`, `setStatus`, etc. don't need `hasUI` check
13. **No unused `_signal`**: Forward or remove — never prefix with `_` if actually used
14. **Check existing components**: Before creating custom TUI, check `pi-tui` or `pi-coding-agent`
15. **Settings UI**: Use `registerSettingsCommand` from `@aliou/pi-utils-settings` when configurable

---

## Checklist

- [ ] Single `index.ts` entry point (split only if unwieldy)
- [ ] Added to root `package.json` `pi.extensions` immediately
- [ ] Inline path helpers (self-contained)
- [ ] Project-overrides-global config resolution (pass `ctx.cwd`)
- [ ] `biome check` passes with zero errors
- [ ] Smoke-tested: `pi -e "$PWD/extensions/pure-<name>" -ne -p "reply with just ok"` exits 0
- [ ] User confirmed functional test
- [ ] README.md with Sources / Inspiration section
- [ ] CHANGELOG.md with initial release entry
- [ ] Local path in `.pi/settings.json` for testing
- [ ] Commit checkpoint before promotion

**Promotion:**
- [ ] Pre-promotion checklist complete
- [ ] Added to `~/.pi/agent/settings.json`
- [ ] Local path removed from `.pi/settings.json`
- [ ] Global load verified with `/reload`
- [ ] Pushed to remote
