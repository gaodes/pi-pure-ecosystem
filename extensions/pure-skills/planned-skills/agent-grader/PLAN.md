# Grader Agent — Plan

Status: scaffold only, not implemented.

Purpose:
- Evaluate skill execution outputs against predefined assertions and produce structured grading results.
- Act as a Pi sub-agent spawned by the orchestrator during the evaluation phase.
- Critique the evals themselves when they are weak or non-discriminating.

Pi architecture:
- This is a **Pi sub-agent definition file** (markdown with YAML frontmatter), not a skill.
- Lives in `~/.pi/agent/agents/grader.md` or `.pi/agents/grader.md`.
- Spawned via the `subagent` tool by the orchestrating agent.
- Receives task parameters in its prompt (eval output paths, assertions to check).

Likely responsibilities:
- Read the execution transcript and output files from a single eval run.
- Evaluate each assertion against the evidence found in transcripts and outputs.
- Determine PASS or FAIL for each assertion, with specific evidence cited.
- Extract and verify implicit claims from outputs (factual, process, quality).
- Critique the eval assertions themselves — flag superficial or non-discriminating checks.
- Write structured `grading.json` to the eval run directory.

Anthropic imports worth carrying over:
- From `agents/grader.md`: evaluate not just outputs, but whether the expectations actually measure meaningful success.
- From `agents/grader.md`: treat superficial pass conditions as failures in spirit.
- From `agents/grader.md`: the burden of proof to pass is on the expectation.
- From `agents/grader.md`: extract implicit claims beyond predefined expectations.
- From `agents/grader.md`: critique eval quality — good assertions are hard to satisfy without doing the real work correctly.

Input format (received in task prompt):
```
## Eval Run
- transcript_path: <path to execution transcript>
- outputs_dir: <path to output files directory>
- assertions: ["assertion 1", "assertion 2", ...]
- metrics_path: <optional path to metrics.json>
- timing_path: <optional path to timing.json>
```

Output format (written to `<outputs_dir>/../grading.json`):
```json
{
  "expectations": [
    {
      "text": "The output includes a summary section",
      "passed": true,
      "evidence": "Found '## Summary' in the output at line 23"
    }
  ],
  "summary": { "passed": 1, "failed": 0, "total": 1, "pass_rate": 1.0 },
  "claims": [
    { "claim": "The form has 12 fields", "type": "factual", "verified": true, "evidence": "..." }
  ],
  "eval_feedback": {
    "suggestions": [
      { "assertion": "...", "reason": "Would pass for clearly wrong output" }
    ],
    "overall": "Assertions check presence but not correctness"
  }
}
```

Notes:
- Keep this separate from `evaluate-skill`. The evaluate-skill designs the evals; the grader executes them.
- This agent is read-only. It does not modify skills, evals, or outputs.
- The grader must be objective and evidence-based, not assumption-based.
- Spawn one grader per eval run (parallel with other graders).
