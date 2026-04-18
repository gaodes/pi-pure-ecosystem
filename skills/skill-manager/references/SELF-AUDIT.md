# Self-Audit

Run a portfolio review across managed skills. The goal is not to rewrite everything — it is to find the highest-value fixes backed by evidence.

## Scope

- Default scope: the project's `skills/` directory.
- If the user provides a narrower path or a list of skills, audit only those.
- Skip archived, deprecated, or obviously experimental drafts unless the user asks to include them.

## Evidence sources

Use concrete evidence, not vague intuition:

- **Current SKILL.md + resources** — what the skill says it does now.
- **Git history** — recent fixes, repeated rewrites, churn, and regression patterns.
- **Eval results** — failures, weak coverage, or missing evals.
- **User corrections** — places where the user had to steer or repair the skill's behavior.
- **Recent prompts / examples** — prompts that should or should not have triggered the skill.

If an evidence source is unavailable, say so and continue with the sources you do have.

## Audit checklist

For each skill, check:

1. **Description accuracy** — does the `description` still match what the skill actually does?
2. **Trigger quality** — too broad, too narrow, or missing important trigger phrases.
3. **Structure drift** — missing required sections, bloated SKILL.md, or detail that should live in `references/`.
4. **Reference hygiene** — orphaned files in `references/`, missing table entries, or stale "load when..." guidance.
5. **Failure modes** — weak or missing `## Limits`, unhandled edge cases, or unclear stop conditions.
6. **Script quality** — interactive prompts, weak error handling, or output that is not deterministic enough for agent use.
7. **Lifecycle fit** — should this be simplified, split, merged, retired, or promoted to an extension?

## Prioritization

Report findings in this order:

1. **Broken / misleading** — invalid structure, stale description, missing limits, unsafe scripts.
2. **High leverage** — fixes that improve triggering, clarity, or repeated failures.
3. **Nice to have** — cleanup, wording, or small reorganizations.

Recommend only the top few changes worth acting on now.

## Output

Present the audit as a short list:

- **Skill**
- **Issue**
- **Evidence**
- **Recommended change**
- **Priority**

Then ask the user which items to apply.

## After approval

- Fix the approved items.
- Re-validate each changed skill.
- Re-evaluate when the changes affect behavior, triggers, or outputs.
- Commit only if changes were made:
  - `meta: self-audit — <count> improvements applied`
  - If nothing changed, report the result and do not force a no-op commit.
