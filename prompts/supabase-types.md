---
description: Generate TypeScript types from the connected Supabase schema
argument-hint: "[output path]"
---
Regenerate Supabase TypeScript types from the linked project.

1. Load the `supabase` skill.
2. Determine the project's package manager (for example Bun) from its lockfile and prefix every `supabase` command accordingly.
3. Run `supabase gen types --linked` and write stdout to ${1:-the path the project already uses for generated types}.
4. Update any call sites the new types affect.
5. Report the files changed and any usage that no longer type-checks.
