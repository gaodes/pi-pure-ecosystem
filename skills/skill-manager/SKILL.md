---
name: skill-manager
description: >
  Create, import, sync, self-evolve, evaluate, refactor, or retire Pi agent skills. Use when the user asks to
  create a new skill, import or adapt an external skill, review an inspiration source for new ideas, self-audit or
  self-improve managed skills, evaluate skill quality, optimize a skill description, or decide whether something
  should be a skill vs. an extension. Triggers on mentions of SKILL.md, skill authoring, skill creation, skill
  import, skill sync, or skill update.
---

# Skill Manager

A meta-skill for creating and managing other Pi agent skills.

## How to use this skill

1. Read this section, then match the user's request to a sub-skill in the dispatch table below.
2. Read the matched sub-skill's `SKILL.md` and follow it. Sub-skills load supporting references from `../references/` as needed.
3. Use `../scripts/validate_skill.py` for structure checks.
4. If the user's request spans multiple tasks (e.g. import then evaluate), handle them sequentially.
5. Git history is the change log. Commit with descriptive messages: `<skill-name>: <action> — <summary>`.
6. If the request doesn't clearly match one dispatch row, ask before proceeding.

## Dispatch

| Task | Sub-skill | When |
|------|-----------|------|
| Create new | `create/SKILL.md` | User wants a new capability packaged as a skill |
| Import external | `import/SKILL.md` | User wants to import, fork, or adapt a skill from another repo or agent |
| Improve existing | `improve/SKILL.md` | Skill is too large, unfocused, or failing on recurring patterns |
| Evaluate | `evaluate/SKILL.md` | Skill needs validation |
| Optimize description | `optimize-description/SKILL.md` | Skill doesn't trigger correctly on relevant prompts |
| Retire | `retire/SKILL.md` | Skill is obsolete or replaced |
| Sync upstream | `sync-upstream/SKILL.md` | User wants to check an inspiration source for new ideas to adopt |
| Self-evolve | `self-evolve/SKILL.md` — ask user which mode if needed | User wants the meta-skill to review and improve itself or managed skills |

## Design Rules

1. **One skill, one job.** If it does two unrelated things, split it.
2. **SKILL.md is the surface.** Keep it under 300 lines (~6000 tokens). Move detail into `references/`.
3. **Progressive disclosure.** Three tiers:
   - **Metadata** (~100 tokens): `name` + `description` loaded at startup for all skills.
   - **Instructions** (< 6000 tokens): full SKILL.md body loaded when the skill activates.
   - **Resources** (as needed): files in `references/`, `assets/`, `scripts/` loaded only when the task requires them.
4. **Scripts are welcome.** When the agent rewrites the same logic every run, bundle a tested script in `scripts/`. Design scripts for agentic use: no interactive prompts, clear `--help`, structured output, helpful error messages. When a skill needs hooks, typed tools, UI, or persistent state — promote it to an extension.
5. **Skills can grow into extensions.** See `references/PATTERN-SELECTOR.md` for the decision table and `references/LIFECYCLE.md` for promotion signals.
6. **Inputs and outputs are explicit.** A skill that doesn't define what it consumes and produces cannot be evaluated.
7. **Every skill has at least one failure mode documented.** If you can't think of how it fails, you haven't scoped it well enough.
8. **CLI tools are documented and tracked.** If a skill uses external CLI tools, document them in `compatibility` frontmatter. Track versions in `.upstream.json` and flag changes during sync.

## Limits

- Cannot create skills without concrete examples or a clear purpose from the user.
- Cannot evaluate skills without test cases or usage examples.
- Cannot sync upstream for skills without `.upstream.json` (created during import).
- Cannot retire skills that are still referenced by other skills or docs without updating those references first.
- Does not decide skill vs extension for the user — reads `references/PATTERN-SELECTOR.md` to recommend, user decides.
- All created skills must stay under 300 lines; detail that overflows must move to `references/`.

## References

| File | Load when... |
|------|-------------|
| `references/AUTHORING.md` | Writing the instructions inside a SKILL.md |
| `references/SEARCH.md` | Searching remote skill registries (auto-loaded by create/import) |
| `references/LIFECYCLE.md` | Promotion and lifecycle signals |
| `references/PATTERN-SELECTOR.md` | Deciding skill shape, skill vs. extension, or where to place |
| `references/SELF-AUDIT.md` | Running a portfolio audit across managed skills |
| `scripts/init_skill.py` | Scaffolding a new skill directory |
| `scripts/validate_skill.py` | Automated validation of a skill directory |
| `assets/templates/SKILL.template.md` | Template source for init_skill.py |
| `assets/templates/.upstream.template.json` | Template source for .upstream.json |
