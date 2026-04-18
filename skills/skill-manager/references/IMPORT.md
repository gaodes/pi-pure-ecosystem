# Import a Skill

Analyze one or more external skill sources, plan the adaptation, and produce a skill that follows the project's conventions. Sources can be Pi agent skills, Codex/OpenAI skills, Claude skills, `.skill` archives, or any agent skill format.

---

## Phase 1: Analysis

### 1. Gather sources

The user provides at least one link or reference: a GitHub repo, a `.skill` file, a directory path, or a description of where the skill lives.

For each source:
- **GitHub repo**: clone shallowly into `/tmp/` and scan the skill directory.
- **`.skill` archive**: unzip and inspect the contents.
- **Local path**: read in place.
- **Inline description**: the user describes a skill from another agent — treat this as a spec, not code.

```bash
git clone --depth 1 <repo-url> /tmp/<source-name>
# or
unzip <file>.skill -d /tmp/<source-name>
```

For each source, identify:
- **Format**: Pi skill, Codex skill, Claude skill, generic markdown, or other.
- **Structure**: does it have `SKILL.md`, references, scripts, assets?
- **Quality**: is it well-written, tested, production-grade, or a rough draft?
- **License**: what license does it carry? If unlicensed or proprietary, **stop and inform the user**.
- **Lineage**: does the source credit inspirations or fork from another project? Trace the chain.

Clean up temporary clones after Phase 2 is complete:
```bash
rm -rf /tmp/<source-name>
```

### 2. Analyze and decide

Analyze all sources together with the user's request:

**Primary source** (if multiple):
- Pick the highest-quality or most-complete source as the base.
- Note improvements from other sources for future implementation.

**Format conversion** — detect the source format and plan conversion:

| Source format | Conversion |
|---------------|-----------|
| Pi skill (SKILL.md + YAML frontmatter) | Minimal — rename, strip, adapt conventions |
| Codex skill (instructions.md or similar) | Add YAML frontmatter, restructure into SKILL.md + references |
| Claude skill (CLAUDE.md convention) | Extract relevant sections, add YAML frontmatter, restructure |
| Generic markdown | Wrap in SKILL.md with frontmatter, split long content into references |
| `.skill` archive | Unzip, inspect, treat as Pi skill |

**Approach:**

| Approach | When to use |
|----------|------------|
| **Adapt** | The source is well-structured and mostly compatible. Rename, strip non-essential parts, add missing sections. |
| **Rewrite** | The source is messy, uses wrong patterns, or the user wants significant changes. Use it as a reference but write clean. |
| **Extract** | The source contains useful knowledge buried in a larger document. Extract the relevant parts into a focused skill. |

**Name:**
- Name should reflect what the skill does, not where it came from.
- Avoid names that conflict with existing skills or extensions.

**Check for conflicts:**
```bash
ls skills/<skill-name>/ 2>/dev/null && echo "EXISTS" || echo "OK"
```
If the directory already exists, pick a different name or use the Improve workflow instead.

### 3. Present analysis for approval

Present to the user:
- Primary source (why chosen) + upstream lineage
- Source format and planned conversion
- Approach (adapt, rewrite, or extract) with rationale
- Proposed name (`<skill-name>`)
- Features to keep vs. strip vs. rewrite
- License status

Get user approval before proceeding.

### 4. Research existing skills (automatic)

The agent **automatically** searches remote registries for skills that overlap with or complement the imported skill before creating the plan. This step runs without asking the user — it is a prerequisite embedded in the Import workflow.

Extract **up to 3 keywords** from the source skill: name (always), primary action/domain, and a secondary term if needed.

**Local check (fast):**
```bash
ls skills/<proposed-name>/ 2>/dev/null && echo "EXISTS" || echo "OK"
```

**Remote search:**
```bash
npx skills find "<keyword>"
npx -y skill-search-cli --remote "<keyword>" --json
```

Run both tools per keyword. Tool A returns up to 10 results; Tool B returns up to 6. Sort both by install count descending, then deduplicate across tools per `references/SEARCH.md`.

**Stop early** — if a clear duplicate (same name + overlapping purpose found locally) is found, report it and stop all keyword searches.

**If search tools fail** (network error, command not found): skip remote search and continue. Report "Remote skill search unavailable — proceeding without it."

**Include findings in the plan presented to the user:**
- **Remote skills found**: count and relevance (after deduplication)
- **Local conflicts**: name already exists, features already covered
- **Features to adopt**: from matching skills, add to the plan's "Keep" or "Rewrite" sections
- **Complementary skills**: note skills that work alongside this one for cross-referencing
- **Remote inspiration sources**: note high-quality remote skills to reference in `## Sources`
- **Gap confirmation**: "No matches found — skill fills a gap"

If no matches are found, state that explicitly.

---

## Phase 2: Planning

### 5. Create a plan

Create the plan as an inline summary presented to the user. Include:

