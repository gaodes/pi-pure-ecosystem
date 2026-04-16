# pure-devkit

Tools, commands, and skills for developing Pi extensions. Forked from [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) and adapted for the pure-ecosystem.

## Tools

| Tool | Description |
|------|-------------|
| `pi_docs` | List Pi markdown documentation files (README, docs/, examples/) |
| `pi_version` | Get the version of the currently running Pi instance |
| `pi_changelog` | Get changelog entry for a Pi version (latest by default) |
| `pi_changelog_versions` | List all available Pi changelog versions |
| `detect_package_manager` | Detect the package manager used in the current project |

## Commands

| Command | Description |
|---------|-------------|
| `/devkit [VERSION]` | Guided workflow to update Pi extensions to a target version |

## Skills

| Skill | Description |
|-------|-------------|
| `create-pure-extension` | Fork-based and from-scratch workflows for creating pure-* extensions (with 8 reference files) |
| `demo-setup` | Set up demo environments for recording extension previews |

## Reference Files

The `create-pure-extension` skill includes detailed reference files:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns, streaming, multi-action tools |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print), three-tier pattern |
| `references/components.md` | TUI components catalog, custom components |
| `references/commands.md` | Command registration, command vs tool |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/providers.md` | Provider registration, model definitions |
| `references/structure.md` | Standalone repo structure (for reference) |

## Differences from upstream

- Flattened `src/` directory structure (no build step)
- Consolidated skills into `create-pure-extension` with integrated decision table
- Bundled the `create-pure-extension` skill
- Pure-ecosystem naming and conventions

## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Tools, commands, and reference files for extension development. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Decision guide for extending Pi (skill vs extension vs theme). Licensed MIT.
