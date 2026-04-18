# Changelog

## 0.1.2 (2026-04-18)

- Simplified `skills/create-skill` so it relies only on `references/AUTHORING.md` instead of the larger search/pattern/lifecycle reference set.
- Inlined shape-selection and manual self-check guidance into `create-skill`.
- Pulled additional create-only ideas from Anthropic's `skill-creator`: extract intent from the current conversation first, capture success criteria and dependencies explicitly, plan reusable resources before writing, and make description-writing guidance more explicit.
- Removed bundled search and validation infrastructure from `pure-skills` in preparation for dedicated search and validate skills later.
- Removed `references/SEARCH.md`, `references/PATTERN-SELECTOR.md`, `references/LIFECYCLE.md`, `scripts/validate_skill.py`, and `assets/templates/.upstream.template.json`.
- Simplified `scripts/init_skill.py` to scaffold only the core skill structure and resource directories.
- Added non-discoverable plan scaffolds for future `analyze-skill`, `evaluate-skill`, `optimize-skill-description`, `sync-skill-upstream`, `validate-skill`, `update-skill`, `search-skill`, `audit-skill`, `archive-skill`, and `plan-skill` companions under `planned-skills/`.
- Added sub-agent plan scaffolds for `agent-grader`, `agent-comparator`, and `agent-analyzer` under `planned-skills/`, adapted from Anthropic's skill-creator agent patterns to Pi's sub-agent architecture.
- Added pipeline design document at `planned-skills/pipeline/DESIGN.md` defining workspace conventions, artifact formats, and phase transitions for the full skill creation lifecycle.
- Added `Pipeline Interface` sections to all planned skills documenting standalone vs pipeline mode inputs, outputs, and exit states.
- Updated `planned-skills/pipeline/DESIGN.md` with patterns from Anthropic skill-creator (parallel execution, iteration directories, sub-agent instruction files, blind comparison), CrewAI (guardrails, role-goal-backstory), and LangChain Deep Agents (filesystem state passing).
- Tightened `create-skill`, `AUTHORING.md`, the SKILL template, and scaffold guidance using additional phrasing cues from Anthropic's `skill-creator`: concrete inputs, user-jargon matching, slightly more proactive description wording to reduce undertriggering, "explain the why" writing guidance, fresh-eyes revision, a clearer lack-of-surprise rule, and sharper trigger phrasing around adjacent user wording.
- Added extension-level `.upstream-sources.json` as the canonical machine-readable registry for one primary upstream source, secondary inspirations, review dates, seen revisions, and documented change candidates.

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
