# pure-ask — source analysis and implementation plan

## Goal

Build a **first-class, native Pi questionnaire extension** that lets the agent ask the user one or more structured questions **inside Pi's terminal UI**.

This should be:

- **tool-first** — the model can call it directly
- **questionnaire-capable** — one or many questions in a single flow
- **structured** — single choice, multi choice, and text answers
- **native to Pi** — no browser tab, no WKWebView, no local web server
- **first-class Pi citizen** — typed schema, clean renderers, graceful fallback, session-safe details

---

## Hard requirements distilled from your request

1. The **agent** must be able to ask the user questions directly.
2. It must support **multiple questions** in one interaction.
3. It must support **multiple answers / multiple choice**.
4. It must feel **native to Pi**, not like an external app.
5. It should align with our repo philosophy:
   - simplicity first
   - Pi APIs first
   - terminal-aware
   - first-class extension quality

---

## Primary source selection

## **Main inspiration: `ask-user-question`**

Use **`emanuelcasco/pi-mono-extensions` → `extensions/ask-user-question`** as the **main source of inspiration**.

Why this is the best fit:

- it is already **native Pi TUI**
- it is **tool-first**
- it supports **one or more questions** in a single call
- it supports **radio / checkbox / text** question types
- it returns **structured data**
- it explicitly encourages the model to use the tool instead of plain-text questioning
- it is conceptually the closest match to your stated requirement: a **complete ask tool for the agent**

This is the clearest baseline for `pure-ask`.

### Why not make `pi-ask` the main source?

`AlvaroRausell/pi-ask` has an excellent **user flow** and strong product framing, but its core flow depends on a **secondary LLM call** that converts raw assistant text into questionnaire JSON.

That is useful, but it should be a **future adapter**, not the foundation.

For `pure-ask`, the core should be:

- deterministic
- typed
- model-independent
- not dependent on a hidden extra model hop

So:

- **main architecture** → `ask-user-question`
- **UX/polish inspiration** → `pi-ask`

---

## Source-by-source analysis

### 1. `emanuelcasco/pi-mono-extensions` → `ask-user-question`
**Verdict:** best baseline

**What it gets right**
- Native Pi panel UI
- Typed schema
- Multiple questions in one form
- Mixed question types: `radio`, `checkbox`, `text`
- `allowOther`, `required`, `default`, `placeholder`
- Submit/review tab for multi-question flows
- Good prompt guidance for the model
- Structured `details` result and custom rendering

**What to borrow**
- Overall schema shape
- Multi-question tabbed workflow
- Mixed control types
- Submit tab + review summary
- Model prompt guidelines

**What to improve in `pure-ask`**
- Better context/description rendering
- Stronger validation and normalized output
- More polished fallback behavior
- Search/filter for large single-select lists
- More compact, theme-aware rendering

---

### 2. `Jonghakseo/pi-extension` → `packages/ask-user-question`
**Verdict:** same family, useful secondary reference

This appears to be a closely related implementation with the same core idea:

- form-based questionnaire
- `radio`, `checkbox`, `text`
- grouped questions in one call
- structured answers
- tests across controller/state/view/rendering

**What to borrow**
- Modular decomposition ideas if `index.ts` grows too large
- Test surface: controller/state/view/output separation
- Confidence that this schema family is a strong fit

**Use it for**
- implementation sanity checks
- test planning
- alternative rendering/state patterns

---

### 3. `devkade/pi-ask-tool`
**Verdict:** strongest UX source after the main baseline

**What it gets right**
- Pure native Pi extension
- Tool-first design
- Multi-question tab flow
- Markdown/plain-text context per question
- Custom answers via automatic `Other`
- Recommended option support
- Strong tests
- Clear result formatting

**What to borrow**
- Per-question `description` / context block
- Better review/summary formatting
- Recommended option support
- Inline-note concept as an optional future enhancement

**What not to copy directly**
- Its schema is narrower than we want for `pure-ask` because it focuses mostly on option-based questions

---

### 4. `edlsh/pi-ask-user`
**Verdict:** best source for polish on single-question UX and fallback behavior

**What it gets right**
- Very polished single-question selection UI
- Search/filter support
- Split-pane preview/details on wide terminals
- Optional freeform answer
- Optional extra comment
- Timeout support
- Strong custom renderers
- RPC/dialog fallback when `ctx.ui.custom()` is unavailable
- Bundled skill for decision-gating

