---
description: Plan and commit a Supabase schema change as a clean migration
argument-hint: "<schema change to make>"
---
Make this Supabase schema change: ${@:-<describe the change>}

Work through the bundled skills:

1. Load the `supabase` and `supabase-postgres-best-practices` skills.
2. Determine the project's package manager (for example Bun) from its lockfile and prefix every `supabase` command accordingly.
3. Detect whether the project uses declarative schemas (`supabase/schemas/`) or imperative migrations, and follow that workflow.
4. Iterate with the MCP `execute_sql` tool. Do not use `apply_migration` to change a local schema — it writes a migration-history entry on every call.
5. Run advisors (`get_advisors`) and fix any security or performance findings.
6. Generate the migration with `supabase db pull <descriptive-name> --local --yes`, then verify with `supabase migration list --local`.
7. Summarize the change, the migration file, and anything that needs review.
