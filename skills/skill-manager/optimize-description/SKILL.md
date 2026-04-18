---
name: optimize-description
description: >
  Optimize a skill description field so it triggers on the right prompts and stays silent on the wrong ones.
disable-model-invocation: true
---

# Description Optimization

The `description` field carries the entire burden of triggering. A skill that triggers on relevant prompts is essential; one that triggers on irrelevant prompts wastes context. This reference guides the agent in rewriting and tuning descriptions.

## What `description` does and does not

At startup, Pi loads only `name` + `description` for each skill. When a user's task matches a description, the agent reads the full SKILL.md body. The description is the gate — it must tell the agent *when to reach for this skill*, not *what the skill does inside*.

- **Does**: Convey user intent that should trigger loading the skill.
- **Does not**: Explain implementation, scripts, file formats, or internal workflows — that belongs in SKILL.md.
- **Hard limit**: 1024 characters. Too long and it competes for context.

### Pi-specific triggers

If the skill loads implicitly: the description is the only trigger mechanism.

If the skill also registers as a `/skill:name` command or has `allowed-tools` configured, the description still matters as a fallback when the user does not invoke by name.

If `disable-model-invocation: true` is set, the description is hidden from the system prompt entirely. Users must use `/skill:name`. In that case, description optimization is irrelevant.

## Directives for writing descriptions

1. **Use imperative or explicit phrasing.** Lead with what to do or when to use it.
   - Good: `description: >`
     `Generate conventional commit messages from git diffs. Use when the user asks to commit, write a commit message, or mentions "Conventional Commits".`
   - Weak: `description: This skill helps write commits.`

2. **Focus on user intent, not implementation.** The agent matches against what the user asked for, not what tool the skill uses.
   - Bad: `Runs pdfplumber on PDF files to extract tables.`
   - Good: `Extract tables and text from PDF documents. Use when working with PDFs or document extraction.`

3. **Err on the side of being specific.** List contexts where the skill applies. Mention related keywords users might use, including cases where the user doesn't name the domain directly.
   - Good: `Analyze CSV and tabular data files. Use when exploring, transforming, or visualizing data, even without explicit "CSV" mention.`
   - Too narrow: `Parses CSV files.` (misses "My spreadsheet is broken")

4. **Keep it concise.** One to three sentences. Every word competes for the model's attention.

5. **Do not describe internals.** No script names, no API names, no step-by-step language.

### Examples

```yaml
# Too vague — no clue when to trigger
description: Helps with PDFs.

# Too narrow — misses common phrasing
description: Runs pdfplumber.py to extract tables.

# Good — covers intent, context, and keyword breadth
description: Extracts text and tables from PDF files, fills PDF forms, and merges multiple PDFs. Use when working with PDF documents or when the user mentions PDFs, forms, or document extraction.

# Good — broad trigger net that still signals boundaries
description: Analyze CSV and tabular data files — compute summary statistics, add derived columns, generate charts, and clean messy data. Use when the user has a CSV, TSV, or Excel file and wants to explore, transform, or visualize the data, even if they don't explicitly mention "CSV" or "analysis."
```

## Self-check checklist (the agent can run this now)

Before presenting a description to the user, verify:

| Check | Question | Fix if "no" |
|-------|----------|-------------|
| **Trigger-focused** | Does it state "Use when..." or equivalent trigger condition? | Add explicit trigger language |
| **Intent-based** | Does it describe what the user wants, not what tool runs? | Rewrite from user perspective |
| **Keyword breadth** | Are there 2–4 related terms or phrases a user might use? | Add near-synonyms and related concepts |
| **Boundary hinted** | Is there at least a vague sense of what the skill does *not* cover? | Add scope hint or non-goal |
| **Under 1024 chars** | Count characters including the leading `>` line-break marker | Trim to essentials |
| **No internals** | No script names, APIs, or workflow steps mentioned? | Remove and move to SKILL.md |

## Primary method: test with subagents

The **subagent extension** (bundled with Pi in `examples/extensions/subagent/`) can spawn isolated `pi` processes with custom system prompts and tool configurations. Use it to test whether a description triggers correctly.

