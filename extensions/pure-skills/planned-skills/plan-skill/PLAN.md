# Plan Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Produce a structured implementation plan for a new skill by synthesizing analysis documents, user intent, and Pi conventions.
- Act as the bridge between `analyze-skill` output and `create-skill` input.
- Do not write the skill itself; only output a plan that `create-skill` can consume.

Likely responsibilities:
- Read one or more analysis documents produced by `analyze-skill`.
- Read the user's stated intent, constraints, and non-goals.
- Synthesize findings into a concrete implementation plan including:
  - skill name and purpose
  - trigger examples and description guidance
  - inputs, outputs, and success criteria
  - resource plan: what belongs in `scripts/`, `references/`, or `assets/`
  - target scope: project, global, or extension-bundled
  - explicit exclusions: what to leave out from the analyzed sources
- Reference `references/AUTHORING.md` to ensure the plan aligns with Pi conventions.
- Output a structured plan document that `create-skill` can execute without further user interaction.

Notes:
- Keep this separate from `create-skill`. Planning and implementation are distinct agents in the pipeline.
- This skill only runs after analysis is complete. It does not interact with external sources directly.
- The plan must be explicit enough that `create-skill` can execute it autonomously, but it should not predetermine wording or phrasing that belongs in the authoring step.
- Register any newly discovered inspiration sources in `extensions/pure-skills/.upstream-sources.json`.

## Pipeline Interface

### Standalone mode
- Input: user describes a desired skill, optionally with links to external inspirations.
- Output: a structured plan document; user may then invoke `create-skill` manually.

### Pipeline mode
- Reads:
  - `01-analyses/*.md` — analysis documents from `analyze-skill`
  - `00-intent.md` — user intent and constraints captured at pipeline start
- Writes:
  - `02-plan/plan.md` — the implementation plan
- Exit state:
  - `success` — plan produced, ready for `create-skill`
  - `blocked` — analysis is insufficient or contradictory; requires user clarification
