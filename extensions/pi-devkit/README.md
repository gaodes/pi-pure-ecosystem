# pi-devkit

Tools, commands, and skills for developing Pi extensions. Forked from [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit).

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
| `demo-setup` | Set up demo environments for recording extension previews |

## Reference Files

The bundled skill shares detailed reference files:

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
