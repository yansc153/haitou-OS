# field-mapping

## Identity

- `skill_code`: `field-mapping`
- `skill_name`: Field Mapping
- `skill_version`: `v1`
- `owned_by`: `投递专员`

## Purpose

Map known profile and material data into platform-required fields without inventing missing values.

## Required Inputs

- submission plan
- profile baseline
- available materials

## Optional Inputs

- platform field hints
- target language
- localized materials

## Output Schema

```ts
type FieldMappingOutput = {
  mapped_fields: Array<{
    field_name: string
    mapped_value?: string
    source_basis?: string[]
    completeness: "filled" | "partial" | "missing"
  }>
  missing_required_fields?: string[]
  summary_text: string
}
```

## Core Rules

- every filled field must be source-grounded
- missing required fields must remain explicit
- unsupported personal fields must not be guessed

## Failure Modes

- no truthful source value
- ambiguous field meaning
- required personal information missing

## Fallback Path

- mark missing
- block or defer if required

## Quality Gates

- no invented phone, email, salary, visa, or availability claims
- no pretending partial fields are complete

## Observability Fields

- `mapped_fields`
- `missing_required_fields`
- `summary_text`
