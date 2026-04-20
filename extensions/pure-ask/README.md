# pure-ask

Native Ask User questionnaire extension for [Pi](https://github.com/badlogic/pi-mono).

Provides a first-class `ask_user` tool the agent can call to collect one or more structured answers from the user directly inside Pi's terminal UI.

## Tool

### `ask_user`

| Parameter | Type | Description |
|---|---|---|
| `title?` | `string` | Optional questionnaire title |
| `description?` | `string` | Optional questionnaire description/context |
| `timeout?` | `number` | Auto-cancel after N milliseconds |
| `questions` | `Question[]` | One or more questions to ask |

### Question

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique question id |
| `label?` | `string` | Short label for the tab row |
| `type` | `single \| multi \| text \| boolean` | Question type |
| `prompt` | `string` | The user-facing question text |
| `description?` | `string` | Optional context/help text |
| `options?` | `Option[]` | Options for `single` and `multi` |
| `allowOther?` | `boolean` | Allow a custom typed answer |
| `required?` | `boolean` | Require an answer before submit |
| `placeholder?` | `string` | Placeholder for text questions |
| `default?` | `string \| string[]` | Default answer(s) |
| `recommended?` | `string \| string[]` | Recommended value(s), shown visually |

## Commands

- `/ask` — with no args, opens a demo questionnaire; with args, asks a single text question
- `/ask-demo` — opens the demo questionnaire explicitly

## Notes

- Uses native Pi terminal UI only
- Uses plain `ctx.ui.custom()` and deliberately avoids overlay mode
- Includes a sequential RPC/dialog fallback when custom TUI is unavailable
- This is the initial v1 skeleton and foundation for the fuller roadmap in `PLAN.md`

## Sources / Inspiration

- [pi-mono-extensions / ask-user-question](https://github.com/emanuelcasco/pi-mono-extensions/tree/main/extensions/ask-user-question) — primary architectural baseline
- [pi-extension / ask-user-question](https://github.com/Jonghakseo/pi-extension/tree/main/packages/ask-user-question) — related implementation and testing reference
- [pi-ask-tool](https://github.com/devkade/pi-ask-tool) — tabbed questionnaire UX and result formatting ideas
- [pi-ask-user](https://github.com/edlsh/pi-ask-user) — polished ask-user interaction patterns, timeout, and fallback ideas
- [pi-ask](https://github.com/AlvaroRausell/pi-ask) — product framing and future `/ask` workflow inspiration
