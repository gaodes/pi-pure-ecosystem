---
name: pure-model-switch
description: Proactively switch models when user requests faster/cheaper/specialized models. Use when the user asks to change models or requests specific capabilities.
---

# Pure Model Switch

Use this skill to proactively manage model selection based on task requirements.

## Proactive model switching by task type

Always proactively choose the appropriate model based on task complexity and requirements.

### When to use fast models

**Use for**: simple tasks, greetings, small edits, routine operations

| Task indicator | Example | Recommended model |
|---------------|---------|-------------------|
| Short, one-shot request | "Hello", "rename this function" | zai/glm-4.7-flash (fastest free) |
| Code formatting only | `biome check --write` | zai/glm-4.7-flash |
| Quick navigation | "Go to line 42" | zai/glm-4.7-flash |
| File exploration | "List files in src/" | zai/glm-4.7-flash |

**Action pattern**:
```
switch_model with { action: "search", search: "fast" }
[Show user the model, confirm or switch silently]
```

### Workflow

1. **Analyze task complexity** — Is this simple or complex?
2. **Choose appropriate model** — Based on table above
3. **Proactively switch** — Call `switch_model` with action='switch' if recommended model differs from current
4. **Confirm for significant changes** — Only notify user if switching to/from reasoning/vision/capable models

**Silent switches** are fine for:
- Fast model → Fast model (different provider)
- Any model → fast model (always use fast for simple tasks)

**Notify user for**:
- Fast model → Reasoning model (always ask before slowing down)
- Reasoning model → Fast model (only if user explicitly asks)
- Any model → Vision model (special capability)

### When to use reasoning models

**Use for**: architecture decisions, large refactors, complex reasoning, analysis

| Task indicator | Example |
|---------------|---------|
| "How should I refactor..." | Large architectural change |
| "Explain why this pattern is used" | Deep analysis required |
| "Should I use X or Y..." | Complex trade-off decision |
| "Review this entire system" | System-level understanding |
| "Debug this bug thoroughly" | Investigative reasoning |

**Action pattern**:
```
switch_model with { action: "search", search: "reasoning" }
[Show user, ask confirmation before switching]
```

### When to use vision models

**Use for**: images, diagrams, visual code inspection

| Task indicator | Example |
|---------------|---------|
| User uploads an image | "Here's the screenshot..." |
| Task needs visual analysis | "Review this UI design" |
| Code visualization | "Show me the call graph" |

**Action pattern**:
```
switch_model with { action: "search", search: "vision" }
[Show user, ask confirmation before switching]
```

### When to use OpenAI models

**Use for**: when you prefer OpenAI's implementation or specific OpenAI models

**Action pattern**:
```
switch_model with { action: "search", search: "gpt" }
[Show user, ask confirmation before switching]
```

### When to use Claude models

**Use for**: when you prefer Anthropic's implementation or specific Claude models

**Action pattern**:
```
switch_model with { action: "search", search: "sonnet" }
[Show user, ask confirmation before switching]
```

## What NOT to do

- **Don't list all models** (`action: "list"`) unless user explicitly wants to browse
- **Don't ask user to choose** from a full list — use search/filter first
- **Don't switch silently** without confirmation unless:
  - Switching from fast to fast (different provider)
  - Any model → fast model (always use fast for simple tasks)
  - You're changing between fast models for routine operations
- **Don't hesitate** — proactively choose the right model based on task complexity
- **Don't ask for permission** for silent switches to fast models (this is your scope)

## Examples

**Task: Simple file read**
```
User: "Read README.md"

[Read file silently, stay on fast model or switch to fast model]
Output: [File content]
```

**Task: Ask about refactoring**
```
User: "How should I refactor this component?"

[Detect complexity, ask user before switching to reasoning model]
switch_model with { action: "search", search: "reasoning" }

[Show user, get confirmation]

[Switch to reasoning model]
[Answer with deep analysis]
```

**Task: Switch providers silently**
```
User: "Fix this bug"

[Current: zai/glm-4.7-flash | Task: simple bug fix]

switch_model with { action: "switch", search: "gpt" }

[Silent switch to openai-codex/gpt-5.3-codex-spark]

[Fix the bug]
```

**Task: Image analysis**
```
User: "Here's the design mockup..."
[User sends image]

[Detect vision needed, ask user before switching]
switch_model with { action: "search", search: "vision" }

[Show user, get confirmation]

[Switch to vision model]
[Analyze image]
```

**Task: User asks for faster model**
```
User: "This is taking too long, use a faster model"

[Current: reasoning model | Task: simple task detected]

switch_model with { action: "switch", search: "fast" }

[Silent switch to zai/glm-4.7-flash]

Continue with simple task
```
