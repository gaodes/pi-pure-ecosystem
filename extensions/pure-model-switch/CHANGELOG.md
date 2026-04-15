# Changelog

## [0.1.0] - 2026-04-14

### Added

- Forked from [pi-model-switch](https://github.com/nicobailon/pi-model-switch) v0.1.4
- Renamed to `pure-model-switch` conventions
- Single-file `index.ts` entry point (merged all source into one file)
- Replaced extension-directory config with pure-* path helpers (`~/.pi/agent/pure/config/pure-model-switch.json`)
- Auto-migration from old `aliases.json` location
- Reload aliases on each session start
- Removed unnecessary `package.json`, `tsconfig.json`, and build artifacts
- README and CHANGELOG in pure-* format with Sources / Inspiration section
