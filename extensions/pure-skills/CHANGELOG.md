# Changelog

## 0.1.1 (2026-04-18)

- Added `assets/templates/.upstream.template.json` for tracking inspiration sources and upstream metadata.
- `init_skill.py` now supports `--upstream` to scaffold `.upstream.json` from the bundled template.
- `validate_skill.py` now validates `.upstream.json` syntax and unresolved placeholders when present.
- Aligned `create-skill`, `AUTHORING.md`, and `SEARCH.md` on the `.upstream.json` schema and scaffold flow.
- Simplified `SKILL.template.md` to avoid fake reference rows and better match `AUTHORING.md`.

## 0.1.0 (2026-04-18)

- Initial extension with `resources_discover` hook for skill bundling.
- Shared infrastructure: `scripts/init_skill.py`, `scripts/validate_skill.py`, `references/`, `assets/templates/`.
- First skill: `create-skill` — create a new Pi skill from scratch.
