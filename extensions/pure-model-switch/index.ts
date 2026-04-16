// pure-model-switch
// Model listing, search, and switching tool for Pi.
// Provides a `switch_model` tool the agent can use to change models on demand.
// Supports aliases with fallback chains from config.

import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

// ── Path helpers (self-contained) ────────────────────────────────────────────

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
	const dir = join(root, category);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return { dir, file: join(dir, filename) };
}

function readPureJson<T = unknown>(
	filename: string,
	category: "config" | "cache",
	scope: "global" | "project" = "global",
	cwd?: string,
): T | undefined {
	const { file } = getPurePath(filename, category, scope, cwd);
	try {
		return JSON.parse(readFileSync(file, "utf-8"));
	} catch {
		return undefined;
	}
}

function writePureJson(
	filename: string,
	category: "config" | "cache",
	scope: "global" | "project",
	data: unknown,
): void {
	const { dir, file } = getPurePath(filename, category, scope);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	const tempFile = `${file}.tmp`;
	writeFileSync(tempFile, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
	renameSync(tempFile, file);
}

function migrateIfNeeded(filename: string, oldGlobalPath: string, newCategory: "config" | "cache"): void {
	if (!existsSync(oldGlobalPath)) return;
	const newPath = getPurePath(filename, newCategory, "global");
	if (existsSync(newPath.file)) {
		try {
			unlinkSync(oldGlobalPath);
		} catch {}
		return;
	}
	if (!existsSync(newPath.dir)) mkdirSync(newPath.dir, { recursive: true });
	try {
		renameSync(oldGlobalPath, newPath.file);
	} catch {}
}

// ── Types ─────────────────────────────────────────────────────────────────────

type AliasConfig = Record<string, string | string[]>;

// ── Alias loading ─────────────────────────────────────────────────────────────

function parseModelSpec(spec: string): { provider: string; modelId: string } | null {
	const normalized = spec.trim();
	const slashIndex = normalized.indexOf("/");
	if (slashIndex <= 0 || slashIndex >= normalized.length - 1) return null;
	const provider = normalized.slice(0, slashIndex).trim();
	const modelId = normalized.slice(slashIndex + 1).trim();
	if (!provider || !modelId) return null;
	return { provider, modelId };
}

function loadAliases(cwd?: string): { aliases: AliasConfig; error?: string } {
	const global = readPureJson<AliasConfig>("pure-model-switch.json", "config", "global");
	const project = cwd ? readPureJson<AliasConfig>("pure-model-switch.json", "config", "project", cwd) : undefined;
	const config = project !== undefined ? project : global;
	if (!config) return { aliases: {} };

	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		return { aliases: {}, error: "aliases config must be a top-level object of alias → string|string[]" };
	}

	const aliases: AliasConfig = {};
	for (const [rawKey, rawValue] of Object.entries(config)) {
		const key = rawKey.trim();
		if (!key) {
			return { aliases: {}, error: "alias names must be non-empty strings" };
		}

		if (typeof rawValue === "string") {
			const value = rawValue.trim();
			if (!value) {
				return { aliases: {}, error: `alias "${key}" must be a non-empty string or string[]` };
			}
			if (!parseModelSpec(value)) {
				return { aliases: {}, error: `alias "${key}" must target provider/modelId` };
			}
			aliases[key] = value;
			continue;
		}

		if (!Array.isArray(rawValue) || rawValue.length === 0) {
			return { aliases: {}, error: `alias "${key}" must be a non-empty string or string[]` };
		}

		const values: string[] = [];
		for (const candidate of rawValue) {
			if (typeof candidate !== "string" || !candidate.trim()) {
				return { aliases: {}, error: `alias "${key}" contains an invalid model target` };
			}
			const value = candidate.trim();
			if (!parseModelSpec(value)) {
				return { aliases: {}, error: `alias "${key}" contains invalid target "${value}"` };
			}
			if (!values.includes(value)) {
				values.push(value);
			}
		}
		aliases[key] = values;
	}

	return { aliases };
}

// ── Model formatting ──────────────────────────────────────────────────────────

