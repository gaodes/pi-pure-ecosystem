---
name: create-skill
description: >
  Create or scaffold a new Pi skill from a recurring workflow, repeated task, or proven prompt pattern,
  with clear trigger wording, concrete inputs/outputs, and only the resources it needs. Use when the
  user wants to turn existing work into a reusable skill, create a new skill from scratch, discuss skill
  authoring or scaffolding, or says things like "turn this into a skill", "make a skill", or "new
  skill". Not applicable to one-off prompt templates, shell aliases, or extension features that need
  hooks, typed tools, commands, persistent state, or UI components.
---

# Create Skill

Turn a recurring workflow into a focused, reusable Pi skill that is easy for the model to trigger and follow.

## How to use this skill

1. **Intake** — extract examples and requirements from the current conversation first, then ask only for missing gaps. Match jargon to the user's familiarity and explain technical terms briefly if needed. This is the only interactive step until the approval gate.
2. **Autonomous phase** — choose the shape, plan reusable resources, and draft the plan. No user interaction needed.
3. **Approval gate** — present the plan and wait for explicit go/no-go.
4. **Autonomous phase** — scaffold, implement reusable resources, write the skill, self-check, and commit if appropriate. No user interaction needed.

## Inputs

- **Recurring workflow or capability** — the concrete task or behavior to package as a skill.
- **Usage examples or source conversation** — at least one concrete scenario, prompt, or recent interaction to generalize from.
- **Target scope** — project, global, or extension-bundled.
- **Optional constraints** — dependencies, files, environments, success criteria, or explicit non-goals.

## Outputs

- A new skill directory with SKILL.md and only the resource folders the skill actually needs.
- A description that clearly says what the skill does, when to use it, and what stays out of scope.

## Workflow

### 1. Intake (interactive)

First extract what you can from the current conversation: recurring workflow, tools used, corrections the user made, input/output formats, constraints, and any examples already given. Ask only for what is still missing.

Ask:

- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"
- "What should this skill produce or change when it succeeds?"
- "What should this skill definitely not handle?"
- "Are there edge cases where the agent would get this wrong without guidance?"
- "Does this skill depend on any specific tools, files, or environments?"
- "Where should this skill live: this project, globally, or inside an extension?"

Extract from the examples:

- **Name** — kebab-case, 1-64 chars, lowercase + hyphens only, matches directory name.
- **Purpose** — one sentence.
- **Triggers** — when the agent should load this skill.
- **Inputs / Outputs** — what goes in, what comes out.
- **Success criteria** — what “good” looks like for the user.
- **Dependencies** — tools, files, environments, or permissions the skill assumes.
- **Non-goals** — what is explicitly out of scope.
- **Resources** — scripts, references, or assets the skill needs.
- **Scope** — project (`.pi/skills/`), global (`~/.pi/agent/skills/`), or extension-bundled (`extensions/<name>/skills/`).

