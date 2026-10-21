---
description: Diagnose a Supabase error using logs, advisors, and the docs
argument-hint: "<error or symptom>"
---
Diagnose this Supabase problem: ${@:-<paste the error or describe the symptom>}

1. Load the `supabase` skill and follow its debugging guidance.
2. Run `bun run scripts/check-setup.ts` to confirm the MCP connection, URL, and CLI.
3. Fetch Supabase's Monitoring and Debugging docs (append `.md` to the page URL) before proposing a fix — do not diagnose from memory.
4. Inspect the relevant MCP logs (`get_logs` with `api`, `postgres`, `auth`, `storage`, `edge-function`, or `realtime`) and `get_advisors`.
5. List the likely causes with the evidence for each, then the smallest fix. Do not change anything without confirmation.
