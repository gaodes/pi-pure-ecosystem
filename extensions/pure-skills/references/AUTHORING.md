# Authoring Patterns

Load when writing the instructions inside a SKILL.md.

Patterns for writing the content inside a SKILL.md. Not every skill needs all of them — use what fits the task.

## Required SKILL.md structure

Every SKILL.md must include these sections:

- **YAML frontmatter** — `name` and `description` (required). Optional: `compatibility`, `allowed-tools`.
- **`## How to use this skill`** — runtime instructions for the agent after it loads.
- **`## Inputs`** — what the skill consumes (concrete types, not vague "user request").
- **`## Outputs`** — what the skill produces.
- **`## Workflow` or `## Dispatch`** — numbered steps the agent follows, or a dispatch table for skills with multiple modes.
- **`## Limits`** — known constraints, failure modes, and when to stop.
- **`## Tools`** *(optional)* — table of bundled scripts with usage. Use when the skill includes executable scripts that don't fit the References "load when..." pattern.
- **`## References`** — table of resource files with "load when..." guidance. State clearly if there are no additional resources yet.

**Recommended order:** How to use → Inputs → Outputs → Workflow (or Dispatch) → Limits → Tools (if needed) → References.

Keep SKILL.md under 300 lines. Move detail into `references/`.

## Writing `## How to use this skill`

**This is not `## Workflow`.** `## How to use this skill` is the *runtime contract* — it tells the agent what to do immediately after the skill loads. `## Workflow` is the *detailed procedure* the agent follows for the actual task.

- **How to use** = routing and activation logic ("read this, then do that")
- **Workflow** = step-by-step execution instructions ("run this command, validate output, present to user")

If the skill is simple, the two may blur together. For meta-skills or multi-mode skills, keep them separate.

Two common patterns for `## How to use this skill`:

**Pattern A: Numbered steps** (most skills)

```markdown
## How to use this skill

1. Read the user's request and identify the target file.
2. Run `scripts/analyze.py <file>` to extract structure.
3. Present findings to the user.
4. Apply approved changes and re-validate.
```

**Pattern B: Dispatch table** (skills with multiple modes)

```markdown
## How to use this skill

1. Read the dispatch table and match the user's request to a task.
2. Read the matched task reference before starting work.
3. Follow the workflow. Ask before proceeding if the request doesn't match any row.
```

**Pattern C: Two-phase autonomy** (skills with an approval gate)

```markdown
## How to use this skill

1. **Intake** — gather requirements from the user. This is the only interactive step until the approval gate.
2. **Autonomous phase** — research, analyze, formulate a plan. No user interaction needed.
3. **Approval gate** — present the plan and wait for explicit go/no-go.
4. **Autonomous phase** — execute the approved plan, validate, commit. No user interaction needed.
```

Mark the boundaries clearly in the workflow with `---` dividers so the agent knows when it may and may not interact with the user.

## Defining `## Inputs` and `## Outputs`

Be concrete. Bad inputs are vague; good inputs tell the agent exactly what to expect.

```markdown
<!-- Vague -->
## Inputs
- User request
- Target file

<!-- Concrete -->
## Inputs
- A file path (absolute or relative)
- Optional: specific fields to analyze (if omitted, analyze all)
- Optional: output format preference (json, markdown, table)
```

Outputs should describe deliverables, not just actions:

```markdown
## Outputs
- Analysis report with findings and recommendations
- Updated file (if changes are approved)
- Validation report confirming no regressions
```

## Documenting `## Limits`

Every skill must document at least one failure mode. Good limits answer:

- **What can go wrong?** — edge cases, malformed input, missing dependencies.
- **When should the agent stop?** — scope boundaries, destructive actions requiring confirmation.
- **What is not handled?** — explicit non-goals the skill does not cover.

```markdown
## Limits
- Cannot process files larger than 10MB.
- Does not handle encrypted or password-protected documents.
- Will not delete files without explicit user confirmation.
- Requires `python3` and `pyyaml` to be installed.
```

## Start from real expertise

