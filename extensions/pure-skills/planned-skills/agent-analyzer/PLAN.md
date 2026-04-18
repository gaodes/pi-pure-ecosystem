# Analyzer Agent — Plan

Status: scaffold only, not implemented.

Purpose:
- Analyze blind comparison results to understand WHY the winner won and generate actionable improvement suggestions.
- "Unblind" the results by examining the skills and transcripts after the comparator has chosen a winner.

Pi architecture:
- This is a **Pi sub-agent definition file** (markdown with YAML frontmatter), not a skill.
- Lives in `~/.pi/agent/agents/analyzer.md` or `.pi/agents/analyzer.md`.
- Spawned via the `subagent` tool by the orchestrating agent.
- Receives the comparison result, both skill paths, and both transcript paths.

Likely responsibilities:
- Read the comparator's output to understand the winning reasoning.
- Read both skills' SKILL.md and key referenced files to identify structural differences.
- Read both execution transcripts to compare execution patterns.
- Evaluate instruction following: did each agent follow its skill's instructions? Use the skill's tools? Add unnecessary steps?
- Identify winner strengths and loser weaknesses with specific quotes.
- Generate prioritized improvement suggestions for the losing skill.
- Write structured analysis to the specified output path.

Anthropic imports worth carrying over:
- From `agents/analyzer.md`: be specific — quote from skills and transcripts.
- From `agents/analyzer.md`: be actionable — suggestions should be concrete changes.
- From `agents/analyzer.md`: focus on skill improvements, not agent critique.
- From `agents/analyzer.md`: prioritize by impact — which changes would have changed the outcome?
- From `agents/analyzer.md`: consider causation — did the skill weakness actually cause the worse output?
- From `agents/analyzer.md`: think about generalization — would this improvement help on other evals too?

Input format (received in task prompt):
```
## Analysis Task
- winner: "A" or "B"
- winner_skill_path: <path to winning skill>
- winner_transcript_path: <path to winner transcript>
- loser_skill_path: <path to losing skill>
- loser_transcript_path: <path to loser transcript>
- comparison_result_path: <path to comparison.json>
- output_path: <where to write analysis.json>
```

Output format (written to `output_path`):
```json
{
  "comparison_summary": {
    "winner": "A",
    "comparator_reasoning": "Brief summary"
  },
  "winner_strengths": [
    "Clear step-by-step instructions for handling multi-page documents"
  ],
  "loser_weaknesses": [
    "Vague instruction led to inconsistent behavior"
  ],
  "instruction_following": {
    "winner": { "score": 9, "issues": ["Minor: skipped optional step"] },
    "loser": { "score": 6, "issues": ["Did not use formatting template"] }
  },
  "improvement_suggestions": [
    {
      "priority": "high",
      "category": "instructions",
      "suggestion": "Replace vague instruction with explicit steps",
      "expected_impact": "Would eliminate ambiguity"
    }
  ],
  "transcript_insights": {
    "winner_execution_pattern": "Read skill -> Followed 5-step process -> Used validation script",
    "loser_execution_pattern": "Read skill -> Unclear on approach -> Tried 3 different methods"
  }
}
```

Notes:
- This agent runs AFTER the comparator has chosen a winner.
- Categories for suggestions: instructions, tools, examples, error_handling, structure, references.
- Priority levels: high (would change outcome), medium (would improve quality), low (nice to have).
- The analyzer is read-only — it does not modify skills.