- **Source**: repo URL or file path, commit SHA, license
- **Approach**: adapt / rewrite / extract
- **Conversion steps**: what changes from source format to Pi skill format
- **Keep**: features and content to preserve
- **Strip**: content that doesn't apply (agent-specific config, irrelevant scripts)
- **Rewrite**: content that needs restructuring for Pi conventions
- **Name**: `<skill-name>`
- **Resources needed**: which of `scripts/`, `references/`, `assets/` the imported skill will use

**Do not proceed to implementation until the user explicitly approves the plan.**

### 6. Scaffold the target

Create the skill directory:

```bash
scripts/init_skill.py <skill-name> --path skills [--resources scripts,references,assets]
```

Or create manually following the scaffold structure in SKILL.md.

---

## Phase 3: Implement & Validate

### 7. Adapt the content

**If adapting:**
- Copy the source SKILL.md (or equivalent) into the new directory.
- Rewrite the YAML frontmatter: set `name` to `<skill-name>`, write a new `description` following the trigger guidelines in `references/DESCRIPTION-OPTIMIZATION.md`.
- Restructure sections to match the required template: `## How to use this skill`, `## Inputs`, `## Outputs`, `## Workflow`, `## Limits`, `## References`.
- Move long sections into `references/` files — keep SKILL.md under 300 lines.
- Convert scripts if needed: Codex scripts (Python with `argparse`, `input()`) need adaptation for agentic use (no interactive prompts, structured output).
- Update all internal file references to match the new directory structure.

**If rewriting:**
- Use the source as reference material only.
- Write SKILL.md from scratch following the scaffold template.
- Implement only the features approved in the plan.

**If extracting:**
- Identify the relevant sections in the source.
- Create a focused SKILL.md that covers only the extracted domain.
- Link to the source in the References section for context.

**For all approaches:**
- Apply authoring patterns from `references/AUTHORING.md`.
- Calibrate degrees of freedom — imported skills are often either too rigid or too vague.
- Add gotchas specific to the target environment (Pi vs. the source agent).
- Ensure `description` carries all trigger information per `references/DESCRIPTION-OPTIMIZATION.md`.
- Preserve license attribution. Add a `## Sources` section to SKILL.md or a `references/SOURCES.md` file with full lineage:

```markdown
## Sources
- **Primary**: [<repo-name>](<url>) — <license-type>
- **Inspirations**: [<upstream>](<url>) — <license-type>
```

- Create `.upstream.json` in the skill root from the template in `assets/templates/.upstream.template.json`. Fill in the primary URL, commit SHA, and `lastReviewed` date. Add secondary sources if the skill drew from multiple repos.
- Extract CLI tools from the skill's scripts and content. Document them in the `compatibility` frontmatter:
  ```yaml
  compatibility: "CLI: git>=2.40, python3>=3.10"
  ```
  Then record them in `.upstream.json` under `cliTools` with the current system version:
  ```json
  "cliTools": [
    { "name": "git", "version": "2.42.0", "checkedAt": "2026-04-18" }
  ]
  ```

### 8. Validate

Run the validation checklist from SKILL.md:

```bash
scripts/validate_skill.py skills/<skill-name>
```

Fix any violations. Common import issues:
- Name doesn't match directory.
- Description is vague or missing trigger conditions.
- `## References` table missing or incomplete.
- Scripts have interactive prompts or non-deterministic output.
- Extraneous files carried over from the source (README.md, .github/, CI configs).

### 9. Test triggering

Quick trigger check — write 5-10 realistic prompts that should activate the skill, and 5 that should not. Run them through the agent and verify the `description` triggers correctly.

See `references/DESCRIPTION-OPTIMIZATION.md` for the full optimization process if triggering is off.

### 10. Commit

```bash
git add skills/<skill-name>/
git commit -m "<skill-name>: import from <source-name>"
```

Clean up temporary files:
```bash
rm -rf /tmp/<source-name>
```

---

## Import-Specific Rules

1. **License preservation** — check source license before importing. Preserve attribution. If unlicensed or proprietary, stop and inform the user.
2. **Format conversion** — detect the source format and apply the right conversion strategy. Don't assume everything is a Pi skill.
3. **Content quality** — imported content often needs tightening. Apply the authoring patterns from `references/AUTHORING.md` rather than copying verbatim.
4. **Source lineage** — trace the full derivation chain. Credit upstream sources.
5. **Description rewrite** — always write a fresh `description` following Pi trigger conventions. Source descriptions are written for a different agent's matching logic.
6. **Script adaptation** — scripts from other agent ecosystems often have interactive prompts, hardcoded paths, or output formats designed for humans. Adapt for agentic use: CLI flags, structured output, no interaction.
7. **Upstream tracking** — always create `.upstream.json` for imported skills. This enables the Sync Upstream workflow in SKILL.md to review inspiration sources later.
