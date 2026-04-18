# Import a Skill

Analyze one or more external skill sources, plan the adaptation, and produce a skill that follows project conventions. Sources: Pi agent skills, Codex/OpenAI skills, Claude skills, `.skill` archives, or any agent skill format.

## Phase 1: Analysis

### 1. Gather sources

The user provides at least one link or reference: GitHub repo, `.skill` file, directory path, or inline description.

| Source type | Action |
|-------------|--------|
| GitHub repo | `git clone --depth 1 <url> /tmp/<source-name>` |
| `.skill` archive | `unzip <file>.skill -d /tmp/<source-name>` |
| Local path | Read in place |
| Inline description | Treat as a spec, not code |

For each source, identify: **Format** (Pi, Codex, Claude, generic) · **Structure** (SKILL.md, references, scripts?) · **Quality** (production-grade or draft?) · **License** — if unlicensed or proprietary, **stop and inform the user** · **Lineage** (forked from another project?)

### 2. Analyze and decide

**Primary source**: pick the highest-quality source as the base. Note improvements from others for later.

**Format conversion:**

| Source format | Conversion |
|---------------|-----------|
| Pi skill | Minimal — rename, strip, adapt |
| Codex skill | Add frontmatter, restructure into SKILL.md + references |
| Claude skill | Extract sections, add frontmatter, restructure |
| Generic markdown | Wrap in SKILL.md, split long content into references |
| `.skill` archive | Unzip, inspect, treat as Pi skill |

**Approach:**

| Approach | When to use |
|----------|------------|
| **Adapt** | Source is well-structured and mostly compatible |
| **Rewrite** | Source is messy or user wants significant changes |
| **Extract** | Useful knowledge is buried in a larger document |

**Name**: reflect what the skill does, not where it came from. Check all Pi skill locations for conflicts:
```bash
for dir in ~/.pi/agent/skills ~/.agents/skills .pi/skills .agents/skills skills; do
  test -d "$dir/<skill-name>" && echo "EXISTS in $dir" || true
done
```

### 3. Present analysis

Present: primary source + lineage · format + conversion · approach + rationale · proposed name · features to keep/strip/rewrite · license status

Search findings from step 4 feed into the plan (step 5). Step 5 is the single approval gate.

### 4. Search for existing skills (automatic)

Summary of `references/SEARCH.md` — consult it for full procedure.

**Extract 3 keywords**: skill name (always) + primary action/domain + secondary term if broad.

**Run both tools per keyword:**
```bash
npx -y skill-search-cli --remote "<keyword>" --json   # up to 10 results, JSON
npx skills find "<keyword>"                           # up to 6 results, text
```
If either tool fails, try the other. If both fail, skip this keyword.

**Parse and sort:**
- Tool A: extract `name`, `source`, `installs` from JSON. Sort by installs descending.
- Tool B: parse lines `<owner>/<repo>@<name> <count> installs`. Expand abbreviated counts (K=×1000, M=×1e6).

**Deduplicate across tools:**

| Match | Action |
|-------|--------|
| Same name + same owner/repo | Keep one, note both sources |
| Same name, different owner | Keep both, flag for manual review |
| Within-tool duplicate | Remove |

**Blocking duplicate check:** Search all Pi skill locations for a skill with the same name + overlapping purpose → stop and report.

Locations: `~/.pi/agent/skills/` · `~/.agents/skills/` · `.pi/skills/` · `.agents/skills/` · `skills/`

**Analyze every unique skill:** Use github_browse to read SKILL.md frontmatter. Classify:

| Verdict | Meaning |
|---------|---------|
| **Inspiration** | Relevant — note features to adopt |
| **Overlap** | Similar territory — note differentiators |
| **Duplicate** | Same purpose — stop and report |
| **Ignore** | Not relevant — drop |

**Report:** keywords searched · total found · relevant count · top 1-3 with adopt/avoid notes · gap confirmation

## Phase 2: Planning

### 5. Create a plan

Include: **Source** (URL + commit SHA + license) · **Approach** · **Conversion steps** · **Keep / Strip / Rewrite** · **Name** · **Resources needed** · **Target path** (`<target-path>` — where the skill will be created)

**Do not proceed until user approves the plan.**

### 6. Scaffold

```bash
scripts/init_skill.py <skill-name> --path <target-path> [--resources scripts,references,assets]
```

Or create manually. Only add directories the skill actually needs. `<target-path>` is set in the approved plan (step 5).

## Phase 3: Implement & Validate

### 7. Adapt the content

**If adapting:** copy source SKILL.md, rewrite frontmatter (`name` + fresh `description` per `references/DESCRIPTION-OPTIMIZATION.md`), restructure to required template, move detail into `references/`, keep SKILL.md under 300 lines, convert scripts (no interactive prompts, structured output).

**If rewriting:** use source as reference only. Write SKILL.md from scratch per scaffold template. Implement only approved features.

**If extracting:** identify relevant sections, create focused SKILL.md, link source in `## References`.

**For all approaches:**
- Apply `references/AUTHORING.md` patterns
- Calibrate degrees of freedom (imported skills are often too rigid or too vague)
- Add gotchas for Pi-specific differences from the source agent
- Preserve license attribution in `## Sources`:

```markdown
## Sources
- **Primary**: [<repo>](<url>) — <license>
- **Inspirations**: [<upstream>](<url>) — <license>
```

- Create `.upstream.json` from `assets/templates/.upstream.template.json` with primary URL, SHA, `lastReviewed`, and secondary sources if any
- Document CLI tools in `compatibility` frontmatter: `compatibility: "CLI: git>=2.40, python3>=3.10"`
- Record versions in `.upstream.json` under `cliTools`

### 8. Validate

```bash
scripts/validate_skill.py <target-path>/<skill-name>
```

Fix violations. Common issues: name/directory mismatch, vague description, missing `## References` table, interactive scripts, extraneous files (README.md, .github/, CI configs).

### 9. Evaluate and test triggering

**Quick evaluation** — write 5-10 prompts that should trigger + 5 that should not. Verify the `description` triggers correctly.

For skills heading to publishing, run structured eval per `references/EVALUATION.md`.

If triggering is off: see `references/DESCRIPTION-OPTIMIZATION.md`.

### 10. Commit and register

```bash
git add <target-path>/<skill-name>/
git commit -m "<skill-name>: import from <source>"
rm -rf /tmp/<source-name>
```

Update `AGENTS.md` or relevant project docs if the imported skill changes how the project works.

---

## Pre-Commit Checklist

Run through before committing — each check maps to a step above.

| Check | Source step |
|-------|------------|
| License checked and attribution preserved | Step 1 |
| Fresh `description` written for Pi triggers | Step 7 |
| Scripts adapted (no interactive prompts, structured output) | Step 7 |
| `.upstream.json` created with URL, SHA, `lastReviewed` | Step 7 |
| Source format detected and correct conversion applied | Step 2 |
| No conflict in any Pi skill location | Step 2, Step 4 |
| Validation passes | Step 8 |