**Repository:** https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent/examples/extensions/subagent

It registers a `subagent` tool the LLM can call to run parallel or chained sub-agents with isolated context.

**Status:** Installed globally at `~/.pi/agent/extensions/subagent/`. Available after `/reload`.

### Step 1: spawn a test subagent

Use the `skill-tester` subagent (installed globally at `~/.pi/agent/agents/skill-tester.md`). It is configured for `google-gemini-cli/gemini-2.5-flash` — fast, free, and reliable for classification. Change the `model` field in the agent file if that model is unavailable. It receives a skill description + a user prompt and reports `TRIGGERED` or `NOT TRIGGERED`.

Spawn it via the `subagent` tool:

```
agent: skill-tester
task: |
  Skill 'git-commit': Generate conventional commit messages from git diffs. Use when the user asks to commit, write a commit message, or mentions "Conventional Commits".

  Prompt: "Can you commit this?"
```

The subagent responds strictly with one line:
- `TRIGGERED: <reason>`
- `NOT TRIGGERED: <reason>`

### Step 2: generate test prompts

Create **10–14 realistic user prompts** split between:

- **Should trigger** (7–10 prompts): vary phrasing, indirectness, typos, and detail.
- **Should NOT trigger** (3–4 prompts): near-misses that share a keyword but need something different.

Examples for a "git-commit" skill:

```markdown
Should trigger:
1. "Can you commit this?"
2. "Write a conventional commit message from my diff"
3. "I need a commit for these changes"
4. "stage and commit everything"

Should NOT trigger:
1. "Show me my git log" (read-only, not writing commits)
2. "Configure my git username" (config, not commit messages)
3. "What does git rebase do?" (explanation, not action)
```

### Step 3: run the test

For each prompt, spawn the `skill-tester` subagent with the skill description and the prompt. The subagent responds with exactly one line: `TRIGGERED: <reason>` or `NOT TRIGGERED: <reason>`.

A prompt **passes** if:
- `should_trigger: true` → subagent reports `TRIGGERED`
- `should_trigger: false` → subagent reports `NOT TRIGGERED`

Run each prompt once per test round. The `skill-tester` agent is deterministic enough for single-run evaluation.

### Step 4: revise based on failures

| Failure | Diagnosis | Fix |
|---------|-----------|-----|
| Should-trigger prompt did not trigger | Description too narrow | Broaden scope or add trigger conditions |
| Should-not-trigger prompt triggered | Description too broad or vague | Add specificity about what the skill does *not* do |
| Both directions work | Description is well-tuned | Stop |

When broadening: address the *category*, not the specific keyword. If "spreadsheet" failed, add "tabular data" — do not add "spreadsheet" verbatim unless it genuinely belongs.

When narrowing: add what the skill does *not* do. Example: "Does not handle PDF creation or image conversion."

### Step 5: iterate

Repeat Steps 3–4 up to 3 times. If all prompts pass before that: stop early. If after 3 rounds issues persist: the skill's scope may be ambiguous — consider splitting or clarifying the purpose before rewriting the description again.

## Fallback: test with the user

If subagent testing is unavailable (subagent extension not installed, too slow, or too costly):

1. Generate the same 10–14 test prompts (should-trigger / should-not-trigger).
2. Present them to the user:

```markdown
## Test prompts for `<skill-name>`

Should trigger:
1. "Can you commit this?"
2. "Write a conventional commit message from my diff"
...

Should NOT trigger:
1. "Show me my git log"
2. "Configure my git username"
...
```

Ask: "For each prompt, would you expect this skill to activate? Tell me which should-trigger prompts feel wrong and which should-not-trigger might fire anyway."

3. Revise based on feedback using the same failure-to-fix table as Step 4.
4. Iterate up to 3 times.

## Applying the result

1. Update the `description` field in SKILL.md frontmatter.
2. Run the self-check checklist. Fix anything flagged.
3. Verify it's under 1024 characters.
4. Present the revised `description` to the user and ask: "Does this capture when the skill should activate?"
5. Commit with scope syntax:
   ```bash
   git add <skill-path>/SKILL.md
   git commit -m "refactor(<skill-name>): optimize description"
   ```
