# reason-tagging

## Identity

- `skill_code`: `reason-tagging`
- `skill_name`: Reason Tagging
- `skill_version`: `v1`
- `owned_by`: `shared`

## Purpose

Attach compact reason tags to outputs so decisions remain explainable across orchestration, UI, and review layers.

## Required Inputs

- structured decision or action output

## Optional Inputs

- source quality signal
- conflict signal
- boundary signal

## Output Schema

```ts
type ReasonTaggingOutput = {
  reason_tags: string[]
  summary_text: string
}
```

## Core Rules

- tags should be compact
- tags should be reusable
- tags should map to real decision basis

## Failure Modes

- weak basis
- tags too generic to be useful

## Fallback Path

- emit fewer, clearer tags
- include uncertainty tags when needed

## Quality Gates

- no invented reasons
- no bloated tag lists that hide the real basis

## Observability Fields

- `reason_tags`
- `summary_text`
