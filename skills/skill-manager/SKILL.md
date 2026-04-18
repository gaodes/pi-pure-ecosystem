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

1. Read this section first, then use the dispatch table below to match the user's request to a task.
2. Read the matched task reference and follow it. Load support references only when that task needs them.
3. Use `scripts/validate_skill.py` for structure checks and `scripts/package_skill.py` for distributable archives.
4. If the user's request spans multiple tasks (e.g. import then evaluate), handle them sequentially.
5. Git history is the change log. Commit with descriptive messages: `<skill-name>: <action> — <summary>`.
6. If the request doesn't clearly match one dispatch row, ask before proceeding.

## Inputs

- User requests about skill lifecycle actions: create, import, sync upstream, improve, evaluate, optimize description, self-evolve, retire.
- Optional: concrete usage examples, constraints, non-goals, target directory.

## Outputs

- Scaffolded skill directories with valid structure.
- Modified or refactored skill files.
- Validation reports (pass/fail with violations).
- Evaluation results (quick checks or structured evals).
- Optimized descriptions.
- Packaged `.skill` archives.
- Git commits with descriptive messages.

## Dispatch

| Task | Action | When |
|------|--------|------|
| Create new | Read `references/CREATE.md` | User wants a new capability packaged as a skill |
| Import external | Read `references/IMPORT.md` | User wants to import, fork, or adapt a skill from another repo or agent |
| Sync upstream | Read `references/SYNC-UPSTREAM.md` | User wants to check an inspiration source for new ideas to adopt |
| Self-evolve | Read `references/SELF-EVOLVE.md` — ask user which mode if needed | User wants the meta-skill to review and improve itself or managed skills |
| Improve existing | Read `references/IMPROVE.md` | Skill is too large, unfocused, or failing on recurring patterns |
| Evaluate | Read `references/EVALUATION.md` | Skill needs validation before publishing |
| Optimize description | Read `references/DESCRIPTION-OPTIMIZATION.md` | Skill doesn't trigger correctly on relevant prompts |
| Retire | Read `references/RETIRE.md` | Skill is obsolete or replaced |

---

## Limits

- Cannot create skills without concrete examples or a clear purpose from the user.
- Cannot evaluate skills without test cases or usage examples.
- Cannot sync upstream for skills without `.upstream.json` (created during import).
- Cannot retire skills that are still referenced by other skills or docs without updating those references first.
- Does not decide skill vs extension for the user — reads `references/PATTERN-SELECTOR.md` to recommend, user decides.
- All created skills must stay under 300 lines; detail that overflows must move to `references/`.

---

## Design Rules

1. **One skill, one job.** If it does two unrelated things, split it.
2. **SKILL.md is the surface.** Keep it under 300 lines (~6000 tokens). Move detail into `references/`.
3. **Progressive disclosure.** Three tiers:
   - **Metadata** (~100 tokens): `name` + `description` loaded at startup for all skills.
   - **Instructions** (< 6000 tokens): full SKILL.md body loaded when the skill activates.
   - **Resources** (as needed): files in `references/`, `assets/`, `scripts/` loaded only when the task requires them.
4. **Scripts are welcome.** When the agent rewrites the same logic every run, bundle a tested script in `scripts/`. Design scripts for agentic use: no interactive prompts, clear `--help`, structured output, helpful error messages. When a skill needs hooks, typed tools, UI, or persistent state — or has accumulated enough scripts to warrant proper tool registration — promote it to an extension.
5. **Skills can grow into extensions.** See `references/PATTERN-SELECTOR.md` for the decision table and `references/LIFECYCLE.md` for promotion signals.
6. **Inputs and outputs are explicit.** A skill that doesn't define what it consumes and produces cannot be evaluated.
7. **Every skill has at least one failure mode documented.** If you can't think of how it fails, you haven't scoped it well enough.
8. **CLI tools are documented and tracked.** If a skill uses external CLI tools, document them in `compatibility` frontmatter. The meta-skill tracks versions in `.upstream.json` and flags changes during sync.

---

## Task Model

Every dispatch task maps to a dedicated reference file. Keep this SKILL.md focused on routing and rules; keep task procedure in `references/`.

Supporting references like `PATTERN-SELECTOR.md`, `LIFECYCLE.md`, `AUTHORING.md`, and `SELF-AUDIT.md` are loaded by the task files when needed.

## References

| File | Load when... |
|------|-------------|
| `references/CREATE.md` | Creating a new skill from scratch |
| `references/IMPORT.md` | Importing or adapting a skill from an external source |
| `references/SEARCH.md` | Internal: searched automatically during create/import workflows |
| `references/SYNC-UPSTREAM.md` | Reviewing inspiration sources for new upstream ideas |
| `references/SELF-EVOLVE.md` | Running self-audit or self-improve modes |
| `references/IMPROVE.md` | Refactoring, hardening, splitting, merging, or promoting a skill |
| `references/EVALUATION.md` | Testing skill quality before publishing |
| `references/DESCRIPTION-OPTIMIZATION.md` | Description triggers incorrectly (too broad or too narrow) |
| `references/RETIRE.md` | Retiring an obsolete or replaced skill |
| `references/PATTERN-SELECTOR.md` | Deciding skill shape, skill vs. extension, or where to place |
| `references/LIFECYCLE.md` | Promotion and lifecycle signals used by task files |
| `references/AUTHORING.md` | Writing the instructions inside a SKILL.md |
| `references/SELF-AUDIT.md` | Running a portfolio audit across managed skills |
| `scripts/init_skill.py` | Scaffolding a new skill directory |
| `scripts/validate_skill.py` | Automated validation of a skill directory |
| `scripts/package_skill.py` | Creating a distributable .skill archive |
| `assets/templates/SKILL.template.md` | Template source for init_skill.py — edit to change scaffolded SKILL.md structure |
| `assets/templates/.upstream.template.json` | Template source for .upstream.json — created during skill import |
