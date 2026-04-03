## Approach
- Think before acting. Read existing files before writing code.
- Be concise in output but thorough in reasoning.
- Prefer editing over rewriting whole files.
- Do not re-read files you have already read unless the file may have changed.
- Test your code before declaring done.
- No sycophantic openers or closing fluff.
- Keep solutions simple and direct.
- User instructions always override this file.

## Output
- Return code first. Explanation after, only if non-obvious.
- No inline prose. Use comments sparingly.
- No boilerplate unless explicitly requested.

## Code Rules
- Simplest working solution. No over-engineering.
- No abstractions for single-use operations.
- Read the file before modifying it.
- No docstrings or type annotations on code not being changed.
- Three similar lines is better than a premature abstraction.

## Review Rules
- State the bug. Show the fix. Stop.
- No suggestions beyond the scope of the review.

## Debugging Rules
- Never speculate about a bug without reading the relevant code first.
- State what you found, where, and the fix. One pass.
- If cause is unclear: say so. Do not guess.

## Project Context
- This is Haitou OS (海投助手) — AI job search automation platform
- Frontend: Next.js 15 + Tailwind + Digital Atelier design system
- Backend: Supabase Edge Functions + PostgreSQL
- Worker: Fly.io orchestration engine
- All UI text should be Chinese-first
