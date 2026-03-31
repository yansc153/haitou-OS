# summary-generation

## Identity

- `skill_code`: `summary-generation`
- `skill_name`: Summary Generation
- `skill_version`: `v1`
- `owned_by`: `shared`

## Purpose

Generate concise summaries that remain faithful to structured source output and can be reused across UI, audit, handoff, and internal orchestration surfaces.

## Required Inputs

- structured upstream output

## Optional Inputs

- locale
- UI surface hint
- summary length hint

## Output Schema

```ts
type SummaryGenerationOutput = {
  summary_text: string
  summary_type: "ui" | "audit" | "handoff" | "internal"
  summary_length: "short" | "medium"
}
```

## Core Rules

- summarize facts, not fantasies
- different surfaces may need different density, but not different truth
- when basis is weak, shorten instead of embellishing

## Failure Modes

- upstream output too incomplete
- conflicting structured signals

## Fallback Path

- keep only high-confidence facts
- omit uncertain interpretation

## Quality Gates

- source faithfulness is mandatory
- summary must fit target surface without distorting meaning

## Observability Fields

- `summary_type`
- `summary_length`
- `summary_text`
