# cover-letter-generation

## Identity

- `skill_code`: `cover-letter-generation`
- `skill_name`: Cover Letter Generation
- `skill_version`: `v1`
- `owned_by`: `简历顾问`

## Purpose

Generate a truthful, opportunity-aligned cover letter that is actually usable as copy, not just a bag of metadata.

## Required Inputs

- profile baseline
- target opportunity summary

## Optional Inputs

- JD highlights
- target language
- user preference notes

## Output Schema

```ts
type CoverLetterGenerationOutput = {
  target_language: "zh" | "en"
  subject_line?: string
  opening: string
  interest_statement: string
  fit_argument: string
  closing: string
  cover_letter_text: string
  supporting_reason_tags: string[]
  summary_text: string
}
```

## Composition Requirements

The output must read as a complete message with real sentences and coherent flow.

It should include:

1. a usable opening
2. a clear expression of interest
3. a grounded explanation of fit
4. a clean closing
5. one full assembled letter body

## Truthfulness Rules

- do not invent achievements
- do not claim experience not supported by profile baseline
- do not overstate certainty of fit
- do not imply direct commitments the user did not make

## Fallback Rules

If the opportunity context is weak:

- write a shorter and more conservative letter
- keep claims broad but factual
- defer if the target context is too incomplete for a trustworthy letter

## Quality Gates

- the letter must be sendable as prose
- the letter must stay aligned with the same truthfulness standard as resume rewriting
- the fit argument must be grounded in known experience themes
- the final text must not feel like placeholder fragments stitched together

## Observability Fields

- `target_language`
- `supporting_reason_tags`
- `summary_text`

## Notes

In v1 this remains one core skill.
Future versions may internally split it into planning and writing phases, but externally it should still behave as one reliable capability.
