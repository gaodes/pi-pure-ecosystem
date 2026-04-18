---
name: evaluate
description: >
  Verify a skill works correctly through trigger validation, happy-path execution, and context economy checks.
disable-model-invocation: true
---

# Evaluation

Verify a skill works correctly. Three phases:

1. **Trigger validation** — does the description fire on the right prompts?
2. **Happy-path execution** — does the skill produce correct output on realistic tasks?
3. **Context economy** — is the skill efficient in tokens and cost?

Execute each phase manually. This takes minutes, not hours, and costs nothing.

## Phase 1: trigger validation

Test whether the description triggers on the right prompts and stays silent on the wrong ones. See [../optimize-description/SKILL.md](../optimize-description/SKILL.md) for the test-prompt generation method.

### How to run it

Read the skill's `description` field from SKILL.md frontmatter. For each test prompt, classify manually:

- **TRIGGER** — the prompt matches what the description says the skill handles
- **NOT TRIGGER** — the prompt does not match

A prompt passes if your classification matches `should_trigger`.

Aim for 10–14 prompts total: 7–10 that should trigger, 3–4 that should not. See the ../optimize-description/SKILL.md for generation guidance.

**Example:**

Skill description:
> Execute git commit with conventional commit message analysis. Use when user asks to commit changes or mentions "/commit".

| Prompt | Should Trigger | Classification | Pass? |
|--------|---------------|----------------|-------|
| "Can you commit this?" | true | TRIGGER | ✅ |
| "Show me my git log" | false | NOT TRIGGER | ✅ |
| "/commit" | true | TRIGGER | ✅ |

**Release gate**: all should-trigger prompts pass, no should-not-trigger prompt triggers.

## Phase 2: happy-path execution

Test whether the skill produces correct output on real tasks. Execute each task manually, simulating what the skill would do when triggered.

For each task, mark **pass**, **partial**, or **fail**:

| Result | Definition |
|--------|------------|
| **pass** | Correct output, clean execution, no unnecessary steps |
| **partial** | Correct output but extra steps, wrong tools, or bloated result |
| **fail** | Wrong output, hallucination, silent failure, or error |

### What to test

- **2–3 happy-path tasks** — realistic requests the skill is designed to handle
- **1–2 edge cases** — boundary conditions the skill should handle gracefully
- **1 failure-behavior task** — deliberately bad input (corrupted file, non-existent path). The skill should return a clear error, not a silent wrong result

### Assertions

Check outputs with `grep` or `bash` rather than eyeballing:

```bash
# Check the output contains expected markers
grep "refactor:" output.txt

# Validate a file the skill wrote
python3 -c "import json; json.load(open('result.json'))"

# Check for errors
[ ! -s stderr.txt ]
```

Weak assertions: "The output looks good" — too vague. Strong assertions: "The output contains `feat(scope):` in conventional commit format."

### Failure behavior

If the skill hallucinates plausible output for garbage input, mark the task **fail** even if the exit code is 0. A correct skill refuses or errors clearly.

## Phase 3: context economy

No usage stats to read since evaluation is manual. Assess qualitatively:

| Dimension | What to check |
|-----------|---------------|
| **Instruction length** | SKILL.md content under 300 lines? References under 100 lines? |
| **Step count** | Each phase/step is necessary? No redundant tooling? |
| **Reference bloat** | References loaded only when needed? |
| **Cost** | $0 — manual evaluation is free |

If SKILL.md is too long or the workflow has too many steps, trim it.

## Dimensions checklist

Evaluate across all dimensions before releasing:

| Dimension | What to check |
|-----------|---------------|
| Trigger accuracy | Phase 1 results — no false positives or negatives |
| Instruction clarity | Can you follow the workflow without guessing? |
| Tool correctness | Right tools for the job? No unnecessary calls? |
| Output quality | Result matches what was asked? |
| Context economy | SKILL.md and references are lean? |
| Failure behavior | Errors visible and helpful, not silent? |

## Eval iteration

1. Run Phase 1 and Phase 2.
2. Grade results.
3. Fix failures — update SKILL.md or reference files.
4. Re-run from Phase 1.
5. Stop when pass rates plateau.

Start with 2–3 happy-path tasks. Expand only when results show clear patterns worth optimizing.

## No baseline comparison

Do not compare "with skill" vs "without skill". Pi has no mechanism to selectively unload one skill while keeping others active. Focus on whether the skill improves over its own previous iterations.

## Release gate

All must be true:

- Phase 1: all should-trigger prompts pass
- Phase 1: no should-not-trigger prompt triggers
- Phase 2: all happy-path tasks pass or partial (no fails)
- Phase 3: SKILL.md and references are lean (no "Bad" context economy)

## Eval artifacts

Store test specs in `evals/` inside the skill directory. Commit spec files — they document expected behavior:

```
<skill-directory>/
├── SKILL.md
└── evals/
    └── trigger.json      ← test prompts (commit)
    └── outputs/           ← generated results (gitignore)
```

Add `evals/outputs/` to `.gitignore` — those files are ephemeral.
