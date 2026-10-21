/**
 * Supabase MCP server, hook, and status command for Pi.
 *
 * Registers the official Supabase MCP server
 * (https://supabase.com/docs/guides/ai-tools/mcp) for the current session and
 * ships the Supabase agent skills next to it. Nothing needs to be installed
 * locally: the hosted server is used by default and Pi's built-in OAuth flow
 * (`/mcp` -> Sign in) provides credentials.
 *
 * This is the Pi counterpart of the official Supabase plugin surfaces
 * (https://github.com/supabase-community/supabase-plugin). Configuration comes
 * from the environment so the same package works for hosted projects, local
 * Supabase CLI stacks, and CI. See `src/config.ts` and the package README.
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	isWriteTool,
	readPluginVersion,
	resolveConfig,
	SERVER_DESCRIPTION,
	SERVER_NAME,
	SOURCE_NAME,
	statusLines,
	TOOL_PREFIX,
} from "../src/config";

interface ToolCallLike {
	toolName: string;
	input: Record<string, unknown>;
}

export default function supabase(pi: ExtensionAPI) {
	const config = resolveConfig();

	// File-configured `mcp.json` servers of the same name take precedence, so this
	// never double-connects when the user already configured Supabase by hand.
	if (!config.disabled) {
		pi.registerMcpServer(SERVER_NAME, {
			url: config.url,
			exposure: config.exposure,
			description: SERVER_DESCRIPTION,
			headers: {
				"X-Source-Name": SOURCE_NAME,
				"X-Source-Version": readPluginVersion(),
				...config.headers,
			},
		});
	}

	// Hook: Pi does not support MCP elicitations, so the server's own
	// destructive-SQL and cost confirmations never appear. Gate mutating calls
	// here instead. Read-only tools and plain SELECTs pass through untouched.
	if (config.confirmWrites) {
		pi.on("tool_call", async (event: ToolCallLike, ctx: ExtensionContext) => {
			if (!event.toolName.startsWith(TOOL_PREFIX)) return;
			const tool = event.toolName.slice(TOOL_PREFIX.length);
			if (!isWriteTool(tool, event.input)) return;

			// Fail closed in modes without a dialog rather than silently approving.
			if (!ctx.hasUI) {
				return {
					block: true,
					reason: `${event.toolName} blocked: the pi-supabase write guard is on but no confirmation UI is available. Set SUPABASE_MCP_CONFIRM_WRITES=off or use SUPABASE_MCP_READ_ONLY=true for unattended runs.`,
				};
			}

			const preview = JSON.stringify(event.input);
			const detail = preview.length > 500 ? `${preview.slice(0, 500)}…` : preview;
			const approved = await ctx.ui.confirm("Run Supabase write tool?", `${event.toolName}\n${detail}`);
			if (!approved) {
				return { block: true, reason: `${event.toolName} was not approved` };
			}
		});
	}

	pi.registerCommand("supabase", {
		description: "Show the Supabase MCP configuration used in this session",
		handler: async (_args, ctx) => {
			ctx.ui.notify(statusLines(config).join("\n"), "info");
		},
	});
}
