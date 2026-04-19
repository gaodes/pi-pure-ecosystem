# Changelog

## 0.1.1

- Mark `pure-utils` as deprecated in favor of:
  - `pure-foundation` for shared UI/modules
  - `pure-dev-kit` for utility tools
- Keep extension for historical compatibility only (no new feature development)

## 0.1.0

- Initial release — ports tools from deprecated `pi-devkit`:
  - `detect_package_manager`
  - `pi_version`
  - `pi_docs`
  - `pi_changelog`
  - `pi_changelog_versions`
- Adds shared utilities:
  - `findPiInstallation()`
  - `ToolCallHeader`, `ToolBody`, `ToolFooter` UI components
