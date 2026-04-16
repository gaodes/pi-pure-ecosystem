# Changelog

## [1.0.2] - 2026-04-16

### Changed

- Consolidated `pi-extension` skill into `create-pure-extension`:
  - Integrated decision table (What to Build), tool development section, mode awareness, display methods
  - Added condensed Critical Rules (~15 essential rules)
  - All reference files moved to `create-pure-extension/references/`
  - Deleted `pi-extension` skill directory

## [1.0.1] - 2026-04-16

### Fixed

- Fixed `findPiInstallation()` failing when `require.resolve("@mariozechner/pi-coding-agent/package.json")` is blocked by package exports. Now uses multi-strategy resolution: main export walk-up, global node_modules scan (npm root -g, Homebrew, standard paths), and process.argv walk-up.

## [1.0.0] - 2026-04-15

### Added

- Forked from `@aliou/pi-dev-kit` v0.6.1 (https://github.com/aliou/pi-dev-kit)
- All original tools: `pi_docs`, `pi_version`, `pi_changelog`, `pi_changelog_versions`, `detect_package_manager`
- Original command: `/extensions:update [VERSION]`
- Original skill: `pi-extension` with all 12 reference files
- Original skill: `demo-setup` and prompt: `setup-demo`
- Integrated extending-pi decision guide from `tmustier/pi-extensions`
- Bundled `create-pure-extension` skill from the pure-ecosystem project
- Flattened `src/` directory structure for pure-ecosystem conventions
- Adapted imports and structure to work without build step
