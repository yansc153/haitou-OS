# fit-evaluation

## Identity

- `skill_code`: `fit-evaluation`
- `skill_name`: Fit Evaluation
- `skill_version`: `v1`
- `owned_by`: `匹配审核员`

## Purpose

Assess whether an opportunity is broadly aligned enough with the user's known direction to justify advancement, observation, or further clarification.

## Required Inputs

- profile baseline
- source record or opportunity summary

## Optional Inputs

- JD excerpt
- source quality tag
- strategy mode

## Output Schema

```ts
type FitEvaluationOutput = {
  fit_posture: "strong" | "moderate" | "weak" | "uncertain"
  fit_reason_tags: string[]
  summary_text: string
}
```

## Core Rules

- fit should remain recommendation-oriented, not falsely numeric
- weak context should surface uncertainty, not fake precision
- broad opportunity strategy should remain intact

## Failure Modes

- source too incomplete
- profile baseline too weak
- target direction ambiguous

## Fallback Path

- return `uncertain`
- preserve missing-context markers

## Quality Gates

- do not over-claim certainty
- do not narrow the opportunity field more than the evidence supports

## Observability Fields

- `fit_posture`
- `fit_reason_tags`
- `summary_text`
