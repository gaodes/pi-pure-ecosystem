---
name: create
description: >
  Create a new Pi skill from scratch with clear triggers, inputs/outputs, and only the resources it needs.
disable-model-invocation: true
---

# Create a New Skill

Create a new Pi skill from scratch.

## Goal

Turn a recurring agent task into a focused skill with clear triggers, explicit inputs/outputs, and only the resources it actually needs.

## Workflow

### 1. Intake from concrete examples

Before collecting abstract specs, understand how the skill will actually be used. Ask:
- "Can you give examples of how this skill would be used?"
- "What would a user say that should trigger this skill?"
- "Are there edge cases where the agent would get this wrong without guidance?"

From the examples, extract:
- **Name**: kebab-case, matches directory name, 1-64 chars, lowercase + hyphens only.
- **Purpose**: one sentence.
- **Triggers**: when should the agent load this skill?
- **Inputs**: what does it need?
- **Outputs**: what does it produce?
- **Tools** *(optional)*: which of the agent's tools does it use, if known.
- **Non-goals**: what is explicitly out of scope?
- **Resources**: from the examples, what scripts, references, or assets would help on repeated runs?

If the user hasn't provided these, ask. Don't guess. Prioritize name + purpose + triggers — the rest can emerge during implementation.

### 2. Research existing skills (automatic)

The agent **automatically** searches remote registries for skills that overlap with or inspire the new skill before proposing a design. This step runs without asking the user — it is a prerequisite embedded in the Create workflow.

Extract **up to 3 keywords** from the intake: proposed name (always), primary action/domain, and a secondary term if needed.

**Local check (fast) — check all Pi skill locations:**
```bash
for dir in ~/.pi/agent/skills ~/.agents/skills .pi/skills .agents/skills skills; do
  test -d "$dir/<proposed-name>" && echo "EXISTS in $dir" || true
done
```

**Remote search:**
```bash
npx skills find "<keyword>"
npx -y skill-search-cli --remote "<keyword>" --json
```

Run both tools per keyword. Tool A returns up to 10 results; Tool B returns up to 6. Sort both by install count descending, then deduplicate across tools per `../references/SEARCH.md`.

**Stop early** — if a clear duplicate (same name + overlapping purpose found locally) is found, report it and stop all keyword searches.

**If search tools fail** (network error, command not found): skip remote search and continue. Report "Remote skill search unavailable — proceeding without it."

**Include findings in the plan presented to the user:**
- Duplicate found → suggest using Improve workflow instead
- Same domain → list as inspiration source
- Complementary → note for cross-referencing
- No matches → note that the skill fills a gap

### 3. Shape selection

Read `../references/PATTERN-SELECTOR.md` and pick the smallest architecture that fits.

If the answer is "plain prompt" or "bash script" — say so. Explain why this doesn't need a skill and suggest what to do instead. If a reusable prompt template or prompt-engineering guidance would help, read the `meta-prompt` skill. Then stop — do not proceed to scaffolding.

### 4. Propose the plan

Before creating files, summarize the plan for the user:
- proposed skill name
- one-sentence purpose
- trigger examples
- expected inputs and outputs
- which directories are needed (`scripts/`, `references/`, `assets/`)
- whether the skill is local-only or project-scoped
- **search findings**: any remote skills found (or "fills a gap — no matches")

If anything important is still unclear, ask before proceeding.

### 5. Get approval

Get approval for the proposed name, scope, and resource layout before scaffolding. For straightforward skills, a concise confirmation is enough; for broader or higher-stakes skills, get explicit approval.

### 6. Scaffold

Create the directory and only the subdirectories the skill actually needs:

```text
<skill-name>/
├── SKILL.md
├── scripts/             # Optional — only if the agent would reinvent the same logic each run
├── references/          # Optional — only if needed
│   └── <topic>.md       # One level deep from SKILL.md — avoid nested chains
└── assets/              # Optional — only if templates or examples help
```

For quick scaffolding from the project root, run:

