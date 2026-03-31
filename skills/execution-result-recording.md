# execution-result-recording

## Identity

- `skill_code`: `execution-result-recording`
- `skill_name`: Execution Result Recording
- `skill_version`: `v1`
- `owned_by`: `投递专员`

## Purpose

Record what actually happened during execution in a way downstream systems can trust.

## Required Inputs

- submission attempt result

## Optional Inputs

- platform response hints
- failure reason
- next suggested stage

## Output Schema

```ts
type ExecutionResultRecordingOutput = {
  execution_outcome: "submitted" | "partially_submitted" | "failed" | "blocked"
  failure_reason_code?: string
  next_stage_hint?: string
  summary_text: string
}
```

## Core Rules

- never report success unless success was actually observed
- partial success must remain partial
- blocked should remain distinct from failed

## Failure Modes

- platform result unclear
- inconsistent execution traces

## Fallback Path

- prefer conservative outcome reporting

## Quality Gates

- execution result must remain auditable
- downstream systems must be able to trust the high-level outcome

## Observability Fields

- `execution_outcome`
- `failure_reason_code`
- `next_stage_hint`
- `summary_text`
