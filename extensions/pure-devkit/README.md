# pure-devkit

Tools, commands, and skills for developing Pi extensions. Forked from [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) and adapted for the pure-ecosystem.

## Tools

| Tool | Description |
|------|-------------|
| `pi_docs` | List Pi markdown documentation files |
| `pi_version` | Get the version of the currently running Pi instance |
| `pi_changelog` | Get changelog entry for a Pi version |
| `pi_changelog_versions` | List all available Pi changelog versions |
| `detect_package_manager` | Detect the package manager used |

## Commands

| Command | Description |
|---------|-------------|
| `/devkit [VERSION]` | Guided workflow to update Pi extensions |

## Skills

| Skill | Description |
|-------|-------------|
| `create-pure-extension` | Build a new extension from scratch |
| `import-pure-extension` | Import/fork an external extension |
| `update-pure-extension` | Sync with upstream sources |
| `enhance-pure-extension` | Add features or fix bugs |
| `demo-setup` | Set up demo environments |

## When to Use Each Skill

| Request | Use |
|----------|-----|
| Build something new from scratch | `create-pure-extension` |
| Fork an existing external extension | `import-pure-extension` |
| Sync with upstream changes | `update-pure-extension` |
| Modify an extension we own | `enhance-pure-extension` |

## Reference Files

All skills share detailed reference files:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print) |
| `references/components.md` | TUI components catalog |
| `references/commands.md` | Command registration |
| `references/messages.md` | sendMessage, notify |
| `references/hooks.md` | Event handlers |
| `references/providers.md` | Provider registration |

Additionally, see [`docs/api-reference.md`](docs/api-reference.md) for a comprehensive, versioned index of all Pi Coding Agent utilities, tools, hooks, and APIs.

## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Decision guide. Licensed MIT.
