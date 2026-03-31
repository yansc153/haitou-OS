# language-adaptation

## Identity

- `skill_code`: `language-adaptation`
- `skill_name`: Language Adaptation
- `skill_version`: `v1`
- `owned_by`: `shared`

## Purpose

Adapt output language, phrasing posture, and surface tone to the correct locale or market context without changing factual meaning.

## Required Inputs

- source structured output or text
- target language or locale

## Optional Inputs

- platform locale
- JD language
- UI surface hint

## Output Schema

```ts
type LanguageAdaptationOutput = {
  target_language: "zh" | "en" | "bilingual"
  adapted_text?: string
  adaptation_scope: "surface_only" | "content_level"
  summary_text: string
}
```

## Core Rules

- adapt language without drifting factual meaning
- surface tone may change, but role boundary may not
- bilingual outputs must remain semantically aligned

## Failure Modes

- target language ambiguous
- mixed-language source too inconsistent

## Fallback Path

- stay in source language
- preserve structure and mark adaptation uncertainty

## Quality Gates

- meaning-preservation is mandatory
- adapted tone must still match the role that uses it
- bilingual output must not create hidden divergence

## Observability Fields

- `target_language`
- `adaptation_scope`
- `summary_text`
