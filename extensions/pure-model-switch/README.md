# pure-model-switch

Model listing, search, and switching tool for [Pi](https://github.com/badlogic/pi-mono).

Provides a `switch_model` tool the agent can use to list, search, and switch models on demand. Supports aliases with fallback chains.

## Tool

### `switch_model`

| Parameter   | Type     | Description                                                          |
|-------------|----------|----------------------------------------------------------------------|
| `action`    | `list` \| `search` \| `switch` | Action to perform                    |
| `search?`   | `string` | Query for search/switch (matches provider, id, or name)             |
| `provider?` | `string` | Filter to a specific provider                                        |

**Actions:**

- `list` — show all available authenticated models with capabilities, context window, and cost
- `search` — filter models by query
- `switch` — resolve aliases first, then exact or partial model matching

## Aliases

Define aliases in `~/.pi/agent/pure/config/pure-model-switch.json`:

```json
{
  "cheap": "google/gemini-2.5-flash",
  "coding": "anthropic/claude-opus-4-5",
  "budget": ["openai/gpt-5-mini", "google/gemini-2.5-flash"]
}
```

Rules:

- Top-level value must be an object
- Alias names must be non-empty strings
- Each target must be `provider/modelId` format
- String alias: one exact model target
- Array alias: fallback chain — first available authenticated target wins

## Settings

No settings needed. The extension works out of the box. Optionally create the alias config file above.

## Sources / Inspiration

- [pi-model-switch](https://github.com/nicobailon/pi-model-switch) by Nico Bailon — original tool design, alias system, and model matching logic. Forked with permission (MIT).
