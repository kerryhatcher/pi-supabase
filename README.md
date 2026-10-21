# pi-supabase

A [Pi](https://pi.dev) package that ports the official
[Supabase plugin](https://github.com/supabase-community/supabase-plugin) to Pi.
One install adds the hosted Supabase MCP server, the Supabase agent skills, a
destructive-write hook, slash commands, and a diagnostics script.

This package is intentionally self-contained so it can be shared (npm, git, or a
local path) without changes.

## Feature parity

The official plugin is a multi-vendor distribution whose surfaces combine MCP
servers, skills, hooks, agents, slash commands, and context. Pi supports most of
those as package resources:

| Official plugin feature | Pi implementation |
|---|---|
| Supabase MCP server | `extensions/supabase.ts` → `pi.registerMcpServer("supabase", …)` |
| `project_ref`, `read_only`, `features`, `skip_elicitations` | Environment variables appended as URL query parameters (`src/config.ts`) |
| Interactive OAuth sign-in | Pi's built-in flow: `/mcp` → **Sign in** |
| CI / non-interactive auth | `SUPABASE_ACCESS_TOKEN` sent as `Authorization: Bearer …` |
| `supabase` skill | `skills/supabase/` |
| `supabase-postgres-best-practices` skill | `skills/supabase-postgres-best-practices/` |
| Hooks | `tool_call` write guard for mutating tools (see [Safety](#safety)) |
| Slash commands | `prompts/supabase-*.md` plus the `/supabase` status command |
| Scripts | `scripts/check-setup.ts` (`bun run check`) |
| Client attribution | `X-Source-Name: pi-plugin` and `X-Source-Version` from `package.json` |
| Specialized sub-agents | Not a Pi package primitive; see [Notes](#notes) |
| Brand assets / theme | Not bundled |

## Files

```
pi-supabase/
├── package.json              # pi manifest: extensions, skills, prompts
├── src/config.ts             # env → MCP config, shared by the extension and script
├── extensions/supabase.ts    # MCP registration, write-guard hook, /supabase command
├── scripts/check-setup.ts    # connectivity + CLI diagnostics
├── skills/                   # vendored from supabase/agent-skills
│   ├── supabase/
│   └── supabase-postgres-best-practices/
└── prompts/
    ├── supabase-migration.md
    ├── supabase-audit.md
    ├── supabase-types.md
    └── supabase-debug.md
```

The skills are vendored unmodified from
[`supabase/agent-skills`](https://github.com/supabase/agent-skills); see
[Agent Skills](https://supabase.com/docs/guides/ai-tools/ai-skills) and the MCP
server docs at <https://supabase.com/docs/guides/ai-tools/mcp>.

## Install

```bash
pi install git:github.com/kerryhatcher/pi-supabase
pi install /mnt/storage/projects/pi-supabase   # local checkout
```

Add `--local`/`-l` to install into a project's `.pi/settings.json`. Run
`/reload` in a Pi session after changing the package.

### Use it in the civpulse repository

[www.civpulse.org](https://github.com/kerryhatcher/www.civpulse.org) loads the
package through project settings from the sibling checkout. Its
`.pi/settings.json` points at both Pi packages:

```json
{
  "packages": ["../../pi-astro", "../../pi-supabase"]
}
```

## Authenticate

The hosted server uses OAuth 2.1 and needs no configuration. Run `/mcp`, select
`supabase`, and choose **Sign in**. In CI, set a scoped `SUPABASE_ACCESS_TOKEN`
instead; the extension passes it as a `Bearer` header, which disables OAuth.

## Configuration

Everything is environment-driven, so one package works for hosted projects,
local stacks, and CI.

| Variable | Effect |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Scoped personal access token sent as `Authorization: Bearer …` (CI / non-interactive). |
| `SUPABASE_PROJECT_REF` | Append `?project_ref=<ref>` to scope the server to one project (disables account tools). |
| `SUPABASE_MCP_LOCAL=true` | Use `http://localhost:54321/mcp` from a running `supabase start`. |
| `SUPABASE_MCP_URL=<url>` | Override the server URL entirely. |
| `SUPABASE_MCP_READ_ONLY=true` | Append `?read_only=true` to run queries as a read-only role. |
| `SUPABASE_MCP_FEATURES=<a,b>` | Append `?features=…` to enable only the named tool groups. |
| `SUPABASE_MCP_SKIP_ELICITATIONS=<tools>` | Append `?skip_elicitations=…` to skip named form confirmations. |
| `SUPABASE_MCP_EXPOSURE=<mode>` | `codemode` (default), `deferred`, or `direct`. Supabase exposes many tools, so `codemode` keeps the model's tool list small. |
| `SUPABASE_MCP_DISABLED=true` | Do not register the server; skills and prompts still load. |
| `SUPABASE_MCP_CONFIRM_WRITES=off` | Disable the write guard. On by default; see [Safety](#safety). |

Examples:

```bash
# Read-only connection to one hosted project
export SUPABASE_PROJECT_REF=abcdefghijklmnop
export SUPABASE_MCP_READ_ONLY=true

# Local Supabase CLI stack
supabase start
export SUPABASE_MCP_LOCAL=true
pi
```

A Supabase entry in `~/.pi/agent/mcp.json` or `.pi/mcp.json` with the same name
takes precedence over the extension registration; `/mcp` then shows the server
as overridden and the environment configuration is ignored.

## Commands and script

- `/supabase` — print the effective URL, exposure, auth mode, and write-guard state.
- `/supabase-migration` — plan and commit a schema change as a clean migration.
- `/supabase-audit` — RLS, security, and performance audit.
- `/supabase-types` — regenerate TypeScript types from the linked project.
- `/supabase-debug` — diagnose an error with logs, advisors, and the docs.
- `bun run check` — run `scripts/check-setup.ts` to verify reachability, auth mode, and the Supabase CLI.

## Safety

Pi does **not** support MCP elicitations, so the server's own destructive-SQL and
cost confirmations do not reach the UI. To keep parity with the official clients,
the extension installs a `tool_call` hook that confirms:

- any tool that changes a project (`apply_migration`, `deploy_edge_function`,
  branch/project/storage management, and Edge Function secrets), and
- `execute_sql` only when the query contains mutating SQL. Plain `SELECT`s pass
  through.

The guard is on by default. In modes without a dialog it **fails closed**:
writes are blocked with an explanation. For unattended runs, use
`SUPABASE_MCP_READ_ONLY=true` (preferred) or set
`SUPABASE_MCP_CONFIRM_WRITES=off`.

The MCP server acts with your developer permissions and is a local developer
tool, not something to hand to end users. Prefer project scoping, read-only mode,
and restricted feature groups. See
[Supabase MCP security risks](https://supabase.com/docs/guides/ai-tools/mcp#security-risks).

## Notes

- **Sub-agents.** The official plugin format can bundle specialized sub-agents.
  Pi has no package-level sub-agent primitive; the closest fit is a custom tool
  that makes nested model calls, which would add a lot of surface for little
  gain here. The skills and prompts carry the guidance instead.
- **Context files.** The Gemini surface ships a `SUPABASE.md` context file. Its
  still-valid guidance (package-manager prefixes, type generation, log types) is
  folded into the prompts and the skills rather than duplicated as a context
  document.
- **Precedence.** A same-named server in `mcp.json` always wins, so installing
  this package never double-connects an existing hand-written setup.

## Requirements

- Pi `1.3.0` or newer (for `pi.registerMcpServer`).
- Network access to `https://mcp.supabase.com/mcp`, or a local Supabase CLI
  stack for `SUPABASE_MCP_LOCAL`.
- [Bun](https://bun.sh) for `bun run check` and the commands in the skills.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations and
  type generation.
