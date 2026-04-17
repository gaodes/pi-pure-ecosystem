# TODO

Things to tackle for the pure-extensions-dev skill and project AGENTS.md.

## Cross-platform & terminal compatibility

- [ ] **Extensions must integrate well with Ghostty terminal** — Test extensions in Ghostty specifically, handle any terminal-specific quirks
- [ ] **Extensions should work on macOS and Linux** — Headless Linux and macOS is not headless. Design for both systems unless features specifically require a GUI and are not working in terminal. In that case, ask the user. This is the primary approach but not a hard constraint
- [ ] **Flag macOS-only or GUI-dependent extensions** — If an extension contains macOS-only features or makes use of a GUI, it should be flagged as such in its README and catalog entry

## SKILL.md & AGENTS.md audit

- [ ] **Fix the design philosophy** — SKILL.md says "Follow the project AGENTS.md design philosophy" but the design philosophy section in AGENTS.md may need updating to reflect the new skill structure and conventions
- [ ] **The activation tiers** — AGENTS.md lists "Globally active" and "Locally active" extensions. Verify this is still accurate and complete after all the changes
- [ ] **See if the extensions need to be in the main AGENTS.md** — The extensions table in AGENTS.md lists all extensions, tools, commands, and purposes. Decide whether this belongs in AGENTS.md (canonical project doc) or only in `references/pure-extensions-catalog.md` (skill-level doc)
- [ ] **See if the key Pi API packages need to be in the AGENTS.md** — AGENTS.md has a "Key Pi API packages" table. Decide if this is canonical project info or belongs only in the skill's `references/api-reference.md`
- [ ] **See what remaining info needs to be in AGENTS.md vs skill-only** — Audit everything in AGENTS.md and classify: what is canonical project-level knowledge (stays in AGENTS.md) vs what is only relevant for extension development (stays in the skill)

## Missing skill scopes

- [ ] **Skills creation should refer to a skill to be done** — The "What to Build" table in SKILL.md lists Skills as a type but has no sub-skill workflow for creating them. Either add a reference or create a dedicated skill/workflow file
- [ ] **Theme creation should refer to a skill to be done** — Same for themes. The table lists themes but there's no workflow for creating them. Either add a reference or create a dedicated skill/workflow file

## Reference file completeness

- [ ] **Track keyboard shortcuts in Pure Extensions Catalog** — Existing extensions may register custom keybindings. Catalog should list them so new extensions avoid collisions
- [ ] **Track all hooks/events in Pure Extensions Catalog** — Currently lists some hooks but should be exhaustive: every `pi.on()` event used, with handler signatures, so new extensions know what's taken and what's available
- [ ] **Track everything that could conflict** — Tool names, command names, keybindings, hook events, config file names, widget slots, settings keys — anything that would cause an error or collision when creating a new extension

- [ ] **Implement/use the pi-devkit tools** — The skill should leverage pi-devkit tools (`pi_docs`, `pi_version`, `pi_changelog`, `pi_changelog_versions`, `detect_package_manager`) where applicable instead of manual bash equivalents

## Missing skills to create

- [ ] **Create a pure-meta-skill** — A dedicated skill for creating Pi skills (SKILL.md files, prompt templates, etc.). The "What to Build" table in SKILL.md lists Skills as a type but has no dedicated workflow for them
- [ ] **Create a pure-theme skill** — A dedicated skill for creating Pi themes (theme.json). The "What to Build" table lists Themes as a type but has no dedicated workflow for them

## Missing features

- [ ] **Create a pure-utils extension** — Shared utilities (path helpers, config patterns, common types) used across multiple extensions. Currently each extension inlines these. Extract to a dedicated `pure-utils` package to reduce duplication while keeping extensions self-contained
- [ ] **Audit existing extensions for overlapping functionality** — Check all extensions for duplicated logic, conflicting tool/command names, and redundant patterns. Propose fixes: extract shared code to pure-utils, resolve conflicts, standardize patterns
- [ ] **Import the themes** — The mono repo has a `themes/` directory but no theme is defined there yet. The skill should cover theme creation/import workflow
