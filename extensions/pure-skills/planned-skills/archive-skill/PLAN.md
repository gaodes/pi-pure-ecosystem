# Archive Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Cleanly retire a skill that is superseded, obsolete, or no longer needed.
- Preserve history without leaving dead weight in the active skill set.

Likely responsibilities:
- Identify the skill to archive and document the reason.
- Move the skill to an archive location (e.g., `.archived-skills/` or equivalent).
- Check for any active references, dependencies, or upstream links that need updating.
- Update any relevant indices or registries.
- Ensure the archived skill remains readable for future reference.

## Pipeline Interface

### Standalone mode
- Input: user identifies a skill to retire.
- Output: the skill is moved to an archive location; a record of the action is produced.

### Pipeline mode
- Reads:
  - `03-skill/` — the skill to archive, or the skill path from `00-intent.md`
- Writes:
  - Archive location outside the active skill path
  - `99-summary.md` — note that the skill was archived and why
- Exit state:
  - `success` — skill archived
  - `blocked` — skill has active references or dependencies; list them and stop

Notes:
- Keep this separate from `update-skill` and `sync-skill-upstream`.
- Do not delete history; archive preserves the record.
- Only archive after confirming the skill is truly unused or fully superseded.
