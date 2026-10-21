/**
 * Shared configuration for the pi-supabase package.
 *
 * Resolves the Supabase MCP server settings from the environment and describes
 * them for the `/supabase` command and `scripts/check-setup.ts`. Keeping this
 * here means the extension and the diagnostics script never disagree about the
 * effective URL, exposure, or write guard.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SERVER_NAME = "supabase";
export const HOSTED_URL = "https://mcp.supabase.com/mcp";
export const LOCAL_URL = "http://localhost:54321/mcp";
export const TOOL_PREFIX = `mcp__${SERVER_NAME}__`;

export const SERVER_DESCRIPTION =
	"Query and manage a Supabase project: list tables, run SQL, apply migrations, inspect logs and advisors, deploy Edge Functions, and search Supabase docs.";

export const EXPOSURES = ["codemode", "deferred", "direct", "hidden"] as const;
export type Exposure = (typeof EXPOSURES)[number];

/** The attribution headers every official Supabase plugin surface sends. */
export const SOURCE_NAME = "pi-plugin";

/**
 * Tools that always change a project, plus `execute_sql`, which only changes
 * data when its query is destructive (a plain SELECT does not need approval).
 */
const ALWAYS_WRITE_TOOLS = new Set([
	"apply_migration",
	"deploy_edge_function",
	"create_edge_function_secret",
	"create_project",
	"pause_project",
	"restore_project",
	"create_branch",
	"merge_branch",
	"reset_branch",
	"rebase_branch",
	"delete_branch",
	"update_storage_config",
]);

/** SQL that mutates data or schema. Mirrors the server's own destructive-SQL check. */
const DESTRUCTIVE_SQL =
	/\b(drop|alter|create|truncate|grant|revoke|comment|insert|update|delete|merge|call|do|copy|vacuum|analyze|reindex|cluster|refresh)\b/i;

export interface SupabaseMcpConfig {
	/** Effective server URL, including scope and feature-group query parameters. */
	url: string;
	/** Extra headers. Set from `SUPABASE_ACCESS_TOKEN` for CI / non-interactive use. */
	headers?: Record<string, string>;
	/** How the model reaches the server's tools. */
	exposure: Exposure;
	/** Do not register the server; skills and prompts still load. */
	disabled: boolean;
	/** Confirm mutating tool calls before they run. Default: true (Pi has no MCP elicitations). */
	confirmWrites: boolean;
}

function env(source: NodeJS.ProcessEnv, name: string): string | undefined {
	const value = source[name];
	return value && value.trim() !== "" ? value.trim() : undefined;
}

function isTruthy(value: string | undefined): boolean {
	if (!value) return false;
	return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

function isFalsy(value: string | undefined): boolean {
	if (!value) return false;
	return ["0", "false", "no", "off"].includes(value.toLowerCase());
}

function resolveExposure(source: NodeJS.ProcessEnv): Exposure {
	const value = env(source, "SUPABASE_MCP_EXPOSURE")?.toLowerCase();
	return (EXPOSURES as readonly string[]).includes(value ?? "") ? (value as Exposure) : "codemode";
}

function buildUrl(source: NodeJS.ProcessEnv): string {
	const base = isTruthy(env(source, "SUPABASE_MCP_LOCAL"))
		? LOCAL_URL
		: (env(source, "SUPABASE_MCP_URL") ?? HOSTED_URL);

	const params = new URLSearchParams();
	const projectRef = env(source, "SUPABASE_PROJECT_REF") ?? env(source, "SUPABASE_MCP_PROJECT_REF");
	if (projectRef) params.set("project_ref", projectRef);
	if (isTruthy(env(source, "SUPABASE_MCP_READ_ONLY"))) params.set("read_only", "true");
	const features = env(source, "SUPABASE_MCP_FEATURES");
	if (features) params.set("features", features);
	const skip = env(source, "SUPABASE_MCP_SKIP_ELICITATIONS");
	if (skip) params.set("skip_elicitations", skip);

	const query = params.toString();
	if (!query) return base;
	return `${base}${base.includes("?") ? "&" : "?"}${query}`;
}

export function resolveConfig(source: NodeJS.ProcessEnv = process.env): SupabaseMcpConfig {
	const token = env(source, "SUPABASE_ACCESS_TOKEN");
	const confirmWrites = env(source, "SUPABASE_MCP_CONFIRM_WRITES");
	return {
		url: buildUrl(source),
		headers: token ? { Authorization: `Bearer ${token}` } : undefined,
		exposure: resolveExposure(source),
		disabled: isTruthy(env(source, "SUPABASE_MCP_DISABLED")),
		// Default on: Pi does not support MCP elicitations, so the server's own
		// destructive-SQL and cost confirmations are unavailable here.
		confirmWrites: confirmWrites === undefined ? true : !isFalsy(confirmWrites),
	};
}

/** Read this package's version so `X-Source-Version` tracks releases. */
export function readPluginVersion(): string {
	try {
		const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
		const raw = readFileSync(join(packageRoot, "package.json"), "utf8");
		return (JSON.parse(raw) as { version?: string }).version ?? "0.0.0";
	} catch {
		return "0.0.0";
	}
}

export function authLabel(config: SupabaseMcpConfig): string {
	return config.headers ? "bearer token (SUPABASE_ACCESS_TOKEN)" : "OAuth — run /mcp to sign in";
}

/** Whether a Supabase tool call mutates data or schema and needs confirmation. */
export function isWriteTool(tool: string, input: Record<string, unknown>): boolean {
	if (ALWAYS_WRITE_TOOLS.has(tool)) return true;
	if (tool !== "execute_sql") return false;
	const query = typeof input.query === "string" ? input.query : "";
	return DESTRUCTIVE_SQL.test(query);
}

export function statusLines(config: SupabaseMcpConfig): string[] {
	return [
		`Supabase MCP: ${config.disabled ? "disabled (SUPABASE_MCP_DISABLED)" : `registered as "${SERVER_NAME}"`}`,
		`  url:               ${config.url}`,
		`  exposure:          ${config.exposure}`,
		`  auth:              ${authLabel(config)}`,
		`  confirm writes:    ${config.confirmWrites ? "on" : "off"}`,
		"",
		"Skills:   supabase, supabase-postgres-best-practices",
		"Commands: /supabase-migration, /supabase-audit, /supabase-types, /supabase-debug",
		"Doctor:   bun run scripts/check-setup.ts",
		"Inspect connections with /mcp. Configuration is documented in the package README.",
	];
}
