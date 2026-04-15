# Pure Cron

A pi extension for scheduling recurring and one-shot agent prompts with cron-like functionality.

## Features

- **Multiple schedule types** — cron expressions (6-field with seconds), ISO timestamps, relative times (`+10s`, `+5m`, `+1h`), and intervals (`5m`, `1h`)
- **Session/project scoping** — jobs can be scoped to a session, project, or global
- **Widget** — live status table below the editor showing all scheduled prompts with next/last run times
- **Interactive command** — `/pure-cron` for managing jobs via UI
- **Persistence** — stored in `~/.pi/agent/pure-cron.json`
- **Auto-cleanup** — disabled one-shot jobs are cleaned up on session switch/shutdown

## Tool: `pure_cron`

The agent can use the `pure_cron` tool directly:

| Action | Required Params | Description |
|--------|----------------|-------------|
| `add` | `schedule`, `prompt` | Create a new scheduled job |
| `list` | — | List jobs (optional `scope`: project/session/all) |
| `remove` | `jobId` | Remove a job |
| `enable` | `jobId` | Enable a disabled job |
| `disable` | `jobId` | Disable a job |
| `update` | `jobId` | Update job fields |
| `cleanup` | — | Remove all disabled jobs |

### Schedule Formats

| Type | Example | Description |
|------|---------|-------------|
| `cron` | `0 */5 * * * *` | Every 5 minutes (6-field with seconds) |
| `once` | `+5m` or ISO timestamp | One-shot, fires once then disables |
| `interval` | `30s`, `5m`, `1h` | Periodic with fixed interval |

## Command: `/cron`

Interactive management with options to view, add, toggle, remove, and clean up jobs.

## Widget

Shows a table with status, name, humanized schedule, prompt preview, next/last run, and run count. Auto-refreshes every 30 seconds.

## Settings

Stored in `~/.pi/agent/settings.json` under `pure.cron`:

```json
{
  "pure": {
    "cron": {
      "widget_show_default": true
    }
  }
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `widget_show_default` | boolean | `true` | Show widget automatically when scheduled jobs exist |

## Installation

Place in the Pi extensions directory:

```
~/.pi/agent/extensions/pure-cron/
└── index.ts
```

Reload with `/reload` or restart Pi.

## Sources / Inspiration

- **[tintinweb/pi-schedule-prompt](https://github.com/tintinweb/pi-schedule-prompt)** — Original extension this was forked from. Provided the core cron scheduling concept, tool design, and widget pattern.
