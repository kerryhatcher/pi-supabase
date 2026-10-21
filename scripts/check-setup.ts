#!/usr/bin/env bun
/**
 * Diagnose the pi-supabase setup.
 *
 * Prints the effective MCP configuration, checks that the server is reachable,
 * and reports the Supabase CLI version. Exits non-zero when something needs
 * attention. Run with `bun run scripts/check-setup.ts` (or `bun scripts/check-setup.ts`).
 */

import { spawnSync } from "node:child_process";
import { authLabel, readPluginVersion, resolveConfig } from "../src/config";

const config = resolveConfig();
const problems: string[] = [];

console.log(`pi-supabase v${readPluginVersion()}`);
console.log(`  server:         ${config.disabled ? "disabled" : config.url}`);
console.log(`  exposure:       ${config.exposure}`);
console.log(`  auth:           ${authLabel(config)}`);
console.log(`  confirm writes: ${config.confirmWrites ? "on" : "off"}`);

if (config.disabled) {
	console.log("\nSUPABASE_MCP_DISABLED is set; nothing to check.");
	process.exit(0);
}

console.log("\nChecking server reachability…");
try {
	const response = await fetch(config.url, {
		method: "GET",
		headers: config.headers,
		signal: AbortSignal.timeout(10_000),
	});
	// An unauthenticated MCP endpoint answers 401; some gateways use 400/405.
	if ([200, 400, 401, 405].includes(response.status)) {
		console.log(`  reachable (HTTP ${response.status}${response.status === 401 ? " — sign in with /mcp" : ""})`);
	} else {
		console.log(`  unexpected HTTP ${response.status}`);
		problems.push(`server returned HTTP ${response.status}`);
	}
} catch (error) {
	console.log(`  unreachable: ${error instanceof Error ? error.message : String(error)}`);
	problems.push("server is not reachable");
}

console.log("\nChecking Supabase CLI…");
const cli = spawnSync("supabase", ["--version"], { encoding: "utf8", shell: process.platform === "win32" });
if (cli.error || cli.status !== 0) {
	console.log("  not found (optional, but the skills use it for migrations and types)");
} else {
	console.log(`  ${cli.stdout.trim()}`);
}

if (problems.length > 0) {
	console.error(`\nProblems:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
	process.exit(1);
}
console.log("\nSetup looks good.");
