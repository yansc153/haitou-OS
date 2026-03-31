# opportunity-discovery

## Identity

- `skill_code`: `opportunity-discovery`
- `skill_name`: Opportunity Discovery
- `skill_version`: `v1`
- `owned_by`: `岗位研究员`

## Purpose

Find relevant opportunity candidates across available channels and keep the opportunity pool broad, current, and source-traceable.

## Required Inputs

- user target direction or baseline
- available platform scope
- current strategy mode

## Optional Inputs

- preferred region
- language preference
- recency window
- platform-specific availability signals

## Output Schema

```ts
type OpportunityDiscoveryOutput = {
  discovered_candidates: Array<{
    external_ref?: string
    company_name?: string
    job_title?: string
    region_hint?: string
    source_platform?: string
    freshness_hint?: "new" | "recent" | "stale" | "unknown"
  }>
  discovery_scope_summary: string
  summary_text: string
}
```

## Core Rules

- discovery must preserve breadth
- source traceability matters more than false completeness
- absence of perfect detail is not itself a reason to drop candidates

## Failure Modes

- no platform access
- search scope too narrow
- source coverage temporarily weak

## Fallback Path

- widen within allowed user target boundaries
- keep partial candidate output
- explicitly mark weak discovery windows

## Quality Gates

- no invented jobs
- no aggressive hidden filtering
- maintain source-platform traceability

## Observability Fields

- `discovered_candidates`
- `discovery_scope_summary`
- `summary_text`