**What to borrow**
- Searchable single-select UX
- Optional `comment` support
- `timeout` behavior
- RPC fallback via `select()` / `input()`
- Structured `details` output shape
- Skill packaging pattern

**Critical caveat**
It uses **overlay mode**. For `pure-ask`, we should **not** adopt overlay mode.

Based on local Pi experience:
- overlay mode has been unstable
- plain `ctx.ui.custom()` is the safer pattern

So we borrow the UX ideas, **not** the overlay transport.

---

### 5. `AlvaroRausell/pi-ask`
**Verdict:** excellent product inspiration, not the core architecture

**What it gets right**
- Strong “agent asks user a questionnaire” framing
- Model-facing tool + manual `/ask` command
- Tabbed questionnaire UI
- Good multi-question clarification workflow
- Good answer summary + editor handoff

**What to borrow**
- `/ask` manual command
- `ask_questions` naming direction
- Optional future “convert latest assistant message into a questionnaire” helper
- Good clarification-oriented product language

**What not to use as core**
- hidden extra model call for parsing assistant text into JSON
- separate model configuration as the foundation of the extension

That adapter is valuable, but it should be **v2+**, not v1.

---

### 6. `dreki-gg/pi-extensions` → `questionnaire`
**Verdict:** very useful validation/output reference

**What it gets right**
- clean validation rules
- normalized output schema
- concise result summaries
- explicit cancel handling
- tool-first questionnaire framing

**What to borrow**
- validation rules
- normalized answer model
- render-call / render-result compactness
- explicit `cancelled` semantics without treating cancel as an error

---

### 7. `egornomic/pi-branch-ask`
**Verdict:** strong future feature source

**What it gets right**
- conditional branching
- DAG validation
- next-question logic
- path-aware question flow

**What to borrow**
- future branching schema ideas
- graph validation ideas
- per-answer routing concepts

**What not to put in v1**
- full branching graph support

It is powerful, but too much complexity for the first implementation.

---

### 8. `juicesharp/rpiv-mono` → `rpiv-ask-user-question`
**Verdict:** useful minimal baseline

**What it gets right**
- clear core purpose
- simple structured selection tool
- “Other” fallback

**Use it for**
- minimalism check
- making sure `pure-ask` does not become overbuilt

---

### 9. `pi-ask-user-question` (npm)
**Verdict:** minimal compatibility reference

This package is small and conceptually useful, but too limited for our target.

**Takeaway**
- The “ask one question mid-run” concept is valid
- But `pure-ask` should go beyond that into a complete questionnaire tool

---

### 10. `@hyperprior/pi-ask`
**Verdict:** too minimal to drive the design

The package metadata suggests a structured ask tool, but there is not enough public detail to justify using it as the main model.

**Takeaway**
- confirms demand exists
- not a primary design reference

---

### 11. `pi-copilot-queue`
**Verdict:** not a product match, but has one useful systems idea

This is really a **queued-response workflow** for Copilot-like loops, not a native questionnaire product.

**What to borrow later, if needed**
- queueing / deferred-answer concepts
- provider-specific behavior ideas

**Not relevant to v1 core**

---

### 12. `shantanugoel/pi-ask-me`
**Verdict:** interesting advanced future direction

**What it gets right**
- branch to a side conversation when the user is unsure
- resume questionnaire later
- summarize branch back into answer/context

**What to borrow later**
- pause/resume state model
- uncertain-user workflows

**Not v1**
- too advanced for the initial extension

---

### 13. `nicobailon/pi-interview-tool`
**Verdict:** explicitly rejected for `pure-ask`

This one is feature-rich, but it opens:
- a native WKWebView window on macOS
- or a browser tab elsewhere

That violates the desired direction.

**Why reject it**
- not truly native to Pi terminal UX
- uses an external surface
- heavier architecture than we want
- drifts away from our philosophy

We should borrow **none of its browser/server architecture**.

---

## Design decision

## Product direction for `pure-ask`

`pure-ask` should be a **native Pi questionnaire extension** built around a **typed multi-question form tool**, not around a web UI and not around a hidden parser model.

### Recommended v1 surface

