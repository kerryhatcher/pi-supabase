---
description: Audit a Supabase project for RLS, security, and performance issues
argument-hint: "[tables or area to focus on]"
---
Audit the connected Supabase project for RLS, security, and performance issues.

Focus area: ${@:-the whole project}.

Use the `supabase` and `supabase-postgres-best-practices` skills. Check at least:

- RLS enabled on every table and on views (`security_invoker`), policies scoped with `TO`, and UPDATE policies that have both `USING` and `WITH CHECK`.
- Authorization decisions that never trust `user_metadata`, and `SECURITY DEFINER` only where genuinely required and safely scoped.
- Missing indexes, N+1 query patterns, and connection/pooling problems.
- MCP `get_advisors` output.

Report findings ordered by severity, each with the offending object and a concrete fix. Do not change anything without confirmation.
