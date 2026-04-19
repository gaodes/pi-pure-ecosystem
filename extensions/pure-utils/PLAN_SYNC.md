# Plan (Reviewed): Upgrade `pure-utils` with upstream `@aliou/pi-utils-ui`

> ⚠️ Archived migration plan. This path was superseded by introducing `pure-foundation` as the shared layer and keeping utility tools in `pure-dev-kit`.

## Verdict on original plan

The direction is good (sync with upstream UI primitives), but the original plan has a few risky points:

1. **Naming mismatch with repo conventions**
   - This repo standard is `pure-*` for extension directories.
   - Renaming to `extensions/pi-utils-ui/` breaks that convention.

2. **Breaking removal too early**
   - Deleting `pure-utils` immediately risks removing currently registered tools (`pi_version`, `pi_docs`, `pi_changelog`, `detect_package_manager`) from the active manifest.

3. **Import path example is incorrect**
   - From `extensions/pure-dev-kit/src/tools/*.ts`, path to a sibling extension is not `../pi-utils-ui/...`.

4. **No compatibility phase**
   - Plan should include a staged migration with a fallback/re-export window.

---

## Updated goal

Bring `pure-utils` to feature parity with upstream `@aliou/pi-utils-ui` **without breaking current tool availability or repo conventions**.

---

## Updated migration strategy (safe, staged)

### Phase 0 — Baseline and inventory

1. Capture current references:
   - Search for `@aliou/pi-utils-ui` imports
   - Search for `pure-utils` imports
2. Snapshot current `pure-utils` files and manifest entries.

### Phase 1 — In-place upstream sync (no rename yet)

3. Keep directory as `extensions/pure-utils/`.
4. Copy upstream UI library source from:
   - `../ext-testing/.pi/npm/node_modules/@aliou/pi-utils-ui/`
5. Add upstream structure inside `pure-utils`:
   ```
   extensions/pure-utils/
   ├── tools-ui/            # upstream tools/ (renamed to avoid conflict with extension tool registrations)
   ├── widgets/
   ├── primitives/
   ├── ui/
   │   └── components.ts    # compatibility shim; can re-export from tools-ui
   └── index.ts
   ```
6. Implement compatibility shim in `ui/components.ts`:
   - Re-export `ToolCallHeader`, `ToolBody`, `ToolFooter`, etc. from synced upstream files.
   - Keep existing import sites working.

### Phase 2 — Preserve extension tools, separate concerns

7. Keep current extension-registered tools in `extensions/pure-utils/tools/` for now.
8. Do **not** move/delete these tools until `pure-dev-kit` is actively loaded and verified as replacement.
9. Optional later split:
   - `pure-utils` = shared UI/primitives
   - `pure-dev-kit` = operational tools

### Phase 3 — Optional `pure-dev-kit` migration path

10. If migrating `pure-dev-kit` away from npm dependency:
    - Preferred: switch imports to local pure-utils exports (stable local path strategy)
    - Avoid brittle deep relative imports into sibling extension internals.
11. Remove `@aliou/pi-utils-ui` dependency from `pure-dev-kit/package.json` only after validation.

### Phase 4 — Validation

12. Smoke-test in Pi:
    - `pi_version`
    - `detect_package_manager`
    - `pi_docs`
    - `pi_changelog`
13. Confirm no unresolved imports for:
    - `@aliou/pi-utils-ui`
    - moved/re-exported symbols
14. Run lint (`biome check --write --unsafe extensions/ skills/`) and verify zero errors.

### Phase 5 — Cleanup (only after successful validation)

15. Remove dead code paths and temporary aliases.
16. Update `README.md` and `CHANGELOG.md` in `extensions/pure-utils/` with:
    - Upstream sync date/version
    - Compatibility decisions
    - Any known deltas from upstream

---

## What changes now vs later

### Immediate (safe)
- Sync upstream UI primitives into `pure-utils`
- Keep existing tool behavior intact
- Add compatibility re-exports

### Later (optional hardening)
- Move tool ownership fully to `pure-dev-kit`
- Potentially split UI library into its own extension/package when there are multiple dependents

---

## Risks and mitigations

- **Risk: Tool outage from deleting `pure-utils` too soon**
  - Mitigation: keep tool registration until replacement is verified.

- **Risk: Import churn across extensions**
  - Mitigation: compatibility shim + staged deprecation.

- **Risk: Upstream drift over time**
  - Mitigation: document sync source path + sync checklist in changelog.

- **Risk: API signature mismatch (`handleInput`)**
  - Mitigation: type-check against installed `@mariozechner/pi-tui` during validation.

---

## Recommended decision

Use an **in-place sync of `pure-utils` first** (no rename/deletion), then do dependency and ownership cleanup in a second pass.

This gives parity with upstream UI capabilities while minimizing breakage and preserving current extension behavior.
