# confidence-signaling

## Identity

- `skill_code`: `confidence-signaling`
- `skill_name`: Confidence Signaling
- `skill_version`: `v1`
- `owned_by`: `shared`

## Purpose

Provide a lightweight confidence signal so downstream systems know whether an output is strong, partial, or uncertain.

## Required Inputs

- structured role output

## Optional Inputs

- missing-field indicators
- source completeness
- conflict severity

## Output Schema

```ts
type ConfidenceSignalingOutput = {
  confidence_band: "high" | "medium" | "low"
  confidence_reason_tags?: string[]
  summary_text: string
}
```

## Core Rules

- stay qualitative, not pseudo-mathematical
- preserve uncertainty visibility
- do not inflate confidence to make routing easier

## Failure Modes

- no good certainty basis
- upstream output already too ambiguous

## Fallback Path

- default to medium or low

## Quality Gates

- confidence must remain explainable
- low certainty must be visible, not hidden

## Observability Fields

- `confidence_band`
- `confidence_reason_tags`
- `summary_text`
