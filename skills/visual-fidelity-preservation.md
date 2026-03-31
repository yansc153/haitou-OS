# visual-fidelity-preservation

## Identity

- `skill_code`: `visual-fidelity-preservation`
- `skill_name`: Visual Fidelity Preservation
- `skill_version`: `v1`
- `owned_by`: `简历顾问`

## Purpose

Preserve the original resume's visual structure, spacing intent, section placement, and formatting logic while allowing adaptive rebalancing so the final output still feels like the same resume, not a redesigned replacement.

## Core Principles

1. Preserve the original design logic first.
2. Adapt only as much as needed to keep the output complete and visually balanced.
3. Never invent content just to fill space.
4. Prefer local rebalancing over structural redesign.

## Required Inputs

- source resume layout hints
- source section order
- edited content candidate

## Optional Inputs

- font similarity hint
- page count target
- bullet style hint
- known fixed elements such as avatar or header placement

## Output Schema

```ts
type VisualFidelityPreservationOutput = {
  preservation_mode: "strict" | "adaptive" | "content_only_fallback"
  layout_preservation_notes: string[]
  page_count_target?: number
  adaptive_actions?: Array<"font_adjustment" | "spacing_rebalance" | "content_fill" | "section_reflow">
  formatting_risks?: string[]
  summary_text: string
}
```

## Preservation Modes

### `strict`

Use when the original layout can be preserved with minimal spacing or content movement.

### `adaptive`

Use when direct preservation would leave obvious visual damage, such as:

- oversized whitespace
- broken page balance
- awkward bullet spacing
- severe section imbalance

Allowed adaptive actions:

- modest font adjustment
- spacing rebalance
- truthful content fill within the same section
- section reflow that keeps overall visual identity intact

### `content_only_fallback`

Use only when the original formatting cannot be safely reconstructed.

This is a last resort, not a default path.

## Layout Adaptation Rules

If a content change causes major blank space or a broken composition, the system should try, in this order:

1. small font or spacing adjustment
2. truthful densification inside the same section
3. moving lower content upward to rebalance the page

The system should not:

- radically redesign the resume
- invent new bullets or achievements
- relocate fixed header identity blocks without technical necessity

## Quality Gates

- keep bullet logic if the original used bullets
- preserve fixed visual elements unless impossible
- avoid leftover blank lines, orphan bullets, or spacing artifacts
- keep the final document looking intentional and complete
- if adaptation is used, record which adaptive actions were applied

## Failure Modes

- original layout hints too weak
- parse lost too much structure
- rewritten content cannot fit the page cleanly

## Fallback Path

- move from `strict` to `adaptive`
- use `content_only_fallback` only if preservation is no longer technically safe

## Observability Fields

- `preservation_mode`
- `adaptive_actions`
- `formatting_risks`
- `summary_text`

## Notes

This skill exists to enforce a very specific product promise:

`the system may improve the resume, but it should not casually destroy the user's existing visual identity`
