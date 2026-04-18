# Sync Skill Upstream — Plan

Status: scaffold only, not implemented.

Purpose:
- Review a local skill against its upstream inspiration and selectively pull in worthwhile changes without losing local fit.

Likely responsibilities:
- Compare the current local skill with the upstream source.
- Surface meaningful additions, removals, and wording shifts.
- Recommend which changes to adopt, reject, or adapt.
- Preserve local conventions, project-specific constraints, and any intentional divergence.
- Look beyond `SKILL.md` to supporting references, scripts, agents, schemas, and assets when upstream changed there too.

Anthropic imports worth carrying over:
- From the full `skill-creator` package: review the whole package, not just the top-level skill file, because useful changes can land in helper scripts, references, validators, or UI assets.
- From `SKILL.md` and companion files: separate high-value writing and workflow improvements from host-specific machinery that should not be copied blindly.
- From the benchmark/analyzer material: treat upstream changes as evidence to review, not as defaults to merge.
- From the package's overall design: preserve intentional local divergence when the upstream solution is heavier than the local need.

Source inspiration:
- Upstream review workflows used in the pure ecosystem.
- Anthropic/OpenAI-style skill evolution where local copies drift over time.

## Pipeline Interface

### Standalone mode
- Input: user points to a local skill with a known upstream.
- Output: a review report with recommended adoptions, rejections, or adaptations.

### Pipeline mode
- Reads:
  - `03-skill/` — the local skill to sync
  - `extensions/pure-skills/.upstream-sources.json` — upstream registry
- Writes:
  - `04-reports/sync-review.md` — review report with recommendations
  - May update `changeCandidates` in `.upstream-sources.json`
- Exit state:
  - `success` — sync review complete, no urgent changes
  - `findings` — sync review complete, worthwhile upstream changes found
  - `blocked` — upstream is unreachable or skill has no registered upstream

Notes:
- Keep this separate from `analyze-skill` and `update-skill`.
- Treat upstream sync as review-and-adapt, not auto-merge.
- Best when the local skill has a known upstream or inspiration source worth checking periodically.
- Use `extensions/pure-skills/.upstream-sources.json` as the canonical registry for upstream URL, last reviewed date, last seen revision, and documented change candidates.
