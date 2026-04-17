# Pi Coding Agent API Reference

> Pi version: 0.67.4 | Last updated: 2026-04-17
>
> Complete reference of utilities, tools, hooks, and APIs available in Pi Coding Agent v0.67.4.

---

## Table of Contents

1. [Packages & Imports](#packages--imports)
2. [ExtensionAPI (`pi`)](#extensionapi-pi)
3. [ExtensionContext (`ctx`)](#extensioncontext-ctx)
4. [ExtensionCommandContext](#extensioncommandcontext)
5. [Events / Hooks](#events--hooks)
6. [Custom Tools](#custom-tools)
7. [Custom UI & TUI Components](#custom-ui--tui-components)
8. [Utility Functions](#utility-functions)
9. [SessionManager API](#sessionmanager-api)
10. [Model Registry](#model-registry)
11. [Keybindings](#keybindings)
12. [Examples Index](#examples-index)

---

## Packages & Imports

| Package | What to import |
|---------|----------------|
| `@mariozechner/pi-coding-agent` | `ExtensionAPI`, `ExtensionContext`, `DynamicBorder`, `CustomEditor`, `isToolCallEventType`, `isBashToolResult`, `SessionManager`, `withFileMutationQueue`, `createLocalBashOperations`, `createReadTool`, `createBashTool`, `highlightCode`, `getLanguageFromPath`, `truncateHead`, `truncateTail`, `truncateLine`, `formatSize`, `keyHint`, `getMarkdownTheme`, `getSettingsListTheme` |
| `@mariozechner/pi-ai` | `complete`, `StringEnum` |
| `@mariozechner/pi-tui` | `Container`, `Text`, `Box`, `Spacer`, `SelectList`, `SettingsList`, `Markdown`, `Image`, `matchesKey`, `Key`, `visibleWidth`, `truncateToWidth`, `wrapTextWithAnsi`, `CURSOR_MARKER` |
| `@sinclair/typebox` | `Type`, `Static` |

---

## ExtensionAPI (`pi`)

### Event Subscription

```typescript
pi.on(eventName, handler)
```

See [Events / Hooks](#events--hooks) for all event names.

### Tool Registration

```typescript
pi.registerTool(definition)
pi.getActiveTools()      // names of currently active tools
pi.getAllTools()         // full tool metadata including sourceInfo
pi.setActiveTools(names) // enable/disable tools at runtime
```

### Commands

```typescript
pi.registerCommand(name, { description, handler, getArgumentCompletions? })
pi.getCommands()         // list all slash commands (extensions, prompts, skills)
```

### Shortcuts & Flags

```typescript
pi.registerShortcut("ctrl+shift+p", { description, handler })
pi.registerFlag("plan", { description, type: "boolean", default: false })
pi.getFlag("--plan")
```

### Messaging

```typescript
pi.sendMessage(message, { deliverAs?: "steer" | "followUp" | "nextTurn", triggerTurn?: boolean })
pi.sendUserMessage(content, { deliverAs?: "steer" | "followUp" })
```

### Session State

```typescript
pi.appendEntry("my-ext", { count: 42 })       // persist extension state (no LLM context)
pi.setSessionName("Refactor auth")            // display name in /resume
pi.getSessionName()
pi.setLabel(entryId, "checkpoint")            // bookmark for /tree
```

### Model Control

```typescript
pi.setModel(model)           // returns false if no API key
pi.getThinkingLevel()        // "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
pi.setThinkingLevel("high")
```

### Providers

```typescript
pi.registerProvider(name, config)
pi.unregisterProvider(name)
```

### Execution

```typescript
const result = await pi.exec("git", ["status"], { signal?, timeout?, cwd? })
// result.stdout, result.stderr, result.code, result.killed
```

### Inter-Extension Events

```typescript
pi.events.on("my:event", (data) => { ... })
pi.events.emit("my:event", { ... })
```

### Custom Renderers

```typescript
pi.registerMessageRenderer("my-ext", (message, options, theme) => { ... })
```

---

## ExtensionContext (`ctx`)

### Properties

| Property | Description |
|----------|-------------|
| `ctx.ui` | User interaction methods (dialogs, widgets, custom components) |
| `ctx.hasUI` | `false` in print/JSON mode; `true` in interactive/RPC |
| `ctx.cwd` | Current working directory |
| `ctx.sessionManager` | Read-only session state access |
| `ctx.modelRegistry` | Available models & providers |
| `ctx.model` | Currently selected model |
| `ctx.signal` | AbortSignal for the active turn (use for `fetch`, etc.) |

### Methods

```typescript
ctx.isIdle()
ctx.abort()
ctx.hasPendingMessages()
ctx.shutdown()                              // graceful shutdown
ctx.getContextUsage()                       // current token usage estimate
ctx.getSystemPrompt()                       // effective system prompt for this turn

ctx.compact({
  customInstructions?: string,
  onComplete?: (result) => void,
  onError?: (error) => void,
})
```

### UI Methods

```typescript
await ctx.ui.select("Pick:", ["A", "B", "C"])
await ctx.ui.confirm("Delete?", "This cannot be undone", { timeout?: number, signal?: AbortSignal })
await ctx.ui.input("Name:", "placeholder")
await ctx.ui.editor("Edit:", "prefilled")
ctx.ui.notify("Done!", "info" | "warning" | "error")

ctx.ui.setStatus("my-ext", "Processing...")
ctx.ui.setStatus("my-ext", undefined)       // clear

ctx.ui.setWorkingMessage("Thinking...")
ctx.ui.setWorkingMessage()                  // restore default

ctx.ui.setWidget("id", ["Line 1", "Line 2"], { placement?: "aboveEditor" | "belowEditor" })
ctx.ui.setWidget("id", (tui, theme) => component)
ctx.ui.setWidget("id", undefined)           // clear

ctx.ui.setFooter((tui, theme, footerData) => ({ render(width), invalidate(), dispose? }))
ctx.ui.setFooter(undefined)                 // restore default

ctx.ui.setTitle("pi - my-project")
ctx.ui.setEditorText("prefill")
ctx.ui.getEditorText()
ctx.ui.pasteToEditor("text")

ctx.ui.setToolsExpanded(true)
ctx.ui.getToolsExpanded()

ctx.ui.setEditorComponent((tui, theme, keybindings) => new CustomEditor(...))
ctx.ui.setEditorComponent(undefined)

ctx.ui.setTheme("catppuccin-latte")         // or pass Theme object
ctx.ui.getAllThemes()
ctx.ui.getTheme("light")
ctx.ui.theme.fg("accent", "text")

// Custom component takeover
const result = await ctx.ui.custom<T>((tui, theme, keybindings, done) => {
  return component;
}, { overlay?: boolean, overlayOptions?: {...}, onHandle?: (handle) => void })
```

---

## ExtensionCommandContext

Extends `ExtensionContext` with session control methods (commands only).

```typescript
await ctx.waitForIdle()
const result = await ctx.newSession({ parentSession?, setup? })
const result = await ctx.fork(entryId)
const result = await ctx.navigateTree(targetId, { summarize?, customInstructions?, replaceInstructions?, label? })
const result = await ctx.switchSession(sessionPath)
await ctx.reload()
```

Static discovery:

```typescript
import { SessionManager } from "@mariozechner/pi-coding-agent";
const sessions = await SessionManager.list(cwd);
const all = await SessionManager.listAll();
```

---

## Events / Hooks

### Resource Events

| Event | Return | Description |
|-------|--------|-------------|
| `resources_discover` | `{ skillPaths?, promptPaths?, themePaths? }` | Contribute resources after startup/reload |

### Session Events

| Event | Return | Description |
|-------|--------|-------------|
| `session_start` | — | Session startup, new, resume, fork, reload |
| `session_shutdown` | — | Cleanup on exit/switch/fork |
| `session_before_switch` | `{ cancel?: true }` | Before `/new` or `/resume` |
| `session_before_fork` | `{ cancel?: true, skipConversationRestore?: true }` | Before `/fork` |
| `session_before_compact` | `{ cancel?: true, compaction?: {...} }` | Before compaction |
| `session_compact` | — | After compaction |
| `session_before_tree` | `{ cancel?: true, summary? }` | Before `/tree` branch |
| `session_tree` | — | After `/tree` navigation |

### Agent Events

| Event | Return | Description |
|-------|--------|-------------|
| `before_agent_start` | `{ message?, systemPrompt? }` | Inject message or modify system prompt |
| `agent_start` | — | User prompt begins |
| `agent_end` | — | Turn + all tool calls finished |
| `turn_start` | — | New LLM turn begins |
| `turn_end` | — | Turn finished |
| `message_start` | — | Any message begins |
| `message_update` | — | Assistant streaming token |
| `message_end` | — | Message finished |
| `context` | `{ messages }` | Modify LLM message list |
| `before_provider_request` | `payload \| undefined` | Inspect/replace provider payload |
| `after_provider_response` | — | *(v0.67.4)* Inspect HTTP status/headers after response, before stream |

### Tool Events

| Event | Return | Description |
|-------|--------|-------------|
| `tool_execution_start` | — | Tool call preflighted |
| `tool_call` | `{ block?: true, reason?: string }` | Block or mutate tool args |
| `tool_execution_update` | — | Streaming partial result |
| `tool_result` | `{ content?, details?, isError? }` | Modify final result |
| `tool_execution_end` | — | Tool call fully finished |

### Input Events

| Event | Return | Description |
|-------|--------|-------------|
| `input` | `{ action: "continue" \| "transform" \| "handled", text?, images? }` | Intercept/transform raw user input |
| `user_bash` | `{ operations?, result? }` | Intercept `!` / `!!` commands |
| `model_select` | — | Model changed via `/model`, `Ctrl+P`, or restore |

---

## Custom Tools

### Full Definition

```typescript
pi.registerTool({
  name: "my_tool",
  label: "My Tool",
  description: "...",
  promptSnippet: "One-line prompt hint",
  promptGuidelines: ["Use when..."],
  parameters: Type.Object({ ... }),

  prepareArguments(args) {
    // Compatibility shim before validation
    return args;
  },

  async execute(toolCallId, params, signal, onUpdate, ctx) {
    onUpdate?.({ content: [{ type: "text", text: "Working..." }] });
    return {
      content: [{ type: "text", text: "Done" }],
      details: { ... },
    };
  },

  renderCall(args, theme, context) { ... },
  renderResult(result, options, theme, context) { ... },
  renderShell: "self", // optional: own the outer box
});
```

### Typing Helpers

```typescript
import { isToolCallEventType, isBashToolResult } from "@mariozechner/pi-coding-agent";

pi.on("tool_call", (event) => {
  if (isToolCallEventType("bash", event)) {
    event.input.command; // typed
  }
});

pi.on("tool_result", (event) => {
  if (isBashToolResult(event)) {
    event.details; // BashToolDetails
  }
});
```

### File Mutation Queue

Use when a custom tool mutates files that built-in tools may also touch:

```typescript
import { withFileMutationQueue } from "@mariozechner/pi-coding-agent";

return withFileMutationQueue(absolutePath, async () => {
  // read-modify-write
});
```

### Output Truncation

```typescript
import {
  truncateHead,
  truncateTail,
  truncateLine,
  formatSize,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";
```

### Remote / Custom Operations

```typescript
import {
  createReadTool, createBashTool,
  createLocalBashOperations,
  type ReadOperations, BashOperations, // etc.
} from "@mariozechner/pi-coding-agent";

const bash = createBashTool(cwd, {
  spawnHook: ({ command, cwd, env }) => ({ command, cwd, env }),
});
```

---

## Custom UI & TUI Components

### Built-in Components

```typescript
import {
  Text, Box, Container, Spacer, Markdown, Image,
  SelectList, SettingsList,
  matchesKey, Key,
  visibleWidth, truncateToWidth, wrapTextWithAnsi,
  CURSOR_MARKER,
} from "@mariozechner/pi-tui";
```

### From Pi Coding Agent

```typescript
import {
  DynamicBorder,           // runtime import only
  BorderedLoader,
  getMarkdownTheme,
  getSettingsListTheme,
  keyHint, keyText, rawKeyHint,
  CustomEditor,
} from "@mariozechner/pi-coding-agent";
```

### Theme Colors

Foreground: `text`, `accent`, `muted`, `dim`, `success`, `error`, `warning`, `border`, `borderAccent`, `borderMuted`, `userMessageText`, `customMessageText`, `customMessageLabel`, `toolTitle`, `toolOutput`, `toolDiffAdded`, `toolDiffRemoved`, `toolDiffContext`, `mdHeading`, `mdLink`, `mdLinkUrl`, `mdCode`, `mdCodeBlock`, `mdCodeBlockBorder`, `mdQuote`, `mdQuoteBorder`, `mdHr`, `mdListBullet`, `syntaxComment`, `syntaxKeyword`, `syntaxFunction`, `syntaxVariable`, `syntaxString`, `syntaxNumber`, `syntaxType`, `syntaxOperator`, `syntaxPunctuation`, `thinkingOff`, `thinkingMinimal`, `thinkingLow`, `thinkingMedium`, `thinkingHigh`, `thinkingXhigh`, `bashMode`.

Background: `selectedBg`, `userMessageBg`, `customMessageBg`, `toolPendingBg`, `toolSuccessBg`, `toolErrorBg`.

### Focusable (IME Support)

```typescript
import { CURSOR_MARKER, type Focusable } from "@mariozechner/pi-tui";

class MyInput implements Component, Focusable {
  focused = false;
  render(width) {
    return [`> ${beforeCursor}${CURSOR_MARKER}\x1b[7m${atCursor}\x1b[27m${afterCursor}`];
  }
}
```

---

## Utility Functions

### Syntax Highlighting

```typescript
import { highlightCode, getLanguageFromPath } from "@mariozechner/pi-coding-agent";

const lang = getLanguageFromPath("/path/to/file.rs"); // "rust"
const highlighted = highlightCode(code, lang, theme);
```

### AI Completion

```typescript
import { complete } from "@mariozechner/pi-ai";

const response = await complete(model, { messages }, { apiKey, maxTokens });
// Check response.error — does NOT throw
```

### TypeBox String Enum (Google-compatible)

```typescript
import { StringEnum } from "@mariozechner/pi-ai";

Type.Object({
  action: StringEnum(["list", "add"] as const),
});
```

---

## SessionManager API

### Static Methods

```typescript
SessionManager.create(cwd, sessionDir?)
SessionManager.open(path, sessionDir?)
SessionManager.continueRecent(cwd, sessionDir?)
SessionManager.inMemory(cwd?)
SessionManager.forkFrom(sourcePath, targetCwd, sessionDir?)
SessionManager.list(cwd, sessionDir?, onProgress?)
SessionManager.listAll(onProgress?)
```

### Instance Methods

```typescript
// Append
appendMessage(message)
appendThinkingLevelChange(level)
appendModelChange(provider, modelId)
appendCompaction(summary, firstKeptEntryId, tokensBefore, details?, fromHook?)
appendCustomEntry(customType, data?)
appendSessionInfo(name)
appendCustomMessageEntry(customType, content, display, details?)
appendLabelChange(targetId, label)

// Navigation
getLeafId()
getLeafEntry()
getEntry(id)
getBranch(fromId?)
getTree()
getChildren(parentId)
getLabel(id)
branch(entryId)
resetLeaf()
branchWithSummary(entryId, summary, details?, fromHook?)

// Info
buildSessionContext()
getEntries()
getHeader()
getSessionName()
getCwd()
getSessionDir()
getSessionId()
getSessionFile()
isPersisted()
newSession(options?)
setSessionFile(path)
createBranchedSession(leafId)
```

---

## Model Registry

```typescript
ctx.modelRegistry.find(providerId, modelId)
ctx.modelRegistry.getProviders()
```

Custom provider config shape:

```typescript
pi.registerProvider("my-proxy", {
  baseUrl: "https://proxy.example.com",
  apiKey: "ENV_VAR_NAME", // or literal string
  api: "anthropic-messages", // | "openai-completions" | "openai-responses" | ...
  headers?: Record<string, string>,
  authHeader?: boolean,
  models: [{
    id: "...",
    name: "...",
    reasoning: boolean,
    input: ["text", "image"],
    cost: { input, output, cacheRead, cacheWrite },
    contextWindow: number,
    maxTokens: number,
  }],
  oauth?: { name, login(callbacks), refreshToken(credentials), getApiKey(credentials) },
  streamSimple?: boolean,
});
```

---

## Keybindings

Keybinding namespaces:

- `app.*` — coding-agent specific, e.g. `app.tools.expand`, `app.editor.external`, `app.session.rename`
- `tui.*` — shared TUI, e.g. `tui.select.confirm`, `tui.select.cancel`, `tui.select.up`, `tui.select.down`

Helpers:

```typescript
import { keyHint, keyText, rawKeyHint } from "@mariozechner/pi-coding-agent";

keyHint("app.tools.expand", "to expand")
keyText("tui.select.confirm")
rawKeyHint("ctrl+k", "to do something")
```

Keyboard matching:

```typescript
import { matchesKey, Key } from "@mariozechner/pi-tui";

matchesKey(data, Key.up)
matchesKey(data, Key.ctrl("c"))
matchesKey(data, Key.shift("tab"))
matchesKey(data, Key.ctrlShift("p"))
matchesKey(data, "enter")
```

---

## Examples Index

All built-in examples live in the Pi package at `examples/extensions/`.

| Category | Example | Key APIs |
|----------|---------|----------|
| **Tools** | `hello.ts` | `registerTool` |
| | `question.ts` | Tool + `ui.select` |
| | `questionnaire.ts` | Multi-step wizard |
| | `todo.ts` | Stateful + `appendEntry` + `renderResult` |
| | `dynamic-tools.ts` | Runtime tool registration |
| | `truncated-tool.ts` | `truncateHead` utilities |
| | `tool-override.ts` | Override built-in tools |
| **Commands** | `pirate.ts` | `before_agent_start` prompt mod |
| | `summarize.ts` | `ui.custom` dialog |
| | `handoff.ts` | `ui.editor`, cross-provider |
| | `send-user-message.ts` | `sendUserMessage` |
| | `reload-runtime.ts` | `ctx.reload()` |
| | `shutdown-command.ts` | `ctx.shutdown()` |
| **Events** | `permission-gate.ts` | `tool_call` blocking |
| | `input-transform.ts` | `input` event transform |
| | `model-status.ts` | `model_select` + `setStatus` |
| | `provider-payload.ts` | `before_provider_request` |
| **UI** | `plan-mode/` | Full plan mode (all APIs) |
| | `preset.ts` | Saveable model/tool presets |
| | `tools.ts` | `SettingsList` toggles |
| | `custom-footer.ts` | `setFooter` |
| | `widget-placement.ts` | `setWidget` |
| | `modal-editor.ts` | `CustomEditor` vim mode |
| | `overlay-qa-tests.ts` | Overlays & positioning |
| | `snake.ts` | Game loop + keyboard |
| **Remote** | `ssh.ts` | Tool operations + `user_bash` |
| **Providers** | `custom-provider-anthropic/` | `registerProvider` |
| | `custom-provider-gitlab-duo/` | OAuth provider |

---

## Version Discovery

For the latest Pi version and changelog, use the `pure-utils` tools:
- `pi_version` — get the installed Pi version
- `pi_changelog` — get changelog entry for a specific version
- `pi_changelog_versions` — list all available versions

For Pi documentation files (README, docs/, examples/), use `pi_docs`.

---

*Last updated: 2026-04-16*
