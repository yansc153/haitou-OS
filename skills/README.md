# Skills Directory

This directory stores extracted skill definitions that are derived from:

- `/Users/oxjames/Downloads/CC_testing/海投助手OS/Spec Stack Plan/AGENT_SKILL_AND_PROMPT_SPEC.md`

Purpose:

- keep individual high-value skills easy to read and maintain
- support future platform-specific or role-specific skill files
- avoid burying every skill detail inside one very long master spec

Rules:

- the master spec remains the system-level contract
- extracted skill files must stay consistent with the master spec
- when a skill is materially updated here, the master spec should also be updated
- file names should match `skill_code`
- extracted skill files should follow the same core schema shape as the master spec where practical

Sync rule:

- if the master spec and an extracted skill file differ, the mismatch must be resolved explicitly
- extracted files are not allowed to drift silently

Review checklist:

- does the skill define purpose clearly
- does it define required and optional inputs
- does it define output schema
- does it define failure modes and fallback path
- does it define quality gates
- does it define observability fields
- does it define attach and detach conditions
- does it respect role boundary and truthfulness rules

Recommended extracted skill template:

1. identity
2. purpose
3. required inputs
4. optional inputs
5. output schema
6. core rules
7. failure modes
8. fallback path
9. quality gates
10. observability fields

Current extracted skills:

- `visual-fidelity-preservation.md`
- `cover-letter-generation.md`
- `opportunity-discovery.md`
- `fit-evaluation.md`
- `recommendation-generation.md`
- `submission-planning.md`
- `field-mapping.md`
- `execution-result-recording.md`
- `first-contact-drafting.md`
- `reply-reading.md`
- `handoff-package-generation.md`
- `summary-generation.md`
- `reason-tagging.md`
- `confidence-signaling.md`
- `language-adaptation.md`
