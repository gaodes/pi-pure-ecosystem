import { type Static, Type } from "@sinclair/typebox";
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── Path helpers ──────────────────────────────────────────────────────
function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
	const dir = join(root, category);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return { dir, file: join(dir, filename) };
}

function readPureJson<T = unknown>(filename: string, category: "config" | "cache", scope: "global" | "project" = "global", cwd?: string): T | undefined {
	const { file } = getPurePath(filename, category, scope, cwd);
	try {
		return JSON.parse(readFileSync(file, "utf-8"));
	} catch {
		return undefined;
	}
}

function writePureJson<T = unknown>(filename: string, data: T, category: "config" | "cache", scope: "global" | "project" = "global", cwd?: string) {
	const { file } = getPurePath(filename, category, scope, cwd);
	writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadConfig<T>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
	const project = readPureJson<T>(filename, category, "project", cwd);
	if (project !== undefined) return project;
	return readPureJson<T>(filename, category, "global");
}

// ── Tool definition ───────────────────────────────────────────────────
const parameters = Type.Object({
	// Add your tool parameters here
});
type {{PascalCase}}Params = Static<typeof parameters>;

const tool: ToolDefinition = {
	name: "{{tool_name}}",
	label: "{{Label Name}}",
	description: "What this tool does.",
	parameters,
	async execute(toolCallId, params, signal, onUpdate, ctx) {
		onUpdate?.({ output: "Working..." });
		// Your implementation here
		return {
			content: [{ type: "text" as const, text: "Result" }],
		};
	},
};

// ── Extension entry point ─────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
	// Load config, check enabled, then register
	const config = loadConfig("pure-{{name}}.json", "config");
	pi.registerTool(tool);
}