The highest-value skills are grounded in real tasks, not generic knowledge. Extract from:
- **Hands-on tasks**: steps that worked, corrections you made, input/output formats, project-specific facts.
- **Existing artifacts**: runbooks, style guides, API specs, code review comments, incident reports, version control history.

Don't ask an LLM to generate a skill from scratch without domain-specific context — you'll get vague procedures, not the specific patterns that make a skill valuable.

**Greenfield skills:** When no prior art exists, start from the user's concrete examples. Extract patterns from 3-5 real prompts or tasks, then generalize. If you have no examples, you don't have a skill yet — you have an idea. Use the `create-skill` skill for the full intake procedure.

## Spending context wisely

Every token in your skill competes for the agent's attention with conversation history, system context, and other active skills.

**Add what the agent lacks, omit what it knows.** Focus on project-specific conventions, domain-specific procedures, non-obvious edge cases, and particular tools or APIs. You don't need to explain what a PDF is or how HTTP works.

```markdown
<!-- Too verbose — the agent already knows this -->
PDF (Portable Document Format) files are a common file format that contains
text, images, and other content. To extract text from a PDF, you'll need to
use a library.

<!-- Better — jumps to what the agent wouldn't know -->
Use pdfplumber for text extraction. For scanned documents, fall back to
pdf2image with pytesseract.
```

Ask about each instruction: "Would the agent get this wrong without this?" If no, cut it.

## Degrees of freedom

Match the level of specificity to the task's fragility and variability.

**High freedom** — text-based instructions with heuristics. Use when multiple approaches are valid and decisions depend on context. Think of an open field where many routes work:

```markdown
## Code review process
1. Check all database queries for SQL injection
2. Verify authentication checks on every endpoint
3. Look for race conditions in concurrent code paths
```

**Medium freedom** — pseudocode or parameterized scripts. Use when a preferred pattern exists and some variation is acceptable:

```markdown
## Generate report
1. Fetch data from `/api/reports` with `start_date` and `end_date`
2. Transform to markdown table using `scripts/format_table.py --input data.json`
3. Add executive summary at the top
4. Write to `<output-path>` (default: `report.md`)
```

**Low freedom** — exact commands, specific scripts, few parameters. Use when operations are fragile, consistency is critical, or a specific sequence must be followed. Think of a narrow bridge with cliffs — it needs specific guardrails:

```markdown
## Database migration
Run exactly this sequence:
python scripts/migrate.py --verify --backup
Do not modify the command or add additional flags.
```

Most skills have a mix. Calibrate each part independently. When instructions explain *why*, agents follow them more reliably — they make better context-dependent decisions when they understand the purpose.

## When to ask vs decide

Agents face ambiguity constantly. Give explicit guidance on when to ask the user and when to make a reasonable assumption:

| Ask the user | Decide autonomously |
|--------------|---------------------|
| Destructive or irreversible actions | Safe, reversible operations |
| Missing required input | Sensible defaults are available |
| Multiple equally valid approaches with different trade-offs | One approach is clearly preferred |
| The user said "maybe" or "consider" | The user gave a clear directive |
| Ambiguous phrasing like "try this" or "see if you can" | The request is specific and actionable |

Default stance: **ask when uncertain, decide when confident.** If the skill has a `--dry-run` or preview mode, use it to show the user what would happen before asking for confirmation.

## Script design principles

When a skill bundles a script, design it for agentic use:

- **No interactive prompts** — agents cannot answer stdin prompts. Use CLI flags and environment variables.
- **Structured output** — default to JSON, TSV, or markdown tables that the agent can parse.
- **Clear `--help`** — document every flag so the agent knows what to pass.
- **Helpful error messages** — exit with a descriptive message, not just a non-zero code.
- **Idempotent where possible** — running twice should not corrupt state.
- **Dry-run support** — for destructive operations, support `--dry-run` so the agent can preview changes.

```markdown
## Script usage
Run: `scripts/analyze_schema.py --input schema.yaml --format json`
```

## Provide defaults, not menus

When multiple tools or approaches could work, pick a default and mention alternatives briefly — don't present equal options.

