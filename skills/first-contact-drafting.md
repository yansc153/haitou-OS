# first-contact-drafting

## Identity

- `skill_code`: `first-contact-drafting`
- `skill_name`: First Contact Drafting
- `skill_version`: `v1`
- `owned_by`: `招聘关系经理`

## Purpose

Draft a low-risk, platform-contained first-touch message that credibly opens conversation without crossing into private-channel or user-owned commitments.

## Required Inputs

- approved opportunity summary
- profile baseline

## Optional Inputs

- JD excerpt
- platform context
- target language

## Output Schema

```ts
type FirstContactDraftingOutput = {
  message_language: "zh" | "en"
  draft_text: string
  value_points: string[]
  compliance_status: "ready" | "needs_review" | "blocked"
  summary_text: string
}
```

## Core Rules

- remain low-risk
- remain platform-contained
- do not invite private-channel transfer by default
- do not fabricate value points

## Failure Modes

- insufficient fit context
- weak profile basis
- platform context unclear

## Fallback Path

- shorten and generalize conservatively
- block if safe contact is not possible

## Quality Gates

- no fabricated achievements
- no private-channel invitation by default
- no salary / timing / personal-commitment promises

## Observability Fields

- `message_language`
- `value_points`
- `compliance_status`
- `summary_text`