```bash
../scripts/init_skill.py <skill-name> --path skills [--resources scripts,references,assets] [--examples]
```

If the skill belongs somewhere else, replace `skills` with the approved target directory.

### 7. Write SKILL.md

Read `../references/AUTHORING.md` before writing the skill instructions.

**SKILL.md must include:**
- YAML frontmatter with `name` and `description` (required). Optional fields: `compatibility`, `allowed-tools`.
- `## How to use this skill` — runtime instructions for the agent after it loads.
- `## Inputs` / `## Outputs` — what goes in and comes out.
- `## Workflow` — numbered steps the agent follows.
- `## Limits` — known constraints and failure modes. Document at least one failure mode and how the skill handles errors.
- `## References` — table of resource files with "load when..." guidance. If the skill has no extra resources yet, keep the section and state clearly that there are no additional resources yet — do not invent fake files.
- **CLI tools** — if the skill uses external CLI tools (git, python3, biome, etc.), document them in the `compatibility` frontmatter:
  ```yaml
  compatibility: "CLI: git>=2.40, python3>=3.10, biome>=1.5"
  ```
  Keep it compact to stay under the 500-char limit. The agent extracts these during validation and tracks them in `.upstream.json`.

For guidance on writing each section, see `../references/AUTHORING.md`:
- `## How to use this skill` → "Writing `## How to use this skill`"
- `## Inputs` / `## Outputs` → "Defining `## Inputs` and `## Outputs`"
- `## Workflow` → "Degrees of freedom", "Provide defaults, not menus"
- `## Limits` → "Documenting `## Limits`", "Error handling and recovery"
- `## References` → "Progressive disclosure patterns"

Write the core instructions before building extras. The skill should still be useful if no scripts or assets are added.

### 8. Implement resources

From the intake examples, build what the skill actually needs:
- **Scripts** — tested, deterministic, no interactive prompts. Run them to verify they work.
- **References** — domain-specific docs the agent loads on demand.
- **Assets** — templates, schemas, sample data used in output.

Only create directories the skill actually needs. See `../references/AUTHORING.md` → "What to include" and "Directory usage guide" for what belongs in each directory.

Delete placeholder files if `--examples` was used.

### 9. Validate

Validation checks structure; evaluation checks function.

Check against Pi skill rules:
- `name` matches parent directory name exactly.
- `name` is lowercase, hyphens only, no leading/trailing/consecutive hyphens.
- `description` is specific and under 1024 chars.
- All "when to use" information is in the `description` field, not the body.
- Frontmatter has at minimum `name` and `description`.
- SKILL.md is under 300 lines / ~6000 tokens.
- At least one trigger condition is defined.
- At least one failure mode is documented.
- Every file in `references/` is listed in `## References` with "load when..." guidance, and every file listed there exists on disk.
- File references are one level deep from SKILL.md.
- If the skill has scripts, they are tested, deterministic, and referenced from SKILL.md with usage guidance.
- No extraneous files (README.md, CHANGELOG.md, INSTALLATION_GUIDE.md, etc.).
- `allowed-tools` is set if the skill needs specific tool pre-approvals (optional, experimental).

For automated validation:

```bash
../scripts/validate_skill.py <skill-path>
```

Fix any violations before proceeding.

### 10. Evaluate

Read `../evaluate/SKILL.md`.
- For simple skills, quick checks (3 happy + 2 edge + 1 failure) are sufficient.
- For skills for repeated team use, run structured eval with the `evals/evals.json` format.

### 11. Optimize description

Read `../optimize-description/SKILL.md`.
- For most skills, a quick sanity check with 5-10 prompts is enough.
- For skills with trigger problems, run the full optimization loop.

### 12. Register intent

Record the skill's existence in the project's knowledge — update `AGENTS.md` or relevant docs if the skill changes how the project works. There is no separate registry file; Pi discovers skills via directory scanning.

### 13. Commit

Commit the new skill with a descriptive message:

```bash
git add <skill-path>/
git commit -m "<skill-name>: create initial version"
```
