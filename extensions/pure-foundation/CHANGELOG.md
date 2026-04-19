# Changelog

## 0.2.0

- Add new `Tree` widget for hierarchical rendering with themed tones and box-drawing connectors.
- Align `Frame` internals with upstream container lifecycle by extending `Container`.
- Keep `Frame` API backward-compatible in this fork: `children` and `borderColor` remain optional for existing callers.

## 0.1.0

- Initial release of `pure-foundation`
- Synced core UI modules from upstream `@aliou/pi-utils-ui`:
  - `tools/`
  - `widgets/`
  - `primitives/`
- Added compatibility exports at `ui/components.ts`
- Added shared utility module:
  - `utils/find-pi-installation.ts` (`findPiInstallation()`)
