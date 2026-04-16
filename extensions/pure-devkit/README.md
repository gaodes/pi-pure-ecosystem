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
| `create-pure-extension` | Fork-based and from-scratch workflows for creating pure-* extensions |
| `update-pure-extension` | Sync pure-* extensions with upstream sources |
| `enhance-pure-extension` | Add features, fix bugs, or modify existing pure-* extensions |
| `demo-setup` | Set up demo environments for recording extension previews |

## Skills in Detail

### create-pure-extension

Create a new pure-* extension, either by forking an existing extension or building from scratch.

**When to use:** User asks to create a new extension, add a new pure-* extension, or fork an extension.

**Workflows:**
- **Fork-based**: Clone an existing extension, rename to pure-* conventions, adapt
- **From-scratch**: Interview user, design, implement, test

### update-pure-extension

Update a pure-* extension by syncing with upstream sources.

**When to use:** User asks to update, sync, or pull changes for an extension we created.

**Workflow:**
1. Find primary source from README.md → Sources / Inspiration
2. Check upstream for changes
3. Cherry-pick, skip, or adapt
4. Test and restore activation

### enhance-pure-extension

Enhance or modify a pure-* extension we maintain.

**When to use:** User asks to add a feature, fix a bug, or change behavior of an existing extension we own.

**Workflow:**
1. Determine scope of change
2. Move globally-active to local for development
3. Make changes following pure-* conventions
4. Test and restore activation

## Reference Files

All three extension skills share detailed reference files:

| File | Content |
|------|---------|
| `references/tools.md` | Tool registration, rendering patterns, streaming, multi-action tools |
| `references/modes.md` | Mode awareness (Interactive/RPC/Print), three-tier pattern |
| `references/components.md` | TUI components catalog, custom components |
| `references/commands.md` | Command registration, vs tools |
| `references/messages.md` | sendMessage, notify, custom message renderers |
| `references/hooks.md` | Event handlers, blocking/cancelling, spawn hooks |
| `references/providers.md` | Provider registration, model definitions |
| `references/structure.md` | Standalone repo structure (for reference) |

## Differences from upstream

- Flattened `src/` directory structure (no build step)
- Consolidated into three focused skills: create, update, enhance
- Bundled the extension skills with integrated decision table and critical rules
- Pure-ecosystem naming and conventions

## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Tools, commands, and reference files for extension development. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Decision guide for extending Pi (skill vs extension vs theme). Licensed MIT.