function formatModelLine(
	model: {
		provider: string;
		id: string;
		name: string;
		reasoning: boolean;
		input: readonly string[];
		contextWindow: number;
		maxTokens: number;
		cost: { input: number; output: number };
	},
	currentModel: { provider?: string; id?: string } | null | undefined,
): string {
	const current = currentModel && model.provider === currentModel.provider && model.id === currentModel.id;
	const marker = current ? " (current)" : "";
	const capabilities = [model.reasoning ? "reasoning" : null, model.input.includes("image") ? "vision" : null]
		.filter(Boolean)
		.join(", ");
	const capabilityText = capabilities ? ` [${capabilities}]` : "";
	const costText = `$${model.cost.input.toFixed(2)}/$${model.cost.output.toFixed(2)} per 1M tokens (in/out)`;
	return `${model.provider}/${model.id}${marker}${capabilityText}\n  ${model.name} | ctx: ${model.contextWindow.toLocaleString()} | max: ${model.maxTokens.toLocaleString()}\n  ${costText}`;
}

// ── Extension ─────────────────────────────────────────────────────────────────

export default function pureModelSwitch(pi: ExtensionAPI) {
	// Migrate from old location if needed
	migrateIfNeeded(
		"pure-model-switch.json",
		join(getAgentDir(), "extensions", "model-switch", "aliases.json"),
		"config",
	);

	// Scaffold default global config if none exists
	const { file: configFile } = getPurePath("pure-model-switch.json", "config", "global");
	if (!existsSync(configFile)) {
		writePureJson("pure-model-switch.json", "config", "global", {});
	}

	let aliases: AliasConfig = {};
	let aliasLoadError: string | undefined;
	let sessionCwd: string | undefined;

	function reloadAliases() {
		const result = loadAliases(sessionCwd);
		aliases = result.aliases;
		aliasLoadError = result.error;
	}

	// Initial load (no project context yet)
	reloadAliases();

	pi.on("session_start", async (_event, ctx) => {
		sessionCwd = ctx.cwd;
		reloadAliases();
	});

	pi.registerTool({
		name: "switch_model",
		label: "Switch Model",
		description:
			"List, search, or switch models. Supports aliases (e.g. 'cheap', 'coding'). Use when the user mentions a model by name, asks to change/switch/try/test with a specific model, or when you need a model with different capabilities.",
		promptSnippet:
			"Use this tool when the user asks to list/search/switch models, requests a specific model/provider, or asks for cheaper/faster/vision/reasoning-capable models. Prefer action='search' before action='switch' when intent is ambiguous.",
		parameters: Type.Object({
			action: Type.Union([Type.Literal("list"), Type.Literal("search"), Type.Literal("switch")], {
				description: "Action to perform: 'list' (show all), 'search' (filter), or 'switch' (change model)",
			}),
			search: Type.Optional(
				Type.String({
					description:
						"For search/switch: search term to match by provider, id, or name (e.g. 'sonnet', 'opus', 'anthropic/claude')",
				}),
			),
			provider: Type.Optional(
				Type.String({
					description: "Filter to a specific provider (e.g. 'anthropic', 'openai', 'google')",
				}),
			),
		}),
		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			let models = ctx.modelRegistry.getAvailable();
			const currentModel = ctx.model;
			const provider = params.provider?.trim() ?? "";
			const normalizedProvider = provider.toLowerCase();
			const search = params.search?.trim() ?? "";
			const normalizedSearch = search.toLowerCase();

			if (normalizedProvider) {
				models = models.filter((m) => m.provider.toLowerCase() === normalizedProvider);
				if (models.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: `No models available for provider "${provider}". Available providers: ${[...new Set(ctx.modelRegistry.getAvailable().map((m) => m.provider))].join(", ")}`,
							},
						],
						isError: true,
					};
				}
			}

			if (params.action === "list") {
				if (models.length === 0) {
					return {
						content: [
							{
								type: "text",
								text: "No models available. Configure API keys for providers you want to use.",
							},
						],
					};
				}

				const aliasInfo = aliasLoadError
					? `\n\nWarning: ${aliasLoadError}`
					: Object.keys(aliases).length > 0
						? `\n\nAliases: ${Object.keys(aliases).join(", ")}`
						: "";
				const lines = models.map((m) => formatModelLine(m, currentModel));
				return {
					content: [
						{ type: "text", text: `Available models (${models.length}):${aliasInfo}\n\n${lines.join("\n\n")}` },
					],
				};
			}

			if (params.action === "search") {
				if (!search) {
					return {
						content: [{ type: "text", text: "search parameter required for search action" }],
						isError: true,
					};
				}

				const matches = models.filter(
					(m) =>
						m.id.toLowerCase().includes(normalizedSearch) ||
						m.name.toLowerCase().includes(normalizedSearch) ||
						m.provider.toLowerCase().includes(normalizedSearch),
				);
				if (matches.length === 0) {
					return {
						content: [{ type: "text", text: `No models found matching "${search}"` }],
					};
				}

				const lines = matches.map((m) => formatModelLine(m, currentModel));
				return {
					content: [
						{ type: "text", text: `Models matching "${search}" (${matches.length}):\n\n${lines.join("\n\n")}` },
					],
				};
			}

			// ── switch action ──────────────────────────────────────────────
			if (!search) {
				return {
					content: [{ type: "text", text: "search parameter required for switch action" }],
					isError: true,
				};
			}

			// Check aliases first
			const aliasKey = Object.keys(aliases).find((k) => k.toLowerCase() === normalizedSearch);
			if (aliasKey) {
				const aliasValue = aliases[aliasKey];
				const candidates = Array.isArray(aliasValue) ? aliasValue : [aliasValue];

				for (const candidate of candidates) {
					const [prov, ...idParts] = candidate.split("/");
					const id = idParts.join("/");
					const aliasMatch = models.find(
						(m) => m.provider.toLowerCase() === prov.toLowerCase() && m.id.toLowerCase() === id.toLowerCase(),
					);
					if (!aliasMatch) continue;

					if (currentModel && aliasMatch.provider === currentModel.provider && aliasMatch.id === currentModel.id) {
						return {
							content: [{ type: "text", text: `Already using ${aliasMatch.provider}/${aliasMatch.id}` }],
						};
					}

					const success = await pi.setModel(aliasMatch);
					if (!success) {
						return {
							content: [{ type: "text", text: `Failed to switch to ${aliasMatch.provider}/${aliasMatch.id}` }],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: `Switched to ${aliasMatch.provider}/${aliasMatch.id} (${aliasMatch.name}) via alias "${aliasKey}"`,
							},
						],
					};
				}

				return {
					content: [
						{
							type: "text",
							text: `No available models found for alias "${aliasKey}". Tried: ${candidates.join(", ")}`,
						},
					],
					isError: true,
				};
			}

			// Direct model matching
			let match = models.find((m) => `${m.provider}/${m.id}`.toLowerCase() === normalizedSearch);
			if (!match) {
				match = models.find((m) => m.id.toLowerCase() === normalizedSearch);
			}

			if (!match) {
				const candidateModels = models.filter(
					(m) =>
						m.id.toLowerCase().includes(normalizedSearch) ||
						m.name.toLowerCase().includes(normalizedSearch) ||
						m.provider.toLowerCase().includes(normalizedSearch),
				);
				if (candidateModels.length === 1) {
					match = candidateModels[0];
				} else if (candidateModels.length > 1) {
					const list = candidateModels.map((m) => `  ${m.provider}/${m.id}`).join("\n");
					return {
						content: [{ type: "text", text: `Multiple models match "${search}":\n${list}\n\nBe more specific.` }],
						isError: true,
					};
				}
			}

			if (!match) {
				return {
					content: [{ type: "text", text: `No model found matching "${search}"` }],
					isError: true,
				};
			}

			if (currentModel && match.provider === currentModel.provider && match.id === currentModel.id) {
				return {
					content: [{ type: "text", text: `Already using ${match.provider}/${match.id}` }],
				};
			}

			const success = await pi.setModel(match);
			if (!success) {
				return {
					content: [{ type: "text", text: `Failed to switch to ${match.provider}/${match.id}` }],
					isError: true,
				};
			}

			return {
				content: [{ type: "text", text: `Switched to ${match.provider}/${match.id} (${match.name})` }],
			};
		},
	});
}
