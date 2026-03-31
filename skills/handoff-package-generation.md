# handoff-package-generation

## Identity

- `skill_code`: `handoff-package-generation`
- `skill_name`: Handoff Package Generation
- `skill_version`: `v1`
- `owned_by`: `招聘关系经理`

## Purpose

Package the exact context the user needs when automation must stop and the next move belongs to the user.

## Required Inputs

- conversation thread summary
- latest opportunity summary

## Optional Inputs

- suggested reply draft
- tailored materials
- cover letter output

## Output Schema

```ts
type HandoffPackageGenerationOutput = {
  handoff_reason: string
  context_summary: string
  suggested_next_action?: string
  suggested_reply_text?: string
  included_assets?: Array<{
    asset_type: "resume" | "cover_letter" | "summary" | "reply_draft"
    asset_ref?: string
  }>
  summary_text: string
}
```

## Core Rules

- clearly state why automation stops
- package enough context so the user does not need to reconstruct the whole thread
- remain assistive, not representative

## Failure Modes

- incomplete thread context
- missing linked assets

## Fallback Path

- produce best-available summary
- mark missing assets explicitly

## Quality Gates

- handoff reason must be explicit
- next action must be user-usable
- package must not imply that the system already completed the user-owned action

## Observability Fields

- `handoff_reason`
- `suggested_next_action`
- `included_assets`
- `summary_text`
