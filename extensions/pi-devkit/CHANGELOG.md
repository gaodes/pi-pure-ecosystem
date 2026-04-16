# Changelog

## [1.1.0] - 2026-04-16

### Changed

- Renamed extension from `pure-devkit` to `pi-devkit` — generic tooling, usable across all Pi projects
- Moved pure-ecosystem-specific skills (`create-pure-extension`, `import-pure-extension`, `update-pure-extension`, `enhance-pure-extension`) to the pure-ecosystem repo's `.pi/skills/` directory
- Cleaned README and docs of pure-ecosystem-specific references

## [1.0.4] - 2026-04-16

### Changed

- Split `create-pure-extension` into four focused skills:
  - `create-pure-extension` — from-scratch workflow only (~200 lines, streamlined)
  - `import-pure-extension` — fork-based workflow, condensed (~150 lines)
  - `update-pure-extension` — sync with upstream
  - `enhance-pure-extension` — add features, fix bugs
- Deleted redundant `setup-demo` prompt (skill covers everything)

## [1.0.3] - 2026-04-16

### Changed

- Split `create-pure-extension` into three focused skills

## [1.0.2] - 2026-04-16

### Changed

- Consolidated `pi-extension` skill into `create-pure-extension`

## [1.0.1] - 2026-04-16

### Fixed

- Fixed `findPiInstallation()` failing on package exports

## [1.0.0] - 2026-04-15

### Added

- Forked from `@aliou/pi-dev-kit` v0.6.1
- All original tools, commands, skills, and prompts
