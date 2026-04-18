---
name: sync-upstream
description: >
  Review an inspiration source for new ideas that might improve an imported skill.
disable-model-invocation: true
---

# Sync Upstream

Review an inspiration source for new ideas that might improve an imported skill.

The imported skill has been renamed, restructured, and adapted — it is not a fork. Upstream changes cannot be merged automatically. Instead, inspect what's new upstream since the last review, judge relevance, and hand-pick what to adopt.

## Workflow

1. Read `.upstream.json` from the skill directory to get the source URL and last-reviewed SHA.
2. Fetch the latest from upstream. If the last-reviewed SHA is not available in a shallow clone, fetch more history (or clone without `--depth 1`) until that SHA can be inspected.
3. Compare the upstream source at the last-reviewed SHA vs. the latest. Focus on **what's new**:
   - New features or instructions added upstream.
   - Bugs fixed or edge cases addressed.
   - Restructured content or improved patterns.
   - New scripts, references, or assets added.
4. For each upstream change, judge:
   - **Relevant** — addresses a gap or improvement our skill could use.
   - **Already covered** — our adaptation already handles this differently.
   - **Not applicable** — specific to the source agent/format, doesn't translate.
5. Present findings to the user: relevant changes with a recommendation (adopt / adapt / skip). Let the user decide.
6. Apply approved changes to the skill (adapt, don't copy — maintain our conventions). Re-validate:

```bash
../scripts/validate_skill.py <skill-path>
```

7. Update `.upstream.json` with the latest reviewed SHA and date, even if no changes were adopted.
8. Commit:

```bash
git add <skill-path>/
git commit -m "<skill-name>: sync upstream — <summary of adopted changes or 'reviewed, no changes adopted'>"
```

9. Clean up: `rm -rf /tmp/<source-name>`

### CLI tool version check

After reviewing upstream changes, also check CLI tool versions:

1. Read `cliTools` from `.upstream.json`.
2. For each tool, check the current system version (e.g. `git --version`, `python3 --version`).
3. Compare against the version recorded in `.upstream.json`.
4. If a tool's version changed, flag it:
   - "`biome` changed from 1.5 to 1.8 — verify skill's biome commands still work"
   - "`git` changed from 2.40 to 2.45 — check if any flags used by the skill are deprecated"
5. Present CLI version changes alongside upstream findings. Let the user decide whether to adapt the skill.
6. Update `.upstream.json` `cliTools` with the latest checked versions and date.

If the skill has no `.upstream.json`, it was created from scratch — inform the user there's no upstream to review.
