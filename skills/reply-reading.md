# reply-reading

## Identity

- `skill_code`: `reply-reading`
- `skill_name`: Reply Reading
- `skill_version`: `v1`
- `owned_by`: `招聘关系经理`

## Purpose

Read incoming platform-contained replies and turn them into structured signals the team can act on.

## Required Inputs

- incoming reply content
- conversation context

## Optional Inputs

- thread history
- platform metadata

## Output Schema

```ts
type ReplyReadingOutput = {
  reply_posture: "positive" | "neutral" | "unclear" | "handoff_trigger"
  extracted_signals: string[]
  asks_or_requests?: string[]
  next_step_hint?: string
  summary_text: string
}
```

## Core Rules

- do not over-read weak interest
- detect private-channel requests explicitly
- preserve recruiter asks clearly

## Failure Modes

- ambiguous reply
- incomplete thread context

## Fallback Path

- return `unclear`
- preserve weak signals conservatively

## Quality Gates

- keep signal extraction auditable
- do not hide handoff-triggering asks

## Observability Fields

- `reply_posture`
- `extracted_signals`
- `asks_or_requests`
- `next_step_hint`
- `summary_text`
