# Skill Creation Pipeline — Design

Status: design document, not implemented.

## Overview

This document defines the pipeline workspace convention and artifact formats for the full skill creation lifecycle. The pipeline is orchestrated at the **agent level**, not inside any extension or skill. Individual skills are pure reasoning documents that read from and write to a shared workspace.

Inspired by Anthropic's skill-creator, CrewAI's multi-agent orchestration, and LangChain Deep Agents' filesystem-state pattern.

## Architecture

The pipeline is driven by an orchestrating agent that dispatches sub-agents to run skills. Each sub-agent is a pure reasoning worker that reads its input from workspace files and writes its output back to workspace files.

```
┌─────────────────────────────────────────────────────────┐
│  ORCHESTRATOR (agent-level, not extension)              │
│  • Creates pipeline workspace                            │
│  • Dispatches sub-agents to run skills                   │
│  • Manages parallel/sequential flow                      │
│  • Presents final summary                                │
└─────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
   ┌─────────┐       ┌─────────────┐       ┌─────────────┐
   │ search  │       │   analyze   │       │   analyze   │
   │-skill   │       │  skill #1   │       │  skill #2   │
   │(agent A)│       │  (agent B)  │       │  (agent C)  │
   └────┬────┘       └──────┬──────┘       └──────┬──────┘
        │                   └──────────┬────────────┘
        │                              ▼
        │                        ┌─────────────┐
        │                        │  plan-skill │
        │                        │  (agent D)  │
        │                        └──────┬──────┘
        │                               ▼
        │                        ┌─────────────┐
        │                        │ create-skill│
        │                        │  (pipeline  │
        │                        │   mode)     │
        │                        │  (agent E)  │
        │                        └──────┬──────┘
        │                               ▼
        │              ┌────────────────┼────────────────┐
        │              ▼                ▼                ▼
        │         ┌─────────┐    ┌──────────┐    ┌──────────┐
        │         │validate │    │ evaluate │    │ optimize │
        │         │(agent F)│    │(agent G) │    │(agent H) │
        │         └────┬────┘    └────┬─────┘    └────┬─────┘
        │              └─────────────┼───────────────┘
        │                            ▼
        │                     ┌─────────────┐
        │                     │   audit     │
        │                     │  (agent I)  │
        │                     └──────┬──────┘
        │                            ▼
        │                     ┌─────────────┐
        │                     │ update-skill│
        │                     │  (optional, │
        │                     │  if findings)│
        │                     │  (agent J)  │
        │                     └──────┬──────┘
        │                            ▼
        │                     ┌─────────────┐
        │                     │   commit    │
        │                     │  (agent K)  │
        │                     └─────────────┘
        │                            │
        └────────────────────────────┘
                                     ▼
                            ┌─────────────┐
                            │  99-summary │
                            │   (user)    │
                            └─────────────┘
```

Key principle from Anthropic: **spawn all runs in the same turn**. When a phase can run in parallel, dispatch all sub-agents simultaneously and let them work concurrently. The orchestrator uses that time productively rather than waiting.

## Workspace location

```
.pi/skills/.pipeline/<pipeline-id>/
```

- `<pipeline-id>` is a short slug derived from the target skill name plus a timestamp or counter.
- The workspace is ephemeral. It is created at pipeline start and may be cleaned up after completion.
- Each phase reads from the previous phase's output directory and writes to its own.
- Large outputs are saved to files rather than kept in context, following the Deep Agents pattern.

## Directory structure

```
.pi/skills/.pipeline/<pipeline-id>/
├── 00-intent.md              # user intent, constraints, non-goals
├── 01-analyses/              # output from analyze-skill agents
│   ├── source-001.md
│   ├── source-002.md
│   └── ...
├── 02-plan/                  # output from plan-skill
│   └── plan.md
├── 03-skill/                 # output from create-skill
│   └── <skill-name>/
│       ├── SKILL.md
│       ├── scripts/
│       ├── references/
│       └── assets/
├── 03-skill/iterations/      # update-skill revision history
│   ├── iteration-1/          # snapshot before first update
│   ├── iteration-2/          # snapshot after first update
│   └── ...
├── 04-reports/               # output from diagnostic skills
│   ├── validation.json
│   ├── evaluation/
│   │   ├── eval-metadata.json
│   │   ├── eval-001/
│   │   │   ├── with_skill/
│   │   │   │   └── outputs/
│   │   │   └── baseline/
│   │   │       └── outputs/
│   │   ├── eval-002/...
│   │   └── grading.json
│   ├── audit.md
│   ├── optimization.md
│   └── benchmark.json
├── 05-updates/               # output from update-skill (if needed)
│   └── update-plan.md
├── agents/                   # sub-agent instruction files
│   ├── grader.md             # evaluates assertions against outputs
│   ├── comparator.md         # blind A/B comparison
│   └── analyzer.md           # analyzes WHY the winner won
└── 99-summary.md             # final summary for the user
```

