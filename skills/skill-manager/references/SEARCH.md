# Search for Skills

Search remote skill registries for skills that overlap with, inspire, or conflict with the skill being created or imported.

## When to run (automatic, agent-only)

This reference is **not a standalone user-facing task** and cannot be triggered by the user. The agent **automatically** runs this search when:

- **Creating a skill** — immediately after intake, before shape selection.
- **Importing a skill** — immediately after analyzing the source, before planning the adaptation.

The agent does **not** ask the user for permission to search. It is an automatic prerequisite step embedded in the Create and Import workflows.

## Search tools

Two remote search tools are available.

### Tool A: `npx skill-search-cli` (preferred, structured)

```bash
npx -y skill-search-cli --remote "<query>" --json
```

- Returns up to **10 results** (default limit).
- Output: structured JSON: `"remote": [{"id": "...", "name": "...", "source": "...", "installs": N}]`.
- Fields: `name`, `source` (as `owner/repo`), `installs` (number).
- **Not sorted** — results arrive in arbitrary order.

### Tool B: `npx skills` (text output)

```bash
npx skills find "<query>"
```

- Returns up to **6 results** (fixed limit on the server).
- Output: ANSI-colored text list. Each result:

  ```
  <owner>/<repo>@<skill-name> <install-count> installs
  └ https://skills.sh/<owner>/<repo>/<skill-name>
  ```

- Parse from each result: `name`, `owner/repo`, install count.
- Install counts are abbreviated: `K` = ×1000, `M` = ×1,000,000 (e.g. "115.5K" → 115500).

## Workflow

### 1. Extract keywords

From the user's request, source skill, or context, extract **up to 3** search terms that match the skill's purpose:

- Skill name or proposed name
- Primary action or domain (e.g. "sync", "validate")
- Secondary term if the domain is broad (e.g. "upstream" for sync)

Run the search against **each keyword independently**.

### 2. Search with both tools

For each keyword:

**a. Run Tool A (skill-search-cli):**

```bash
npx -y skill-search-cli --remote "<keyword>" --json
```

**b. Run Tool B (skills):**

```bash
npx skills find "<keyword>"
```

If either tool fails, attempt the other. If both fail for a keyword, skip that keyword and continue.

### 3. Parse and sort by installs

**Tool A (JSON):** Extract each result's `name`, `source`, and `installs`. Sort by `installs` descending.

**Tool B (text):** Parse each line matching the pattern:

```
<owner>/<repo>@<name> <count> installs
```

Expand abbreviated counts:

| Abbreviation | Expand  |
| ------------ | ------- |
| `1.5K`       | 1500    |
| `25K`        | 25000   |
| `1.2M`       | 1200000 |

After parsing, sort by install count descending.

### 4. Deduplicate

Merge the sorted results from both tools into a single list. Use these rules:

| Match type                 | Criteria                                    | Action                            |
| -------------------------- | ------------------------------------------- | --------------------------------- |
| Same skill in both tools   | Same `name` + same `owner/repo`             | Keep one entry, note both sources |
| Same name, different owner | Same `name`, different `owner/repo`         | Keep both, flag for manual review |
| Within-tool duplicate      | Same `name` + same `owner/repo` in one tool | Remove the duplicate              |

The deduplicated list contains all **unique** skills found across both tools for this keyword.

**After deduplication, check for blocking duplicates:**

- Does a skill with the **same name** and **overlapping purpose** already exist locally? If yes, stop all keywords and report the duplicate.

### 5. Analyze all unique skills

For **every unique skill** on the deduplicated list, read its SKILL.md frontmatter to get the full description:

```
action: "read_file"
owner: <owner>
repo: <repo>
path: <skill-name>/SKILL.md
```

Common paths to try, in order:

1. `SKILL.md` (single-skill repo at root)
2. `<skill-name>/SKILL.md`
3. `skills/<skill-name>/SKILL.md`

If none match, discover the structure first:

```
action: "list_directory"
owner: <owner>
repo: <repo>
path: .
```

Then read `SKILL.md` from the skill directory.

**For each skill, decide:**

| Verdict         | Action                                                                            |
| --------------- | --------------------------------------------------------------------------------- |
| **Inspiration** | Relevant to the skill being built — note specific features or patterns to adopt   |
| **Overlap**     | Covers similar territory — note what to avoid duplicating or how to differentiate |
| **Duplicate**   | Same purpose and approach as what you're building — report and stop               |
| **Ignore**      | Not relevant — drop from the list                                                 |

Keep all skills marked **Inspiration** or **Overlap**. Drop **Ignore** skills.

### 6. Report findings

Present a summary:

- **Keywords searched**: list
- **Total remote skills found**: raw count before filtering
- **Relevant skills**: count after dropping "Ignore"
- **Most relevant**: 1-3 top skills with notes on what to adopt or avoid
- **Inspiration sources**: list of skills to credit in `## Sources` or `## References`
- **Gap confirmation**: if no relevant skills found, state that the skill fills a gap

If importing: note which features from matching skills should be added to the plan.

## Inspecting a remote skill deeply

If a skill looks highly relevant and you need its full instructions beyond the frontmatter:

**Try `github_browse` first** (see Step 5 above). No installation, no cleanup.

**Fallback: temporary install** for private repos or when the path cannot be determined:

```bash
npx skills add https://github.com/<owner>/<repo> --skill <skill-name> -y -g
cat ~/.agents/skills/<skill-name>/SKILL.md
npx skills remove <skill-name> -y -g
```

Only inspect deeply when needed. Most judgments can be made from name + install count + frontmatter description.

## Error handling

If both search tools fail for a keyword (network error, package not found, command not found):

1. Report: "Remote search unavailable for '<keyword>' — skipping."
2. Continue with remaining keywords.
3. If all keywords fail, report: "Remote skill search unavailable — proceeding without it."
4. Continue the create/import workflow normally. Search is advisory, not blocking.

## Rules

1. **Max 3 keywords.** Pick terms directly related to the skill's purpose.
2. **Sort by installs.** After parsing results from both tools, always sort by install count descending before deduplication.
3. **Analyze all unique skills.** Do not cap the analysis list — every unique skill may contain valuable insight.
4. **Stop only on true duplicate.** If a skill with the same name and purpose already exists locally, stop and report. Otherwise, continue through all keywords.
5. **Search is advisory.** If tools fail, proceed without them. Never block skill creation on search availability.
6. **Reference, don't copy.** Matching skills are inspiration sources — credit them, write your own instructions.
