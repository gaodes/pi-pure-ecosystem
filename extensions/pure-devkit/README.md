# pure-devkit

Tools, commands, and skills for developing Pi extensions. Forked from [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) and adapted for the pure-ecosystem, with integrated guidance from [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi).

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
| `pi-extension` | Comprehensive reference for creating, updating, and publishing Pi extensions (12 reference files) |
| `create-pure-extension` | Fork-based and from-scratch workflows for creating pure-* extensions |
| `demo-setup` | Set up demo environments for recording extension previews |

## Prompts

| Prompt | Description |
|--------|-------------|
| `setup-demo` | Create a demo environment for a Pi extension |

## Differences from upstream

- Flattened `src/` directory structure (no build step)
- Integrated extending-pi decision guide into the pi-extension skill
- Bundled the `create-pure-extension` skill
- Pure-ecosystem naming and conventions

## Sources / Inspiration

- [`@aliou/pi-dev-kit`](https://github.com/aliou/pi-dev-kit) — Primary source. Tools, commands, and the pi-extension skill with reference files. Licensed MIT.
- [`tmustier/pi-extensions/extending-pi`](https://github.com/tmustier/pi-extensions/tree/main/extending-pi) — Decision guide for extending Pi (skill vs extension vs theme). The skill-creator sub-skill's guidance on skill authoring informed the integrated decision guide. Licensed MIT.