## Iteration directories

Following Anthropic's pattern, when a skill goes through update cycles:

```
03-skill/iterations/
├── iteration-1/              # snapshot after create-skill
├── iteration-2/              # snapshot after first update-skill
└── iteration-3/              # snapshot after second update-skill
```

Each iteration is a complete snapshot. You can compare across iterations. The current active skill always lives at `03-skill/<skill-name>/`.

## Sub-agent instructions

Following Anthropic's pattern, sub-agent prompts live as markdown files in the workspace:

- `agents/grader.md` — evaluates assertions against outputs and critiques the evals themselves
- `agents/comparator.md` — blind A/B comparison between two skill versions
- `agents/analyzer.md` — analyzes why one version beat another, with actionable improvement suggestions

When spawning a sub-agent, the orchestrator feeds the relevant instruction file as the sub-agent's skill. This keeps sub-agent logic out of the main skills.

## Artifact formats

### 00-intent.md

Markdown file capturing the user's request at pipeline start.

```markdown
---
pipelineId: <id>
targetSkillName: <kebab-case>
scope: project | global | extension-bundled
mode: draft | full | step
requestedAt: <ISO timestamp>
---

## User request
<verbatim or summarized user input>

## Constraints
- <constraint 1>
- <constraint 2>

## Non-goals
- <non-goal 1>

## Source links
- <url 1>
- <url 2>
```

### 01-analyses/*.md

Each analysis document follows a consistent structure so downstream skills can consume them without knowing the original source.

```markdown
---
sourceId: <identifier>
sourceUrl: <url or local path>
analyzedAt: <ISO timestamp>
---

## Summary
<one-paragraph summary of the skill>

## Structure
<directory/file layout>

## Reusable elements
<what is worth borrowing>

## Adaptation notes
<what would need to change for Pi>

## Discard
<what should be left behind>
```

### 02-plan/plan.md

The implementation plan consumed by `create-skill`.

```markdown
---
pipelineId: <id>
planVersion: 1
plannedAt: <ISO timestamp>
---

## Skill identity
- **name**: <kebab-case>
- **purpose**: <one sentence>
- **scope**: <project | global | extension-bundled>

## Triggers
<when the skill should activate>

## Inputs / outputs
<input description>
<output description>

## Success criteria
<what good looks like>

## Resource plan
- `scripts/`: <what goes here, or "none">
- `references/`: <what goes here, or "none">
- `assets/`: <what goes here, or "none">

## Exclusions
<what to explicitly leave out>

## Inspiration sources
- <sourceId> — <what was adopted>
```

### 04-reports/validation.json

Structured output from `validate-skill`.

```json
{
  "pipelineId": "<id>",
  "skillName": "<name>",
  "validatedAt": "<timestamp>",
  "checks": [
    { "check": "SKILL.md exists", "status": "pass" },
    { "check": "frontmatter parsed", "status": "pass" },
    { "check": "name is kebab-case", "status": "pass" }
  ],
  "findings": [],
  "exitState": "success"
}
```

### 04-reports/evaluation/

Following Anthropic's pattern, evaluation artifacts are organized per test case:

```
04-reports/evaluation/
├── eval-metadata.json        # all test cases and assertions
├── eval-001/                 # one directory per test case
│   ├── with_skill/
│   │   └── outputs/          # what the skill produced
│   ├── baseline/
│   │   └── outputs/          # what the model produced without the skill
│   └── timing.json           # tokens and duration
├── eval-002/...
└── grading.json              # assertion pass/fail for all runs
```

**eval-metadata.json:**

```json
{
  "skill_name": "example-skill",
  "evals": [
    {
      "id": 1,
      "name": "descriptive-name-here",
      "prompt": "User's task prompt",
      "expected_output": "Description of expected result",
      "assertions": [
        "The output includes a summary section",
        "The summary is under 200 words"
      ]
    }
  ]
}
```

**grading.json:**

```json
{
  "expectations": [
    {
      "text": "The output includes a summary section",
      "passed": true,
      "evidence": "Found '## Summary' in the output"
    }
  ],
  "summary": {
    "passed": 1,
    "failed": 0,
    "total": 1,
    "pass_rate": 1.0
  }
}
```

### 04-reports/audit.md

Output from `audit-skill`.

```markdown
---
pipelineId: <id>
skillName: <name>
auditedAt: <timestamp>
---

## Findings
| Priority | Category | Finding | Suggested action |
|----------|----------|---------|-----------------|
| high | description | too vague | add concrete trigger examples |
| medium | instructions | overfit | generalize beyond the example |

## Conventions check
<drift from AUTHORING.md>
```

### 04-reports/optimization.md

Output from `optimize-skill-description`.