- **Tool name:** `ask_user`
- **Tool label:** `Ask User`
- **Command:** `/ask`
- **Optional demo/test command:** `/ask-demo`

Why `ask_user` / `Ask User`:
- it matches the product goal directly: the **agent asks the user**
- it is the clearest possible mental model for both user and model
- it aligns with the wider Pi ecosystem naming language users already recognize
- it gives `pure-ask` a first-class, canonical identity inside the Pure Ecosystem

### Naming policy

`pure-ask` should treat `ask_user` as the **canonical tool identifier** and `Ask User` as the **display label**.

That means:

- the extension should assume it is the primary ask capability in the Pure Ecosystem
- do **not** double-load another package that also registers `ask_user`
- if compatibility aliases are ever added later, `ask_user` still remains the primary interface

This is a deliberate tradeoff: we prefer a first-class, ecosystem-native name over a collision-avoiding but weaker name.
---

## Proposed v1 schema

```ts
{
  title?: string,
  description?: string,
  timeout?: number,
  questions: Array<{
    id: string,
    label?: string,
    type: "single" | "multi" | "text" | "boolean",
    prompt: string,
    description?: string,
    options?: Array<{
      value: string,
      label: string,
      description?: string,
    }>,
    allowOther?: boolean,
    required?: boolean,
    default?: string | string[],
    recommended?: string | string[],
    allowComment?: boolean,
    placeholder?: string,
  }>
}
```

### Notes

- `boolean` is sugar for a single-select yes/no question.
- `description` should accept Markdown/plain text.
- `allowComment` is optional and can be implemented after the core flow works.
- `recommended` should be visual only in v1 unless preselection proves ergonomically safe.

---

## Output shape

Return both:

1. **Human-readable summary** for the transcript
2. **Structured `details`** for renderers and future state reconstruction

Example:

```ts
{
  cancelled: false,
  title?: string,
  questions: [...normalizedQuestions],
  answers: [
    {
      id: "database",
      type: "single",
      values: ["postgres"],
      labels: ["PostgreSQL"],
      comment?: "Need strong relational integrity",
      wasCustom: false,
      asked: true,
    }
  ]
}
```

---

## UI architecture

## Core UI choice

Use **plain `ctx.ui.custom()`**, not overlay mode.

### Why

- overlay mode has been unstable in Pi
- non-overlay custom UI is safer
- aligns with our Pi-native philosophy

## Rendering approach

Use a **custom full-panel TUI flow** with:

- title / description header
- tab row for questions
- current question panel
- optional review/submit tab
- footer help row

### Avoid

- browser tabs
- web servers
- Glimpse / WKWebView
- overlay mode

### Prefer

- direct Pi TUI primitives
- stable line counts where possible
- compact `Text(..., 1, 0)` usage to avoid accidental blank spacing

### Important local Pi constraints

- avoid overlay mode
- be careful with list rendering because some Pi TUI list patterns can ghost
- prefer stable rendering patterns over flashy UI

---

## Feature plan

## Phase 1 — core foundation

Build the simplest useful native questionnaire:

- `ask_user` tool with display label `Ask User`
- `/ask` command for manual testing
- question types: `single`, `multi`, `text`, `boolean`
- `allowOther`
- `required`
- submit/review tab for multi-question flows
- structured `details`
- custom `renderCall` and `renderResult`
- non-interactive fallback error result

### Implementation preference

Start with a **single `index.ts`**.
Only split once the UI/state logic becomes hard to reason about.

---

## Phase 2 — polish

Add the strongest ideas from the secondary sources:

- Markdown/plain-text `description`
- optional `recommended` highlighting
- timeout support
- RPC fallback via `ctx.ui.select()` / `ctx.ui.input()`
- optional comment capture
- compact expanded/collapsed result rendering
- improved validation and clearer error messages
- better theme-aware spacing and width handling
- safer non-overlay rendering patterns for Pi TUI stability

---

## Phase 3 — agent ergonomics

Make the extension easier for the model to use well:

- strong `promptSnippet`
- strong `promptGuidelines`
- optional bundled skill encouraging the tool for ambiguity/decision gathering
- `/ask-demo` command
- maybe `/ask-last` or `/ask-from-message` helper for manual flows
- result summaries tuned so the next assistant turn can immediately use the answers
- context helpers that encourage one focused questionnaire instead of many fragmented asks

