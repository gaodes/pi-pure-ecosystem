# Analysis: What pure-utils Tools Can Discover in Reference Files

> ⚠️ Archived historical analysis. Tool ownership has moved to `pure-dev-kit` and shared UI moved to `pure-foundation`.
>
> Generated 2026-04-17 using pure-utils tools (`pi_version`, `pi_docs`, `pi_changelog`)

---

## 1. Version Drift — All Reference Files Are Stale

**Discovered with:** `pi_version` (returns 0.67.6)

Every reference file in `.pi/skills/pure-extensions-dev/references/` has this header:

```
> Pi version: 0.67.4 | Last updated: 2026-04-17
```

But the installed Pi is **0.67.6**. Two patch versions behind.

**Impact:** Reference files may miss APIs added in 0.67.5 and 0.67.6.

---

## 2. Missing APIs from 0.67.6 Changelog

**Discovered with:** `pi_changelog version="0.67.6"`

The changelog reveals these additions, none of which appear in the reference files:

| Feature | File Where It Should Appear | Status |
|---------|---------------------------|--------|
| `after_provider_response` hook | `hooks.md`, `additional-apis.md` | ❌ Missing |
| `argument-hint` frontmatter field for prompt templates | `documentation.md` (prompt templates section missing entirely) | ❌ Missing |
| OSC 8 hyperlink rendering | `components.md` (markdown rendering section) | ❌ Missing |
| Compact startup header (`Ctrl+O` toggle) | `modes.md` or `additional-apis.md` | ❌ Missing |
| `find` tool path-based glob patterns | `tools.md` | ❌ Missing |

---

## 3. pi-docs Discovers Documentation Not in References

**Discovered with:** `pi_docs`

The Pi installation has these markdown files that are **not referenced** in the skill:

| Doc File | Why It Matters |
|----------|---------------|
| `docs/sdk.md` | SDK integration guide — referenced in AGENTS.md but not in skill |
| `docs/packages.md` | Pi package format specification — critical for `packaging.md` |
| `docs/custom-provider.md` | Adding custom model providers — not in `providers.md` |
| `docs/models.md` | Model selection and configuration — `pure-model-switch` could use this |
| `docs/extensions.md` | Extension development guide — overlaps with skill, may have gaps |
| `docs/themes.md` | Theme development — `pure-theme` and `components.md` could reference |
| `docs/tui.md` | TUI component API — `components.md` is a subset |
| `docs/keybindings.md` | Keyboard shortcuts — `additional-apis.md` mentions shortcuts but this is fuller |
| `docs/prompt-templates.md` | Prompt template format — **completely missing from skill** |

---

## 4. pure-extensions-catalog.md Is Stale

**Discovered by:** cross-referencing `pi_version` + file contents

The catalog (a "living reference") lists:

| Problem | Evidence |
|---------|----------|
| `pi-devkit` still listed as active | We just removed it from global settings |
| `pure-utils` not listed at all | Created today, not in catalog |
| Version column says 0.67.4 | Should be 0.67.6 |
| `pure-vibes` listed as "Local (source path)" | Verify if still true |

The catalog has a "Lines" and ".ts Files" column but no automated way to verify these numbers.

---

## 5. tools.md References Deprecated @aliou/pi-utils-ui

**Discovered by:** reading `tools.md` + `dependency-audit.md` contradiction

`tools.md` import example:
```typescript
import { ToolCallHeader, ToolBody, ToolFooter } from "@aliou/pi-utils-ui";
```

But `dependency-audit.md` says:
> `@aliou/*` packages → Inline or `@mariozechner/*` → **Replace? Yes**

**Resolution:** These components are now in `pure-utils/ui/components.ts`. The reference should say:
```typescript
import { ToolCallHeader, ToolBody, ToolFooter } from "../../pure-utils/ui/components";
// Or copy inline if you don't depend on pure-utils
```

---

## 6. dependency-audit.md Doesn't Mention pure-utils

**Gap:** The audit lists `@aliou/*` as "replace" but doesn't say *with what*.

It should have a row:

| Original | Pi API / Alternative | Replace? | Notes |
|----------|---------------------|----------|-------|
| `@aliou/pi-utils-ui` | `pure-utils/ui/components.ts` | Yes | Inline or import from pure-utils |

Also missing: guidance on when to use `pure-utils` utilities like `findPiInstallation()`.

---

## 7. packaging.md Missing Shared Utilities Pattern

**Gap:** No guidance on:
- When to put code in `pure-utils` vs. inline in your extension
- How to import from sibling extensions (e.g., `../../pure-utils/ui/components`)
- Peer dependency conventions for utility extensions

The `pure-utils/package.json` has `peerDependencies` but `packaging.md` says "Omit peerDependencies in minimal package.json." The doc doesn't explain the exception: utility extensions that other extensions import from need peer deps declared.

---

## 8. documentation.md Missing Prompt Template Section

**Gap:** No mention of prompt template documentation, despite:
- `pi_docs` revealing `docs/prompt-templates.md`
- 0.67.6 changelog adding `argument-hint` frontmatter for prompt templates
- Several extensions (`pure-vibes`, `pure-cron`) using prompts

---

## 9. critical-rules.md Could Reference Version Check

**Suggestion:** Add a rule:
> "Before updating reference files, run `pi_version` to verify the 'Pi version' header matches the installed version."

---

## Summary Table: Discoveries by Tool

| Tool | What It Discovered | Reference File to Update |
|------|-------------------|-------------------------|
| `pi_version` | Installed Pi is 0.67.6, not 0.67.4 | All `.md` headers in `references/` |
| `pi_changelog` | New APIs in 0.67.5-0.67.6 | `hooks.md`, `additional-apis.md`, `components.md` |
| `pi_docs` | Undocumented Pi docs exist | `documentation.md` (add prompt-templates), `providers.md` (add custom-provider) |
| `pi_changelog_versions` | 40+ versions available | Verify catalog version column |
| `detect_package_manager` | (Not used in this analysis) | Could verify `packaging.md` install commands |

---

## Recommended Actions

1. **Batch update all headers** to `Pi version: 0.67.6`
2. **Add missing APIs** from 0.67.6 changelog to relevant reference files
3. **Update pure-extensions-catalog.md** — remove `pi-devkit`, add `pure-utils`
4. **Fix tools.md import example** — replace `@aliou/pi-utils-ui` with `pure-utils`
5. **Add `pure-utils` to dependency-audit.md** as `@aliou/*` replacement
6. **Add prompt template section** to `documentation.md`
7. **Add shared utilities pattern** to `packaging.md`