```markdown
---
pipelineId: <id>
skillName: <name>
optimizedAt: <timestamp>
---

## Original description
<original>

## Proposed description
<proposed>

## Trigger tests
| Prompt | Should trigger? | Confidence |
|--------|-----------------|------------|
| <prompt> | yes | high |

## Rationale
<why the changes help>
```

### 04-reports/benchmark.json

Aggregated metrics across all evaluation runs. Following Anthropic's pattern:

```json
{
  "skill_name": "<name>",
  "iteration": 1,
  "configurations": [
    {
      "name": "with_skill",
      "pass_rate": 0.85,
      "time_seconds": { "mean": 45.2, "stddev": 5.1 },
      "tokens": { "mean": 15200, "stddev": 1200 }
    },
    {
      "name": "baseline",
      "pass_rate": 0.40,
      "time_seconds": { "mean": 32.1, "stddev": 3.4 },
      "tokens": { "mean": 8900, "stddev": 800 }
    }
  ]
}
```

### 05-updates/update-plan.md

Output from `update-skill` when findings require changes.

```markdown
---
pipelineId: <id>
skillName: <name>
updatedAt: <timestamp>
---

## Changes required
| Source | Finding | Proposed change | Location |
|--------|---------|-----------------|----------|
| validate | missing section | add Limits | SKILL.md |
| evaluate | weak edge handling | add failure mode | SKILL.md |
| audit | description vague | rewrite description | frontmatter |

## Generalized improvements
<cross-cutting suggestions>
```

### 99-summary.md

Final summary presented to the user.

```markdown
# Skill Pipeline Summary — <skill-name>

## What was done
<brief description of pipeline phases run>

## Sources analyzed
- <source 1>
- <source 2>

## Quality results
- Validation: <pass / findings>
- Evaluation: <summary>
- Audit: <summary>

## Final location
`<path to skill>`

## Commit
`<commit hash>`
```

## Parallel execution

Following Anthropic's critical insight: **spawn all runs in the same turn**.

When a phase can run in parallel, dispatch all sub-agents simultaneously:

- **Phase 1 (analysis)**: Spawn one `analyze-skill` agent per source link simultaneously
- **Phase 4 (diagnostics)**: Spawn `validate-skill`, `evaluate-skill`, `optimize-skill-description`, and `audit-skill` simultaneously
- **Phase 4 (evaluation)**: For each test case, spawn both `with_skill` and `baseline` agents simultaneously

The orchestrator does not wait for one to finish before starting the next. It launches everything at once so it all finishes around the same time.

## Guardrails

Following CrewAI's pattern, each phase can have a guardrail that validates output before the next phase proceeds:

| Phase | Guardrail | Behavior on failure |
|-------|-----------|---------------------|
| `01-analyses` | Must produce at least one valid analysis | Block, ask user for different sources |
| `02-plan` | Must have explicit name, purpose, scope | Block, ask user for clarification |
| `03-skill` | `validate-skill` must pass all critical checks | Proceed to update, not commit |
| `04-reports` | Critical failures found | Spawn `update-skill`, then re-run diagnostics |

## Blind comparison (advanced)

For rigorous A/B testing between two skill versions, following Anthropic's pattern:

1. Run the same test cases with both versions
2. Feed outputs to a comparator sub-agent (using `agents/comparator.md`)
3. Comparator judges quality without knowing which version produced which output
4. An analyzer sub-agent (using `agents/analyzer.md`) "unblinds" and explains why the winner won
5. Generate actionable improvement suggestions for the losing version

This is optional and only used when the user explicitly asks "is the new version actually better?"

## Phase transitions

Each phase reads the exit state of previous phases from a small state file:

```json
{
  "pipelineId": "<id>",
  "phases": {
    "01-analyses": { "status": "success", "completedAt": "..." },
    "02-plan": { "status": "success", "completedAt": "..." },
    "03-skill": { "status": "success", "completedAt": "..." },
    "04-reports": { "status": "findings", "completedAt": "..." },
    "05-updates": { "status": "in-progress" }
  }
}
```

The orchestrating agent uses this state file to decide what to run next. Individual skills do not read or write this file directly; they only produce their phase artifacts.

## Pipeline modes

| Mode | Behavior |
|------|----------|
| `draft` | Stop after `02-plan`. Present plan for user approval. |
| `full` | Run all phases autonomously. Present `99-summary` at end. |
| `step` | Pause after each phase. Wait for user go/no-go. |

## Notes
- Skills must not contain sub-agent dispatch logic. They are pure reasoning documents.
- State passing happens exclusively through workspace files, following the Deep Agents pattern.
- The orchestrator lives at the agent level, not in any extension.
- Sub-agent instructions live in `agents/*.md`, not embedded in skills.
- Iteration directories preserve history so you can compare across update cycles.
