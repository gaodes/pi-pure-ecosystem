# Comparator Agent — Plan

Status: scaffold only, not implemented.

Purpose:
- Compare two skill execution outputs WITHOUT knowing which skill produced them.
- Judge purely on output quality and task completion, eliminating bias toward a particular skill version.

Pi architecture:
- This is a **Pi sub-agent definition file** (markdown with YAML frontmatter), not a skill.
- Lives in `~/.pi/agent/agents/comparator.md` or `.pi/agents/comparator.md`.
- Spawned via the `subagent` tool by the orchestrating agent.
- Receives two output directories labeled "A" and "B" without skill identity.

Likely responsibilities:
- Examine both outputs (files or directories) thoroughly.
- Read the original eval prompt to understand what the task requires.
- Generate an evaluation rubric adapted to the specific task type.
- Score each output on content criteria (correctness, completeness, accuracy) and structure criteria (organization, formatting, usability).
- Check assertions against both outputs if provided.
- Determine a winner based on rubric scores, with assertion pass rates as secondary evidence.
- Write structured `comparison.json` with reasoning.

Anthropic imports worth carrying over:
- From `agents/comparator.md`: stay blind — do not try to infer which skill produced which output.
- From `agents/comparator.md`: be decisive — ties should be rare.
- From `agents/comparator.md`: output quality first, assertion scores secondary.
- From `agents/comparator.md`: generate a task-specific rubric, not a generic one.
- From `agents/comparator.md`: score on 1-5 scale per criterion, then scale to 1-10 overall.

Input format (received in task prompt):
```
## Comparison Task
- output_a_path: <path to output A>
- output_b_path: <path to output B>
- eval_prompt: <the original task description>
- expectations: ["assertion 1", ...] (optional)
- output_path: <where to write comparison.json>
```

Output format (written to `output_path`):
```json
{
  "winner": "A",
  "reasoning": "Output A provides a complete solution with proper formatting...",
  "rubric": {
    "A": {
      "content": { "correctness": 5, "completeness": 5, "accuracy": 4 },
      "structure": { "organization": 4, "formatting": 5, "usability": 4 },
      "overall_score": 9.0
    },
    "B": { ... }
  },
  "output_quality": {
    "A": { "score": 9, "strengths": [...], "weaknesses": [...] }
  }
}
```

Notes:
- This is optional and only used when the user explicitly asks for rigorous A/B comparison.
- The comparator must not see skill names, versions, or any identifying metadata.
- If both outputs fail, pick the one that fails less badly.
- Spawn one comparator per eval case (parallel with other comparators).
