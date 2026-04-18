# Search Skill — Plan

Status: scaffold only, not implemented.

Purpose:
- Find existing skills that match a user's need, inside or outside the local project.
- Surface relevant skills from GitHub, GitLab, the Pi ecosystem, or other known registries so the user can decide what to analyze, import, or learn from.

Likely responsibilities:
- Accept a natural-language query or task description from the user.
- Search known repositories and registries for matching skills.
- Return ranked results with source links, brief descriptions, and fit notes.
- Distinguish between Pi-native skills and third-party formats that would need adaptation.
- Do not install or modify anything; output is a findings report only.

Anthropic imports worth carrying over:
- From the broader skill-creator workflow: treat search as a lightweight discovery phase, not a heavy crawling or indexing system.
- From `references/schemas.md`: if any structured registry metadata emerges later, keep result formatting simple and consistent.

Source inspiration:
- Prior pure-ecosystem search and discovery workflow work.
- General skill marketplace and registry discovery patterns.

## Pipeline Interface

### Standalone mode
- Input: user provides a natural-language query or task description.
- Output: a ranked findings report with source links and fit notes.

### Pipeline mode
- Reads:
  - `00-intent.md` — the user's request and constraints
- Writes:
  - `01-analyses/search-results.md` — ranked findings that may be consumed by `analyze-skill`
- Exit state:
  - `success` — search complete, results documented
  - `blocked` — no matching skills found; document the empty result

Notes:
- Keep this separate from `analyze-skill`, `import-skill`, and `create-skill`.
- Output is a documented findings report; do not install, scaffold, or modify skills.
- Register interesting discovered sources in `extensions/pure-skills/.upstream-sources.json` if they become future inspiration targets.