---

## Phase 4 — advanced features

Only after v1 is solid:

- conditional branching / DAG question flow
- pause/resume questionnaire state
- searchable single-select for large option sets
- split-pane details preview
- optional “convert latest assistant question block into schema” adapter
- optional queue integration for long-running workflows
- editable review screen that lets the user jump back to any answer before submit

---

## Phase 5 — further improvements roadmap

These are the most promising upgrades after the core tool is proven stable.

### Questionnaire intelligence
- optional parser helper that turns a plain assistant question block into `ask_user` schema
- cheap-model or heuristic schema generation as an **optional helper**, never a required core dependency
- answer-dependent defaults and smarter preselection
- grouped questionnaires assembled automatically from multiple pending clarifications

### Richer question types
- `rank` / priority ordering
- `scale` / confidence slider-style discrete choices
- `confirm` / destructive-action confirmation variant
- `info` / read-only context panels inside the questionnaire
- per-question attachments or pasted images only if Pi-native handling stays simple

### Better flow control
- conditional visibility (`show this only if Q1 = yes`)
- required-if rules
- per-question validation rules
- skip logic and end-early paths
- reusable branch graph validation if branching is introduced

### Better answer quality
- optional comment per answer, not only per questionnaire
- custom freeform fallback for multi-select
- answer normalization helpers (`yes/no`, environment names, casing cleanup)
- explicit uncertainty answers like `not sure` / `need more context`

### Better UI/UX
- searchable large option lists
- responsive narrow/wide layouts
- preview pane for long descriptions
- keyboard hints that adapt to current mode
- improved review tab with edit shortcuts
- better support for long markdown/context blocks

### Better resilience
- resume after reload or interrupted session
- persist in-progress questionnaire state in custom session entries
- clearer timeout and cancellation semantics
- guardrails for tool collisions if another ask package is present

### Better ecosystem fit
- bundled skill that teaches when to call `ask_user`
- prompt template for manual `/ask` construction
- project/global settings for defaults
- clean package manifest and publish-ready documentation
- compatibility notes for teams that already use another `ask_user` package

### Better developer experience
- demo fixtures for common questionnaire patterns
- isolated smoke tests plus focused functional tests
- helper utilities for normalization/validation if the file grows too large
- internal extension events such as `ask_user:answered` and `ask_user:cancelled` if they prove useful
- publish checklist once the tool is production-ready

---

## Explicit anti-goals for v1

Do **not** build any of these in the first version:

- browser-based forms
- local HTTP server
- WKWebView / Glimpse window
- hidden parser LLM as required core behavior
- branching graph logic
- side-chat branches
- heavy dependency graph

---

## Recommended implementation order

1. Define schema and normalized internal types for `ask_user`
2. Implement single-question `single` flow
3. Add `multi`
4. Add `text`
5. Add multi-question tabs + submit tab
6. Add `allowOther`
7. Add `renderCall` / `renderResult`
8. Add `/ask`
9. Add validation
10. Add RPC fallback and timeout
11. Add polish features
12. Add future-facing hooks so advanced features can be layered in without rewriting the core

---

## Testing plan

### Smoke test

Use isolated extension loading:

```bash
pi -e "$PWD/extensions/pure-ask" -ne -p "reply with just ok" 2>&1 | tail -5
```

### Functional checks

- single question / single select
- single question / multi select
- single question / text
- multi-question mixed form
- required-field blocking
- custom `Other` input
- cancel flow
- RPC/dialog fallback
- renderCall / renderResult collapsed + expanded

### Quality checks

```bash
biome check --write --unsafe extensions/pure-ask/
```

---

## Final recommendation

Build `pure-ask` as:

- a canonical **`ask_user` / `Ask User`** tool for the Pure Ecosystem
- **mainly inspired by** `ask-user-question`
- **polished with ideas from** `pi-ask-tool`, `pi-ask-user`, `pi-ask`, `questionnaire`, and `pi-branch-ask`
- **explicitly rejecting** the browser/window/server model from `pi-interview-tool`

In short:

> **Use `ask-user-question` as the architectural base, ship `ask_user` as the canonical first-class tool name, borrow UX/polish from `pi-ask-tool` and `pi-ask-user`, and keep `pi-ask` as an optional future adapter layer rather than the core.**
