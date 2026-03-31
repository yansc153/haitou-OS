# submission-planning

## Identity

- `skill_code`: `submission-planning`
- `skill_name`: Submission Planning
- `skill_version`: `v1`
- `owned_by`: `投递专员`

## Purpose

Plan the safest executable application path before any live submission action starts.

## Required Inputs

- opportunity summary
- current platform identity
- recommendation output

## Optional Inputs

- material availability
- platform session state
- language posture

## Output Schema

```ts
type SubmissionPlanningOutput = {
  submission_mode: "standard_form" | "multi_step_form" | "api_submission" | "conversation_entry"
  required_assets: string[]
  required_fields: string[]
  expected_complexity: "low" | "medium" | "high"
  proceed_allowed: boolean
  summary_text: string
}
```

## Core Rules

- no execution should start without a plan
- conversation-entry should remain distinct from standard form submission
- missing assets or missing session should block or defer execution

## Failure Modes

- incomplete application context
- missing required material
- platform state unavailable

## Fallback Path

- block or defer
- surface missing requirements clearly

## Quality Gates

- do not improvise hidden execution paths
- keep platform mode explicit

## Observability Fields

- `submission_mode`
- `required_assets`
- `required_fields`
- `expected_complexity`
- `proceed_allowed`
- `summary_text`
