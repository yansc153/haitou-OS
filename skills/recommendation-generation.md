# recommendation-generation

## Identity

- `skill_code`: `recommendation-generation`
- `skill_name`: Recommendation Generation
- `skill_version`: `v1`
- `owned_by`: `匹配审核员`

## Purpose

Turn fit, conflict, strategy, and source signals into one downstream-actionable recommendation.

## Required Inputs

- fit evaluation output
- conflict detection output

## Optional Inputs

- strategy-aware filtering output
- source quality signaling output
- freshness scanning output

## Output Schema

```ts
type RecommendationGenerationOutput = {
  recommendation: "advance" | "watch" | "drop" | "needs_context"
  reason_tags: string[]
  next_step_hint?: string
  summary_text: string
}
```

## Core Rules

- recommendation must be actionable
- recommendation must be explainable
- mixed evidence should prefer `watch` or `needs_context` over overconfident `drop`

## Failure Modes

- contradictory upstream signals
- missing critical context

## Fallback Path

- prefer `needs_context`
- use `watch` when the job may still be worth keeping visible

## Quality Gates

- preserve opportunity breadth where evidence is mixed
- do not hide the reasoning basis

## Observability Fields

- `recommendation`
- `reason_tags`
- `next_step_hint`
- `summary_text`
