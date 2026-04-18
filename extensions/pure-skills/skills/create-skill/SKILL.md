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

1. **Intake** — gather examples and scope from the user. This is the only interactive step until the approval gate.
2. **Autonomous phase** — research, shape selection, plan formulation. No user interaction needed.
3. **Approval gate** — present the plan and wait for explicit go/no-go.
4. **Autonomous phase** — scaffold, write, validate, evaluate, commit. No user interaction needed.

## Inputs

- **User request** — what capability to package as a skill.
- **Usage examples** — at least one concrete scenario (ask if not provided).
- **Scope** — project or global (ask if not provided).

## Outputs

- A skill directory with valid SKILL.md, committed to git.

## Workflow

### 1. Intake (interactive)

Gather everything needed to proceed autonomously. Ask:

- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"
- "Are there edge cases where the agent would get this wrong without guidance?"
- "Should this skill live in this project only, or be available globally?"

Extract from the examples:

- **Name** — kebab-case, 1-64 chars, lowercase + hyphens only, matches directory name.
- **Purpose** — one sentence.
- **Triggers** — when the agent should load this skill.
- **Inputs / Outputs** — what goes in, what comes out.
- **Non-goals** — what is explicitly out of scope.
- **Resources** — scripts, references, or assets the skill needs.
- **Scope** — project (`.pi/skills/`) or global (`~/.pi/agent/skills/`).

Default scope rules (use when the user doesn't specify):

| Scope | Location | Use when |
|-------|----------|----------|
| Project | `.pi/skills/` | Tied to a specific repo, project workflow, or codebase convention |
| Global | `~/.pi/agent/skills/` | Works across any project, general-purpose capability |

Default to **project scope**. Escalate to global only when the skill has no project-specific logic.

Prioritize name + purpose + triggers + scope. The rest can emerge during implementation.

---

*Steps 2-5 are autonomous. Do not ask the user questions during this phase.*

### 2. Research existing skills (automatic)

Read `../../references/SEARCH.md` and follow its workflow: extract up to 3 keywords from the intake, search local directories and remote registries, deduplicate, and report findings.

If a duplicate exists locally, include a recommendation to improve the existing skill instead.

If any remote skills are marked as **Inspiration** or **Overlap**, preserve them in `.upstream.json` created from `../../assets/templates/.upstream.template.json`.

Use `primary` when one upstream clearly dominates. Record all other inspirations under `sources` with what they contributed. If no remote skills matched, skip the file.

### 3. Shape selection

Read `../../references/PATTERN-SELECTOR.md` and pick the smallest architecture that fits.

If the request is a **plain prompt** or **bash script** — stop autonomous work and report back to the user. Explain why this doesn't need a skill and suggest what to do instead. Do not proceed to the approval gate.

### 4. Formulate the plan

Compose the proposal:

- skill name and purpose
- trigger examples
- inputs and outputs
- directories needed (`scripts/`, `references/`, `assets/`)
- target location (from scope decided in step 1)
- search findings: existing skills found, or "fills a gap"

### 5. Approval gate (interactive)

Present the plan. Wait for the user's explicit go/no-go.

On approval, proceed autonomously through the remaining steps.

---

*Steps 6-11 are autonomous. Do not ask the user questions during this phase.*

### 6. Scaffold

Create the directory with only the subdirectories the skill actually needs:

```text
<skill-name>/
├── SKILL.md
├── .upstream.json  # optional — created when research found inspiration sources
├── scripts/       # optional — agent would reinvent the same logic each run
├── references/    # optional — domain docs loaded on demand
└── assets/        # optional — templates, schemas, sample data
```

For quick scaffolding:

```bash
../../scripts/init_skill.py <skill-name> --path <target-dir> [--resources scripts,references,assets] [--examples] [--upstream]
```

### 7. Write SKILL.md

Read `../../references/AUTHORING.md` before writing.

Follow the required structure from AUTHORING.md: frontmatter (`name`, `description`), `## How to use this skill`, `## Inputs`, `## Outputs`, `## Workflow` (or `## Dispatch`), `## Limits`, optional `## Tools`, and `## References`.

Keep SKILL.md under 300 lines. Move detail into `references/`.

### 8. Implement resources

Build what the skill needs:

- **Scripts** — tested, deterministic, no interactive prompts.
- **References** — domain-specific docs the agent loads on demand.
- **Assets** — templates, schemas, sample data used in output.

Only create directories the skill actually uses. Delete placeholder files if `--examples` was used.

If `.upstream.json` was scaffolded, replace the template placeholders with real URLs, SHAs when known, notes about adopted patterns, and any checked CLI tool versions.

### 9. Validate

Run automated validation and fix any violations:

```bash
../../scripts/validate_skill.py <skill-path>
```

### 10. Quick evaluation

Sanity-check the new skill:

- 3 happy-path scenarios + 2 edge cases + 1 failure mode.
- Verify the `description` triggers correctly with 5-10 test prompts.

### 11. Register and commit

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
| `../../assets/templates/.upstream.template.json` | Creating `.upstream.json` when search found inspiration sources |
