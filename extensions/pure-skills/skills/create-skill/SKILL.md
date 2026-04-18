---
name: create-skill
description: >
  Create a new Pi skill from scratch with clear triggers, inputs/outputs, and only the resources it needs.
  Use when the user wants to build a new skill, asks about creating a skill, mentions skill authoring or
  scaffolding, or says "make a skill" or "new skill".
---

# Create Skill

Turn a recurring agent task into a focused, well-structured Pi skill.

## How to use this skill

1. Gather concrete usage examples from the user (step 1).
2. Search for existing skills that overlap or inspire (step 2).
3. Pick the smallest architecture that fits (step 3).
4. Decide scope: project or global (step 4).
5. Get approval for the plan, then scaffold, write, validate, and commit.

## Inputs

- **User request** — what capability to package as a skill.
- **Usage examples** — at least one concrete scenario (ask if not provided).
- **Target directory** — where the skill lives. Defaults: `.pi/skills/` (project-scoped) or `~/.pi/agent/skills/` (global).

## Outputs

- A skill directory with valid SKILL.md, committed to git.

## Workflow

### 1. Intake

Understand how the skill will be used before writing specs. Ask:

- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"
- "Are there edge cases where the agent would get this wrong without guidance?"

Extract from the examples:

- **Name** — kebab-case, 1-64 chars, lowercase + hyphens only, matches directory name.
- **Purpose** — one sentence.
- **Triggers** — when the agent should load this skill.
- **Inputs / Outputs** — what goes in, what comes out.
- **Non-goals** — what is explicitly out of scope.
- **Resources** — scripts, references, or assets the skill needs.

Prioritize name + purpose + triggers. The rest can emerge during implementation.

### 2. Research existing skills (automatic)

Search for existing skills before proposing a design. This runs without asking the user.

Read `../../references/SEARCH.md` and follow its workflow: extract up to 3 keywords from the intake, search local directories and remote registries, deduplicate, and report findings.

Include the findings in the plan (step 4). If a duplicate exists locally, suggest improving it instead of creating a new one.

### 3. Shape selection

Read `../../references/PATTERN-SELECTOR.md` and pick the smallest architecture that fits.

If the request is a **plain prompt** or **bash script** — stop. Explain why this doesn't need a skill and suggest what to do instead. Do not proceed to scaffolding.

### 4. Select scope

Decide where the skill lives:

| Scope | Location | Use when |
|-------|----------|----------|
| Project | `.pi/skills/` | Tied to a specific repo, project workflow, or codebase convention |
| Global | `~/.pi/agent/skills/` | Works across any project, general-purpose capability |

Default to **project scope**. Escalate to global only when the skill has no project-specific logic and would be useful in every session.

If the user specified a target directory, respect it.

### 5. Propose the plan

Summarize for the user:

- skill name and purpose
- trigger examples
- inputs and outputs
- directories needed (`scripts/`, `references/`, `assets/`)
- target location (see defaults in Inputs)
- search findings: existing skills found, or "fills a gap"

Ask if anything is unclear before proceeding.

### 6. Get approval

Confirm the name, scope, and resource layout. Concise confirmation for straightforward skills; explicit approval for high-stakes ones.

### 7. Scaffold

Create the directory with only the subdirectories the skill actually needs:

```text
<skill-name>/
├── SKILL.md
├── scripts/       # optional — agent would reinvent the same logic each run
├── references/    # optional — domain docs loaded on demand
└── assets/        # optional — templates, schemas, sample data
```

For quick scaffolding:

```bash
../../scripts/init_skill.py <skill-name> --path <target-dir> [--resources scripts,references,assets] [--examples]
```

### 8. Write SKILL.md

Read `../../references/AUTHORING.md` before writing.

Follow the required structure from AUTHORING.md: frontmatter (`name`, `description`), `## How to use this skill`, `## Inputs`, `## Outputs`, `## Workflow` (or `## Dispatch`), `## Limits`, `## References`.

Keep SKILL.md under 300 lines. Move detail into `references/`.

### 9. Implement resources

Build what the skill needs:

- **Scripts** — tested, deterministic, no interactive prompts.
- **References** — domain-specific docs the agent loads on demand.
- **Assets** — templates, schemas, sample data used in output.

Only create directories the skill actually uses. Delete placeholder files if `--examples` was used.

### 10. Validate

Run automated validation and fix any violations:

```bash
../../scripts/validate_skill.py <skill-path>
```

### 11. Quick evaluation

Sanity-check the new skill:

- 3 happy-path scenarios + 2 edge cases + 1 failure mode.
- Verify the `description` triggers correctly with 5-10 test prompts.

### 12. Register and commit

Update `AGENTS.md` or project docs if the skill changes how the project works. Pi discovers skills via directory scanning — no separate registry file.

```bash
git add <skill-path>/
git commit -m "<skill-name>: create initial version"
```

## Limits

- Cannot create a skill without at least one concrete usage example — ask the user if none provided.
- Recommends skill vs extension via PATTERN-SELECTOR.md but does not decide for the user.
- Created skills must stay under 300 lines; overflow moves to `references/`.
- Remote search is advisory — proceeds without it if tools are unavailable.
- Bundled scripts must be deterministic and non-interactive — agents cannot answer stdin prompts.

## Tools

| Script | Usage |
|--------|-------|
| `../../scripts/init_skill.py` | Scaffold a new skill directory from template |
| `../../scripts/validate_skill.py` | Validate skill structure against Pi rules |

## References

| File | Load when... |
|------|-------------|
| `../../references/AUTHORING.md` | Writing the instructions inside a SKILL.md |
| `../../references/PATTERN-SELECTOR.md` | Deciding skill shape, skill vs. extension, where to place |
| `../../references/SEARCH.md` | Searching remote and local skill registries |
| `../../references/LIFECYCLE.md` | Promotion and lifecycle signals |
