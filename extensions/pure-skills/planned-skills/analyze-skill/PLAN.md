# Analyze Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Analyze any skill — external or local — and produce a structured, documented analysis.
- Enable comparison between skills by producing consistent analysis output regardless of source.
- Do not create or modify any local skills; only output findings and recommendations.

Likely responsibilities:
- Accept either:
  - external skill URLs/links (with optional user context)
  - local skill paths (within the project or global agent skills)
- Read the skill and identify what is actually reusable or noteworthy for Pi's skill format.
- Map the source structure against Pi's `SKILL.md` + optional `scripts/`, `references/`, and `assets/` layout.
- Note where descriptions, instructions, scope, and limits would need rewriting to fit local Pi conventions.
- Flag source-specific packaging, eval, marketplace, or platform details that should be stripped or adapted.
- Preserve useful writing patterns while discarding machinery tied to another host environment.
- Output a structured, consistent analysis document that can be:
  - reviewed standalone
  - fed to `compare-skills` for side-by-side comparison
  - used by `create-skill` as input when building a new skill

Anthropic imports worth carrying over:
- From `SKILL.md`: understand creation heuristics, writing style, and progressive disclosure patterns that might survive translation.
- From `references/schemas.md` and related scripts: inspect eval/benchmark machinery as optional concepts to note, not default baggage.
- From `scripts/package_skill.py`: check for packaging/distribution details and mark them for exclusion unless genuinely needed.
- From the overall package layout: inspect supporting files, not just `SKILL.md`, because useful ideas live in agents, scripts, references, and assets.

Source inspiration:
- Prior pure-ecosystem analysis and import workflow work.
- Anthropic/OpenAI-style skill evaluation and adaptation patterns.
- Anthropic `skills/skill-creator/` as a full-package example, not just a single markdown file.

## Pipeline Interface

### Standalone mode
- Input: user provides one or more skill URLs, links, or local paths, optionally with context.
- Output: one analysis document per source, printed or saved to a user-specified location.

### Pipeline mode
- Reads:
  - `00-intent.md` — to understand what the user wants from the analyzed sources
- Writes:
  - `01-analyses/source-NNN.md` — one structured analysis document per source, using the format defined in `planned-skills/pipeline/DESIGN.md`
- Exit state:
  - `success` — all sources analyzed
  - `blocked` — a source is unreachable or unreadable; skip and document

Notes:
- Keep this separate from `create-skill`.
- Output is analysis documentation only; do not scaffold, write, or modify any skill files.
- The analysis format should be consistent whether the source is external or local, so that `compare-skills` can operate on the output without knowing the original source.
- Register interesting external sources in `extensions/pure-skills/.upstream-sources.json` so the extension keeps one canonical upstream plus secondary inspirations at the extension level.