```markdown
<!-- Too many options -->
You can use pypdf, pdfplumber, PyMuPDF, or pdf2image...

<!-- Clear default with escape hatch -->
Use pdfplumber for text extraction.
For scanned PDFs requiring OCR, use pdf2image with pytesseract instead.
```

## Favor procedures over declarations

Teach the agent *how to approach* a class of problems, not *what to produce* for a specific instance.

```markdown
<!-- Specific answer — only useful for this exact task -->
Join the `orders` table to `customers` on `customer_id`, filter where
`region = 'EMEA'`, and sum the `amount` column.

<!-- Reusable method — works for any analytical query -->
1. Read the schema from `references/schema.yaml` to find relevant tables
2. Join tables using the `_id` foreign key convention
3. Apply any filters from the user's request as WHERE clauses
4. Aggregate numeric columns and format as a markdown table
```

Specific details (output format templates, constraints, tool-specific instructions) are valuable — the *approach* should generalize even when individual details are specific.

## Description as primary trigger

All "when to use" information belongs in the `description` field, not the body. The body is only loaded after the skill triggers — a "When to Use This Skill" section in the body is useless because the agent has already decided to load the skill by then.

```yaml
# Good — triggers are in the description
description: >
  Create, fill, and analyze DOCX documents with tracked changes, comments,
  and formatting preservation. Use when working with .docx files for creating,
  editing, or extracting text.
```

## Frontmatter fields

Beyond `name` and `description`, two optional fields are useful:

- **`compatibility`** — list runtime dependencies (Node version, Python packages, OS constraints). The agent checks these before proceeding.
- **`allowed-tools`** — optional. Lists tool names the skill is pre-approved to use, reducing permission friction for known-safe operations.

**CLI tools in `compatibility`:** If the skill depends on external CLI tools, document them compactly:

```yaml
compatibility: "CLI: git>=2.40, python3>=3.10, biome>=1.5"
```

Format: `CLI: tool1>=version, tool2>=version, ...` — keep it under 500 chars total. If the skill has `.upstream.json`, record checked tool versions there under `cliTools` for later review.

Only add these when they prevent real failures. Empty or generic compatibility strings are noise.

## Progressive disclosure patterns

Three concrete ways to structure SKILL.md for on-demand loading.

**Pattern 1: High-level guide with references**

Keep core workflow in SKILL.md, link to detailed guides:

```markdown
# PDF Processing

## Quick start
Extract text with pdfplumber: [code example]

## Advanced features
- **Form filling**: See `references/FORMS.md`
- **API reference**: See `references/API.md`
- **Examples**: See `references/EXAMPLES.md`
```

**Pattern 2: Domain-specific organization**

Organize by domain so the agent loads only what's relevant:

```
data-skill/
├── SKILL.md              # Overview and routing
└── references/
    ├── finance.md         # Revenue, billing metrics
    ├── sales.md           # Opportunities, pipeline
    └── marketing.md       # Campaigns, attribution
```

**Pattern 3: Conditional details**

Show basic content inline, link to advanced content:

```markdown
# DOCX Processing

## Creating documents
Use docx-js for new documents. See `references/DOCX-JS.md`.

## Editing documents
For simple edits, modify the XML directly.
**For tracked changes**: See `references/REDLINING.md`
**For OOXML details**: See `references/OOXML.md`
```

## What to include

A skill directory contains only what the agent needs:

- `SKILL.md` — required. The single source of truth.
- `scripts/` — optional. Executable logic the agent would otherwise rewrite each run.
- `references/` — optional. Domain-specific docs loaded on demand.
- `assets/` — optional. Templates, schemas, sample data used in output.
- `.upstream.json` — optional. Tracks inspiration sources or import origin. Create from `assets/templates/.upstream.template.json` when the skill was inspired by remote skills or imported from an external source. Use `primary` for the canonical upstream when one exists, `sources` for secondary inspirations, and `cliTools` for checked CLI tool versions.

## What not to include

Do NOT create:

- `README.md` — the SKILL.md is the documentation.
- `INSTALLATION_GUIDE.md` — dependencies belong in `compatibility` frontmatter.
- `CHANGELOG.md` — lifecycle tracking belongs in project docs, not the skill.
- `QUICK_REFERENCE.md` — if it's quick, it belongs in SKILL.md. If it's long, it belongs in `references/`.