Default scope rules (use when the user doesn't specify):

| Scope | Location | Use when |
|-------|----------|----------|
| Project | `.pi/skills/` | Tied to a specific repo, project workflow, or codebase convention |
| Global | `~/.pi/agent/skills/` | Works across any project, general-purpose capability |
| Extension-bundled | `extensions/<name>/skills/` | Part of an existing extension package or a cluster of related bundled skills |

Default to **project scope**. Use **extension-bundled** when the skill clearly belongs inside an extension package. Use **global** only when the skill has no project-specific logic and no extension package context.

Prioritize name, purpose, triggers, and scope. The rest can emerge during implementation.

---

*Steps 2-4 are autonomous. Do not ask the user questions during this phase.*

### 2. Shape selection

Pick the smallest architecture that fits.

- If the request is only a reusable prompt template — stop and explain that no skill is needed.
- If the request is only a shell alias or one-off script — stop and suggest a script instead.
- If the request needs hooks, typed tools, UI components, commands, or persistent state — stop and recommend an extension instead.
- Otherwise continue with a single skill.

### 3. Formulate the plan

Compose the proposal:

- skill name and purpose
- trigger examples
- inputs, outputs, and success criteria
- resource plan: what belongs in `scripts/`, `references/`, or `assets/`
- needed directories (`scripts/`, `references/`, `assets/`)
- target location (project, global, or extension-bundled)

### 4. Approval gate (interactive)

Present the plan. Wait for the user's explicit go/no-go.

On approval, proceed autonomously through the remaining steps.

---

*Steps 5-9 are autonomous. Do not ask the user questions during this phase.*

### 5. Scaffold

Create the directory with only the subdirectories the skill actually needs:

```text
<skill-name>/
├── SKILL.md
├── scripts/       # optional — agent would reinvent the same logic each run
├── references/    # optional — domain docs loaded on demand
└── assets/        # optional — templates, schemas, sample data
```

Create the skill directly in its target location: `.pi/skills/`, `~/.pi/agent/skills/`, or `extensions/<name>/skills/`.

For quick scaffolding:

```bash
../../scripts/init_skill.py <skill-name> --path <target-dir> [--resources scripts,references,assets] [--examples]
```

### 6. Implement reusable resources

Build what the skill needs before finalizing the instructions:

- **Scripts** — tested, deterministic, no interactive prompts.
- **References** — domain-specific docs the agent loads on demand.
- **Assets** — templates, schemas, sample data used in output.

Only create directories the skill actually uses. Delete placeholder files if `--examples` was used.

### 7. Write SKILL.md

Read `../../references/AUTHORING.md` before writing.

Follow the required structure from AUTHORING.md: frontmatter (`name`, `description`), `## How to use this skill`, `## Inputs`, `## Outputs`, `## Workflow` (or `## Dispatch`), `## Limits`, optional `## Tools`, and `## References`.

Put all "when to use" guidance in the `description`, not in the body. Make the description specific enough that the skill triggers reliably when the user actually needs it. Be slightly proactive about nearby phrasings and adjacent contexts so the skill does not undertrigger, but keep the description honest and non-misleading.

Prefer imperative instructions. Explain why important constraints matter instead of piling up rigid MUST/NEVER language unless exact commands are truly necessary.

Write a draft, then reread it with fresh eyes and tighten anything vague, repetitive, or overfit to one example.

Keep SKILL.md under 300 lines. Move detail into `references/`.

### 8. Self-check

Before finishing, check the skill manually:

- directory name matches frontmatter `name`
- `description` clearly says what the skill does, when to use it, and what stays out of scope
- the description is specific enough to trigger on adjacent real phrasings and common user wording, not just the exact example wording
- required sections are present
- important constraints explain the why, not just the rule
- SKILL.md stays under 300 lines
- the skill generalizes beyond the intake examples and is not overfit to one prompt
- `references/` exists only when it adds real value
- bundled scripts run without interactive prompts

Quick evaluation target: 3 happy paths, 2 edge cases, 1 failure mode. Use realistic prompts phrased the way a real user would ask.

### 9. Register and commit

Update `AGENTS.md` or project docs if the skill changes how the project works. Pi discovers skills via directory scanning — no separate registry file.

If the target location is inside a git repo, commit using the repo's existing convention. When the repo uses conventional commits, a good default is:

```bash
git add <skill-path>/
git commit -m "feat(<skill-name>): create initial version"
```

## Limits

- Cannot create a skill without at least one concrete usage example — ask the user if none is provided.
- Stops and recommends a prompt, script, or extension when a skill is the wrong shape.
- Created skills must stay under 300 lines; overflow moves to `references/`.
- Bundled scripts must be deterministic and non-interactive — agents cannot answer stdin prompts.
- Do not create misleading skills whose actual behavior would surprise the user.

## Tools

| Script | Usage |
|--------|-------|
| `../../scripts/init_skill.py` | Scaffold a new skill directory from template |

## References

| File | Load when... |
|------|-------------|
| `../../references/AUTHORING.md` | Writing the instructions inside a SKILL.md |