## Directory usage guide

| Directory | What goes here | When to use |
|-----------|---------------|-------------|
| `scripts/` | Executable scripts (Python, bash, etc.) | When the agent would reinvent the same logic on every run |
| `references/` | Markdown docs with domain detail | When the skill covers multiple domains or has deep content |
| `assets/` | Templates, schemas, JSON samples | When the agent needs a concrete structure to pattern-match against |

## Gotchas sections

The highest-value content in many skills. Environment-specific facts that defy reasonable assumptions — not general advice, but concrete corrections to mistakes the agent will make without being told:

```markdown
## Gotchas
- The `users` table uses soft deletes. Queries must include
  `WHERE deleted_at IS NULL` or results will include deactivated accounts.
- The user ID is `user_id` in the database, `uid` in the auth service,
  and `accountId` in the billing API. All three refer to the same value.
- The `/health` endpoint returns 200 even if the database is down.
  Use `/ready` to check full service health.
```

**Decision criteria:**
- **1-3 gotchas** → inline in `## Limits` or a short `## Gotchas` section in SKILL.md
- **4+ gotchas** → `references/GOTCHAS.md`, loaded with explicit guidance like "Read `references/GOTCHAS.md` when you encounter an unexpected error"
- **Gotchas the agent won't recognize as relevant** → must stay in SKILL.md. If the agent only learns about the soft-delete trap *after* querying deactivated accounts, the separate reference failed.

A separate reference works only if you tell the agent exactly when to load it. For non-obvious issues, the agent may not recognize the trigger on its own.

When an agent makes a mistake you have to correct, add the correction to the gotchas section.

## Output format templates

When you need output in a specific format, provide a template. Agents pattern-match well against concrete structures.

```markdown
## Report structure

# [Analysis Title]

## Executive summary
[One-paragraph overview of key findings]

## Key findings
- Finding 1 with supporting data
- Finding 2 with supporting data

## Recommendations
1. Specific actionable recommendation
2. Specific actionable recommendation
```

Short templates live inline in SKILL.md. Longer ones go in `assets/` and load only when needed.

## Checklists for multi-step workflows

An explicit checklist helps the agent track progress and avoid skipping steps:

```markdown
## Form processing workflow

- [ ] Step 1: Analyze the form
- [ ] Step 2: Create field mapping
- [ ] Step 3: Validate mapping
- [ ] Step 4: Fill the form
- [ ] Step 5: Verify output
```

## Error handling and recovery

When a tool, script, or step fails, the agent needs explicit guidance:

```markdown
## Handling failures
- If `scripts/analyze.py` exits non-zero: read stderr, fix the input, retry once.
- If retry fails: present the error to the user and ask how to proceed.
- If the API rate-limits: wait 5 seconds and retry with exponential backoff (max 3 attempts).
- If a required file is missing: stop immediately and inform the user — do not guess a substitute.
```

Rules of thumb:
- **Retry once** for transient failures (network, rate limits, file locks).
- **Ask the user** for persistent failures or missing required input.
- **Stop and report** for safety violations or scope breaches.

## Validation loops

Instruct the agent to validate its own work before moving on: do the work, run a validator, fix issues, repeat until validation passes.

```markdown
## Editing workflow
1. Make your edits
2. Run the project's linter/formatter (e.g. `biome check`, `eslint`, `black`)
3. If validation fails: review the error, fix, run validation again
4. Only proceed when validation passes
```

A reference document can also serve as the validator — instruct the agent to check its work against the reference before finalizing.

## Plan-validate-execute

For batch or destructive operations: create an intermediate plan, validate it against a source of truth, then execute.

```markdown
## PDF form filling
1. Extract form fields → `form_fields.json`
2. Create `field_values.json` mapping each field to its value
3. Validate: check every field name exists, types are compatible, required fields present
4. If validation fails, revise and re-validate
5. Fill the form
```

The key is step 3: validation checks the plan against reality before anything irreversible happens.
