/**
 * Pure-sessions extension for pi sessions.
 *
 * Automatically generates a session name based on the first user query
 * using a configurable LLM model and prompt.
 *
 * By default, uses the current session model. Falls back to the cheapest
 * available model with an API key. Override via config
 * (pure-sessions.json in .pi/pure/config/ or ~/.pi/agent/pure/config/):
 * {
 *   "model": { "provider": "anthropic", "id": "claude-3-5-haiku-20241022" },
 *   "fallbackModel": { "provider": "openai", "id": "gpt-4o-mini" },
 *   "fallbackDeterministic": "readable-id",
 *   "modelSelection": "current",
 *   "prompt": "Generate a short, descriptive title...",
 *   "prefix": "[auto] ",
 *   "prefixCommand": "basename $(git rev-parse --show-toplevel 2>/dev/null || pwd)",
 *   "prefixOnly": false,
 *   "readableIdSuffix": false,
 *   "readableIdEnv": "PI_SESSION_READABLE_ID",
 *   "enabled": true,
 *   "debug": false,
 *   "wordlistPath": "./word_lists.toml",
 *   "wordlist": { "adjectives": [], "nouns": [] },
 *   "maxQueryLength": 2000,
 *   "maxNameLength": 80
 * }
 *
 * Prefix options:
 * - "prefix": Static string prefix
 * - "prefixCommand": Shell command whose stdout becomes the prefix (trimmed)
 * - "prefixOnly": If true, skip LLM and use only the prefix as the full name
 *
 * Suffix options:
 * - "readableIdSuffix": If true, append "[readable-id]" to the generated name
 * - "readableIdEnv": Environment variable that can provide a readable-id suffix override
 *
 * Fallback options:
 * - "fallbackModel": Alternative model if primary fails
 * - "fallbackDeterministic": Function to use if all models fail
 *   - "readable-id": Deterministic adjective-noun-noun from session ID
 *   - "truncate": First 50 chars of query
 *   - "words": First 6 words of query
 *   - "none": Don't set a name if LLM fails
 *
 * Input/output guards:
 * - "maxQueryLength": Maximum characters of user query sent to the LLM (default 2000).
 *   Longer queries have their middle section cut out, preserving the beginning and end.
 * - "maxNameLength": Maximum characters for the generated name (default 80).
 *   LLM responses exceeding this are truncated at a word boundary with an ellipsis.
 *
 * The prefixCommand runs in the session's cwd. If it fails, falls back to static prefix.
 */

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Api, complete, type Model } from "@mariozechner/pi-ai";
import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionCommandContext,
	type ExtensionContext,
	getAgentDir,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Container, Key, matchesKey, type SelectItem, SelectList, Text, truncateToWidth } from "@mariozechner/pi-tui";

// ============================================================================
// Types
// ============================================================================

interface ModelConfig {
	provider: string;
	id: string;
}

interface WordlistConfig {
	adjectives: string[];
	nouns: string[];
}

interface PureSessionsConfig {
	model?: ModelConfig;
	fallbackModel?: ModelConfig | null;
	fallbackDeterministic?: "truncate" | "words" | "none" | "readable-id";
	modelSelection?: "current" | "cheapest";
	prompt?: string;
	regenPrompt?: string;
	prefix?: string;
	prefixCommand?: string;
	prefixOnly?: boolean;
	readableIdSuffix?: boolean;
	emoji?: boolean | string;
	readableIdEnv?: string;
	enabled?: boolean;
	debug?: boolean;
	wordlistPath?: string;
	wordlist?: WordlistConfig;
	maxQueryLength?: number;
	maxNameLength?: number;
	regenMaxChars?: number;
}

type ResolvedConfig = {
	model: ModelConfig | null;
	fallbackModel: ModelConfig | null | undefined;
	fallbackDeterministic: "truncate" | "words" | "none" | "readable-id";
	modelSelection: "current" | "cheapest";
	prompt: string;
	regenPrompt: string;
	prefix: string;
	prefixCommand: string | undefined;
	prefixOnly: boolean;
	readableIdSuffix: boolean;
	emoji: boolean | string;
	readableIdEnv: string | undefined;
	enabled: boolean;
	debug: boolean;
	wordlistPath: string | undefined;
	wordlist: WordlistConfig | undefined;
	maxQueryLength: number;
	maxNameLength: number;
	regenMaxChars: number;
};

interface ModelResolutionResult {
	model: Model<Api> | null;
	apiKey: string | null;
	error: string | null;
	source: "primary" | "fallback" | null;
}

interface NameGenerationResult {
	name: string | null;
	source: "llm-primary" | "llm-fallback" | "deterministic" | null;
	error: string | null;
}

// ============================================================================
// Path helpers (self-contained, no external deps)
// ============================================================================

function getPureDir(category: "config" | "cache", scope: "global" | "project", cwd?: string): string {
	const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
	const dir = join(root, category);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return dir;
}

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const dir = getPureDir(category, scope, cwd);
	return { dir, file: join(dir, filename) };
}

function resolvePurePath(filename: string, category: "config" | "cache", cwd?: string) {
	if (cwd) {
		const project = getPurePath(filename, category, "project", cwd);
		if (existsSync(project.file)) return { ...project, scope: "project" as const };
	}
	return { ...getPurePath(filename, category, "global"), scope: "global" as const };
}

function _readPureJson<T = unknown>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
	const { file } = resolvePurePath(filename, category, cwd);
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
	cwd?: string,
): void {
	const { dir, file } = getPurePath(filename, category, scope, cwd);
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
	} catch {
		try {
			const content = readFileSync(oldGlobalPath, "utf-8");
			writeFileSync(newPath.file, content, "utf-8");
			unlinkSync(oldGlobalPath);
		} catch {}
	}
}

const OLD_SESSIONS_PATH = join(homedir(), ".pi", "agent", "pure-sessions.json");

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_PROMPT = `Generate a short, descriptive title (max 6 words) for a chat session based on this first message:

<message>
{{query}}
</message>

Rules:
- Use specific names from the message: people, places, tools, topics, concepts, titles
- Prefer concrete over vague: "Plan Tokyo Trip Budget" not "Plan Trip", "Discuss Quantum Entanglement" not "Science Talk"
- Use title case
- No quotes or punctuation at the end
- Focus on the main topic or intent
- If unclear, use a generic but relevant title

Reply with ONLY the title, nothing else.`;

const EMOJI_INSTRUCTION =
	"IMPORTANT: Your response MUST start with exactly one emoji that represents the topic, followed by a space, then the title. Example: 🔧 Fix useAuth Hook\n";

const DEFAULT_REGEN_PROMPT = `Analyze the following conversation and generate a short, descriptive title (max 6 words) that captures what this session is actually about:

<conversation>
{{query}}
</conversation>

Rules:
- Use specific names from the conversation: people, places, tools, topics, concepts, files, techniques, titles
- Prefer concrete over vague: "Plan Tokyo Trip Budget" not "Plan Trip", "Fix useAuth Memory Leak" not "Fix Bug", "Discuss Quantum Entanglement" not "Science Talk"
- Focus on the overall topic, goal, or outcome — not just the first message
- If multiple topics, prefer the main one
- Use title case
- No quotes or punctuation at the end

Reply with ONLY the title, nothing else.`;

const DEFAULT_CONFIG: ResolvedConfig = {
	model: null,
	fallbackModel: null,
	fallbackDeterministic: "readable-id",
	modelSelection: "current",
	prompt: DEFAULT_PROMPT,
	regenPrompt: DEFAULT_REGEN_PROMPT,
	prefix: "",
	prefixCommand: undefined,
	prefixOnly: false,
	readableIdSuffix: false,
	emoji: false,
	readableIdEnv: "PI_SESSION_READABLE_ID",
	enabled: true,
	debug: false,
	wordlistPath: undefined,
	wordlist: undefined,
	maxQueryLength: 2000,
	maxNameLength: 80,
	regenMaxChars: 4000,
};

const CONFIG_FILENAME = "pure-sessions.json";
const SUBAGENT_PREFIX_ENV = "PI_SUBAGENT_PREFIX";
const DEFAULT_WORDLIST_PATH = resolveDefaultWordlistPath();

function resolveDefaultWordlistPath(): string {
	// Try import.meta.url (works in native ESM)
	try {
		const dir = dirname(fileURLToPath(import.meta.url));
		const candidate = join(dir, "wordlist", "word_lists.toml");
		if (existsSync(candidate)) return candidate;
	} catch {
		// import.meta.url may not work under jiti
	}

	// Try __dirname (available in CJS and some jiti contexts)
	try {
		// @ts-expect-error - __dirname may be defined by jiti at runtime
		if (typeof __dirname === "string") {
			// @ts-expect-error
			const candidate = join(__dirname, "wordlist", "word_lists.toml");
			if (existsSync(candidate)) return candidate;
		}
	} catch {
		// not available
	}

	// Fallback: look in the npm global install location
	try {
		const npmRoot = execSync("npm root -g", {
			encoding: "utf-8",
			timeout: 3000,
		}).trim();
		const candidate = join(npmRoot, "@elche", "pure-sessions", "wordlist", "word_lists.toml");
		if (existsSync(candidate)) return candidate;
	} catch {
		// npm not available or timed out
	}

	// Last resort: return a path that won't exist but won't crash
	return join("wordlist", "word_lists.toml");
}

/**
 * Status key used to notify the Oqto runner of title changes.
 * The runner watches for this key on extension_ui_request events
 * and broadcasts a canonical session.title_changed event.
 */
const TITLE_CHANGED_STATUS_KEY = "oqto_title_changed";

// ============================================================================
// Config Loading
// ============================================================================

function loadConfig(cwd: string): ResolvedConfig {
	const { file: configPath } = resolvePurePath(CONFIG_FILENAME, "config", cwd);

	if (existsSync(configPath)) {
		try {
			const content = readFileSync(configPath, "utf-8");
			const userConfig: PureSessionsConfig = JSON.parse(content);
			return { ...DEFAULT_CONFIG, ...userConfig } as ResolvedConfig;
		} catch {
			// Invalid JSON, fall through
		}
	}

	return DEFAULT_CONFIG;
}

// ============================================================================
// Wordlist Loading
// ============================================================================

function resolveWordlistPath(config: ResolvedConfig, cwd: string): string | null {
	if (!config.wordlistPath) return null;
	const rawPath = config.wordlistPath.trim();
	if (!rawPath) return null;

	if (rawPath.startsWith("~")) {
		return join(homedir(), rawPath.slice(1));
	}

	if (rawPath.startsWith("/") || rawPath.includes(":")) {
		return rawPath;
	}

	return resolve(cwd, rawPath);
}

function parseWordlistToml(content: string): WordlistConfig | null {
	const adjectives = extractTomlList(content, "adjectives");
	const nouns = extractTomlList(content, "nouns");
	if (adjectives.length === 0 || nouns.length === 0) {
		return null;
	}
	return { adjectives, nouns };
}

function extractTomlList(content: string, key: string): string[] {
	const regex = new RegExp(`${key}\\s*=\\s*\\[([\\s\\S]*?)\\]`, "m");
	const match = content.match(regex);
	if (!match) return [];
	const listBody = match[1];
	return Array.from(listBody.matchAll(/"([^"]+)"/g)).map((m) => m[1]);
}

function loadWordlist(config: ResolvedConfig, cwd: string): WordlistConfig | null {
	if (config.wordlist?.adjectives?.length && config.wordlist.nouns?.length) {
		return {
			adjectives: config.wordlist.adjectives,
			nouns: config.wordlist.nouns,
		};
	}

	const overridePath = resolveWordlistPath(config, cwd);
	const paths = overridePath ? [overridePath, DEFAULT_WORDLIST_PATH] : [DEFAULT_WORDLIST_PATH];

	for (const path of paths) {
		if (!path || !existsSync(path)) continue;
		try {
			const content = readFileSync(path, "utf-8");
			const parsed = parseWordlistToml(content);
			if (parsed) return parsed;
		} catch {
			// Ignore invalid or unreadable wordlist files
		}
	}

	return null;
}

// ============================================================================
// Shell Command Execution
// ============================================================================

function executeCommand(command: string, cwd: string): string | null {
	try {
		const result = execSync(command, {
			cwd,
			encoding: "utf-8",
			timeout: 5000,
			stdio: ["pipe", "pipe", "pipe"],
		});
		return result.trim() || null;
	} catch {
		return null;
	}
}

function resolvePrefix(config: ResolvedConfig, cwd: string, ctx: ExtensionContext): string {
	// If user explicitly set prefixCommand or prefix, honor it
	if (config.prefixCommand) {
		const dynamicPrefix = executeCommand(config.prefixCommand, cwd);
		if (dynamicPrefix) {
			const subagentPrefix = process.env[SUBAGENT_PREFIX_ENV];
			if (subagentPrefix?.trim()) {
				return `${subagentPrefix.trim()} ${dynamicPrefix}`;
			}
			return dynamicPrefix;
		}
		if (config.debug && ctx.hasUI) {
			ctx.ui.notify("[pure-sessions] prefixCommand failed, using static prefix", "warning");
		}
	}

	if (config.prefix) {
		const subagentPrefix = process.env[SUBAGENT_PREFIX_ENV];
		if (subagentPrefix?.trim()) {
			return `${subagentPrefix.trim()} ${config.prefix}`;
		}
		return config.prefix;
	}

	// Auto-detect: only prefix if non-default branch or worktree
	try {
		const branch = executeCommand("git rev-parse --abbrev-ref HEAD 2>/dev/null", cwd)?.trim();
		if (branch && branch !== "main" && branch !== "master") {
			return branch;
		}
		const worktree = executeCommand("git rev-parse --show-superproject-working-tree 2>/dev/null", cwd)?.trim();
		if (worktree) {
			const wtName = executeCommand("basename $(pwd)", cwd)?.trim() ?? "worktree";
			return `[${wtName}]`;
		}
	} catch {
		// not a git repo, no prefix
	}

	return "";
}

// ============================================================================
// Query Extraction
// ============================================================================

function _extractFirstUserQuery(ctx: ExtensionContext): string | null {
	const branch = ctx.sessionManager.getBranch();

	for (const entry of branch) {
		if (entry.type !== "message") continue;

		const msg = (entry as { message?: { role?: string; content?: unknown } }).message;
		if (!msg || msg.role !== "user") continue;

		if (!Array.isArray(msg.content)) {
			return typeof msg.content === "string" ? msg.content.trim() || null : null;
		}
		return extractTextFromContent(msg.content as Array<{ type: string; text?: string; thinking?: string }>);
	}

	return null;
}

function getSessionId(ctx: ExtensionContext): string | null {
	const manager = ctx.sessionManager as { getSessionId?: () => string } | undefined;
	const id = manager?.getSessionId?.();
	return id || null;
}

// ============================================================================
// Conversation Extraction (for regen)
// ============================================================================

/**
 * Extract a compact summary of the full conversation for regen mode.
 * Collects user messages and key assistant/tool signals to give the
 * LLM enough context to produce an accurate, specific title.
 */
function extractConversationSummary(ctx: ExtensionContext, maxChars: number): string | null {
	const branch = ctx.sessionManager.getBranch();
	const parts: string[] = [];
	const filesSeen = new Set<string>();

	for (const entry of branch) {
		if (entry.type !== "message") continue;
		const msg = (entry as { message?: { role?: string; content?: unknown } }).message;
		if (!msg) continue;

		let text: string | null = null;

		if (msg.role === "user") {
			if (typeof msg.content === "string") {
				text = msg.content.trim();
			} else if (Array.isArray(msg.content)) {
				text = extractTextFromContent(
					msg.content as Array<{
						type: string;
						text?: string;
						thinking?: string;
					}>,
				).trim();
			}
			if (text) parts.push(`[User] ${text}`);
		} else if (msg.role === "assistant") {
			if (typeof msg.content === "string") {
				text = msg.content.trim();
			} else if (Array.isArray(msg.content)) {
				const blocks = msg.content as Array<{
					type: string;
					text?: string;
					thinking?: string;
					toolCall?: { name: string; arguments: Record<string, unknown> };
				}>;

				// Extract tool calls (file edits, bash commands, etc.)
				for (const block of blocks) {
					if (block.type === "toolCall" && block.toolCall) {
						const toolName = block.toolCall.name;
						const args = block.toolCall.arguments ?? {};

						// Track file paths
						for (const val of Object.values(args)) {
							if (typeof val === "string" && /\.(ts|js|py|rs|go|json|yaml|yml|toml|md|css|html|sql|sh)$/i.test(val)) {
								filesSeen.add(val.replace(/^.*\//, ""));
							}
						}

						// Summarize tool calls concisely
						if (toolName === "edit" || toolName === "write") {
							const path = String(args.path ?? args.file ?? "");
							if (path) filesSeen.add(path.replace(/^.*\//, ""));
							parts.push(`[Tool] ${toolName}(${path.replace(/^.*\//, "")})`);
						} else if (toolName === "bash") {
							const cmd = String(args.command ?? "").slice(0, 80);
							parts.push(`[Tool] bash: ${cmd}`);
						} else if (toolName === "read") {
							const path = String(args.path ?? "").replace(/^.*\//, "");
							if (path) filesSeen.add(path);
							parts.push(`[Tool] read(${path})`);
						} else {
							parts.push(`[Tool] ${toolName}`);
						}
					}
				}

				// Text content
				text = extractTextFromContent(blocks).trim();
				if (text) {
					const snippet = text.length > 150 ? `${text.slice(0, 150).trim()}...` : text;
					parts.push(`[Assistant] ${snippet}`);
				}
			}
		}
	}

	// Append file summary if we saw any
	if (filesSeen.size > 0) {
		const fileList = [...filesSeen].slice(0, 8).join(", ");
		parts.push(`[Files touched] ${fileList}`);
	}

	if (parts.length === 0) return null;
	const full = parts.join("\n");
	return truncateQuery(full, maxChars);
}

// ============================================================================
// Input / Output Guards
// ============================================================================

/**
 * Truncate the user query to maxQueryLength characters by cutting the middle.
 * Preserves the beginning (intent/context) and end (specific details/question)
 * of the query, joining them with a marker so the LLM understands content was
 * omitted. Both halves are trimmed at word boundaries.
 */
function truncateQuery(query: string, maxLength: number): string {
	if (query.length <= maxLength) return query;
	const marker = "\n[...truncated...]\n";
	const budget = maxLength - marker.length;
	if (budget <= 0) return query.slice(0, maxLength);
	const headBudget = Math.ceil(budget * 0.6);
	const tailBudget = budget - headBudget;

	let head = query.slice(0, headBudget);
	const headSpace = head.lastIndexOf(" ");
	if (headSpace > headBudget * 0.6) {
		head = head.slice(0, headSpace);
	}

	let tail = query.slice(query.length - tailBudget);
	const tailSpace = tail.indexOf(" ");
	if (tailSpace >= 0 && tailSpace < tailBudget * 0.4) {
		tail = tail.slice(tailSpace + 1);
	}

	return `${head}${marker}${tail}`;
}

/**
 * Enforce maxNameLength on an LLM-generated name. Strips trailing
 * punctuation, truncates at a word boundary, and appends an ellipsis when
 * trimming was needed.
 */
function enforceNameLength(name: string, maxLength: number): string {
	if (name.length <= maxLength) return name;
	// Leave room for the ellipsis
	const limit = maxLength - 3;
	if (limit <= 0) return name.slice(0, maxLength);
	const truncated = name.slice(0, limit);
	const lastSpace = truncated.lastIndexOf(" ");
	if (lastSpace > limit * 0.4) {
		return `${truncated.slice(0, lastSpace).replace(/[,;:\s]+$/, "")}...`;
	}
	return `${truncated.replace(/[,;:\s]+$/, "")}...`;
}

// ============================================================================
// Deterministic Name Generation
// ============================================================================

function generateDeterministicName(
	query: string,
	method: "truncate" | "words" | "none" | "readable-id",
	sessionId: string | null,
	wordlist: WordlistConfig | null,
): string | null {
	if (method === "none") {
		return null;
	}

	if (method === "readable-id") {
		if (!sessionId || !wordlist) return null;
		return readableIdFromSessionId(sessionId, wordlist);
	}

	const cleaned = query
		.replace(/\s+/g, " ")
		.replace(/[^\w\s-]/g, "")
		.trim();

	if (!cleaned) {
		return null;
	}

	if (method === "words") {
		return generateWordsName(cleaned);
	}

	return generateTruncatedName(cleaned);
}

function hashString(value: string): number {
	let hash = 0;
	for (let i = 0; i < value.length; i++) {
		hash = (hash << 5) - hash + value.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) >>> 0;
}

function readableIdFromSessionId(sessionId: string, wordlist: WordlistConfig): string {
	const hash = hashString(sessionId);
	const adjectives = wordlist.adjectives;
	const nouns = wordlist.nouns;
	const adjIndex = hash % adjectives.length;
	const noun1Index = Math.floor(hash / adjectives.length) % nouns.length;
	const noun2Index = Math.floor(hash / (adjectives.length * nouns.length)) % nouns.length;
	return `${adjectives[adjIndex]}-${nouns[noun1Index]}-${nouns[noun2Index]}`;
}

function generateWordsName(cleaned: string): string | null {
	const words = cleaned.split(" ").slice(0, 6);
	const titleCase = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
	return titleCase || null;
}

function generateTruncatedName(cleaned: string): string {
	if (cleaned.length <= 50) {
		return cleaned;
	}

	const truncated = cleaned.slice(0, 50);
	const lastSpace = truncated.lastIndexOf(" ");

	if (lastSpace > 30) {
		return `${truncated.slice(0, lastSpace)}...`;
	}

	return `${truncated}...`;
}

// ============================================================================
// Model Resolution
// ============================================================================

/**
 * Find the cheapest available model that has an API key configured.
 * Prefers small/fast models suitable for short title generation.
 */
async function findCheapestAvailableModel(
	ctx: ExtensionContext,
): Promise<{ model: Model<Api>; apiKey: string } | null> {
	const allModels = ctx.modelRegistry.getAll() as Model<Api>[];
	// Sort by total cost (input + output), cheapest first
	const sorted = [...allModels].sort((a, b) => {
		const costA = (a.cost?.input ?? 0) + (a.cost?.output ?? 0);
		const costB = (b.cost?.input ?? 0) + (b.cost?.output ?? 0);
		return costA - costB;
	});

	for (const model of sorted) {
		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (auth.ok && auth.apiKey) return { model, apiKey: auth.apiKey };
	}
	return null;
}

async function resolveModel(
	modelConfig: ModelConfig,
	ctx: ExtensionContext,
): Promise<{
	model: Model<Api> | null;
	apiKey: string | null;
	error: string | null;
}> {
	const model = ctx.modelRegistry.find(modelConfig.provider, modelConfig.id) as Model<Api> | undefined;

	if (!model) {
		const providers = Array.from(new Set(ctx.modelRegistry.getAll().map((m) => m.provider)));
		const availableProviders = providers.slice(0, 5).join(", ");
		const suffix = providers.length > 5 ? "..." : "";
		return {
			model: null,
			apiKey: null,
			error: `Model "${modelConfig.id}" not found for provider "${modelConfig.provider}". Available providers: ${availableProviders}${suffix}`,
		};
	}

	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		return {
			model: null,
			apiKey: null,
			error: `Failed to get API key: ${auth.error}`,
		};
	}
	return { model, apiKey: auth.apiKey ?? null, error: null };
}

function debugNotify(
	ctx: ExtensionContext,
	config: ResolvedConfig,
	message: string,
	level: "info" | "warning" | "error" = "info",
): void {
	if (config.debug && ctx.hasUI) {
		ctx.ui.notify(message, level);
	}
}

async function resolveCurrentModel(ctx: ExtensionContext): Promise<{ model: Model<Api>; apiKey: string } | null> {
	const currentModel = ctx.model as Model<Api> | undefined;
	if (!currentModel) return null;
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(currentModel);
	if (!auth.ok || !auth.apiKey) return null;
	return { model: currentModel, apiKey: auth.apiKey };
}

async function resolveModelWithFallback(config: ResolvedConfig, ctx: ExtensionContext): Promise<ModelResolutionResult> {
	// 1. Try explicitly configured primary model
	if (config.model) {
		debugNotify(ctx, config, `[pure-sessions] Trying primary model: ${config.model.provider}/${config.model.id}`);
		const primary = await resolveModel(config.model, ctx);
		debugNotify(
			ctx,
			config,
			`[pure-sessions] Primary result: model=${primary.model ? "found" : "null"} apiKey=${primary.apiKey ? "yes" : "no"} err=${primary.error ?? "none"}`,
		);
		if (primary.model) return { ...primary, source: "primary" };
		if (primary.error) debugNotify(ctx, config, `[pure-sessions] Primary model failed: ${primary.error}`, "warning");
	}

	// 2. Try explicitly configured fallback model
	if (config.fallbackModel) {
		const fallback = await resolveModel(config.fallbackModel, ctx);
		if (fallback.model) {
			debugNotify(
				ctx,
				config,
				`[pure-sessions] Using fallback model: ${config.fallbackModel.provider}/${config.fallbackModel.id}`,
			);
			return { ...fallback, source: "fallback" };
		}
		if (fallback.error) debugNotify(ctx, config, `[pure-sessions] Fallback model failed: ${fallback.error}`, "warning");
	}

	// 3. Strategy-based auto selection
	if (config.modelSelection === "cheapest") {
		const cheapest = await findCheapestAvailableModel(ctx);
		if (cheapest) {
			debugNotify(
				ctx,
				config,
				`[pure-sessions] Auto-selected cheapest model: ${cheapest.model.provider}/${cheapest.model.id}`,
			);
			return {
				model: cheapest.model,
				apiKey: cheapest.apiKey,
				error: null,
				source: "primary",
			};
		}

		const current = await resolveCurrentModel(ctx);
		if (current) {
			debugNotify(ctx, config, `[pure-sessions] Using current model: ${current.model.provider}/${current.model.id}`);
			return {
				model: current.model,
				apiKey: current.apiKey,
				error: null,
				source: "primary",
			};
		}
	} else {
		const current = await resolveCurrentModel(ctx);
		if (current) {
			debugNotify(ctx, config, `[pure-sessions] Using current model: ${current.model.provider}/${current.model.id}`);
			return {
				model: current.model,
				apiKey: current.apiKey,
				error: null,
				source: "primary",
			};
		}

		const cheapest = await findCheapestAvailableModel(ctx);
		if (cheapest) {
			debugNotify(
				ctx,
				config,
				`[pure-sessions] Auto-selected cheapest model: ${cheapest.model.provider}/${cheapest.model.id}`,
			);
			return {
				model: cheapest.model,
				apiKey: cheapest.apiKey,
				error: null,
				source: "primary",
			};
		}
	}

	return {
		model: null,
		apiKey: null,
		error: "No model available. Configure an API key or set model in pure-sessions.json",
		source: null,
	};
}

// ============================================================================
// LLM Name Generation
// ============================================================================

function stripThinkTags(text: string): string {
	return (
		text
			// Strip closed think/thinking blocks
			.replace(/<think[\s\S]*?<\/think>/gi, "")
			.replace(/<thinking[\s\S]*?<\/thinking>/gi, "")
			// Strip unclosed think/thinking tags (model didn't close them)
			.replace(/<think[\s\S]*/gi, "")
			.replace(/<thinking[\s\S]*/gi, "")
			.trim()
	);
}

function extractTextFromContent(content: Array<{ type: string; text?: string; thinking?: string }>): string {
	// First try text blocks
	const textContent = content
		.filter((c): c is { type: "text"; text: string } => c.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("")
		.trim();

	if (textContent) return textContent;

	// If no text content, try to extract from thinking blocks
	// (some models put the answer in the thinking block when the response is short)
	const thinkingContent = content
		.filter((c): c is { type: "thinking"; thinking: string } => c.type === "thinking" && typeof c.thinking === "string")
		.map((c) => c.thinking)
		.join("")
		.trim();

	if (!thinkingContent) return "";

	// The thinking block may contain reasoning + the actual title
	// Take the last non-empty line as the most likely title
	const lines = thinkingContent
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l.length > 0 && !l.startsWith("*") && !l.startsWith("-") && !l.startsWith("#"));

	return lines.length > 0 ? lines[lines.length - 1] : "";
}

function normalizeCandidateLine(line: string): string {
	return line
		.replace(/<[^>]+>/g, " ")
		.replace(/^[\s\-*>#]+/, "")
		.replace(/^\d+[.)]\s*/, "")
		.replace(/\*\*/g, "")
		.replace(/`/g, "")
		.replace(/^["']+|["']+$/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

function looksLikeReasoning(line: string): boolean {
	if (!line) return true;
	if (line.includes("|")) return true;
	if (/^(step|analysis|reasoning|thinking|selecting|here'?s|let'?s)\b/i.test(line)) return true;
	if (/\b(best title|final title|option \d|candidate \d)\b/i.test(line)) return true;
	if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(line)) return true;
	if (/[{}<>]/.test(line)) return true;
	const words = line.split(/\s+/).filter(Boolean);
	if (words.length < 2 || words.length > 10) return true;
	return false;
}

function parseNameFromResponse(
	response: {
		content: Array<{ type: string; text?: string; thinking?: string }>;
	},
	maxNameLength: number,
): string | null {
	const raw = stripThinkTags(extractTextFromContent(response.content));
	if (!raw) return null;

	const lines = raw
		.split("\n")
		.map(normalizeCandidateLine)
		.filter((l) => l.length > 0);

	// Prefer last clean short line (models often reason first, answer last)
	let name = "";
	for (let i = lines.length - 1; i >= 0; i--) {
		if (!looksLikeReasoning(lines[i])) {
			name = lines[i];
			break;
		}
	}
	if (!name && lines.length > 0) {
		// As a last resort, use the shortest line
		name = [...lines].sort((a, b) => a.length - b.length)[0];
	}

	name = name.replace(/\.+$/, "").trim();
	if (!name || looksLikeReasoning(name)) return null;

	name = enforceNameLength(name, maxNameLength);
	return name || null;
}

/**
 * Brute-force fallback: take the raw response text and extract the first
 * short, clean line that could be a title. Works even when reasoning models
 * wrap their answer in thinking blocks or structured output.
 */
function extractTitleFallback(
	response: {
		content: Array<{ type: string; text?: string; thinking?: string }>;
	},
	maxNameLength: number,
): string | null {
	// Collect ALL text from every content block type
	const allText: string[] = [];
	for (const block of response.content) {
		if (block.type === "text" && typeof block.text === "string" && block.text.trim()) {
			allText.push(block.text.trim());
		}
		if (block.type === "thinking" && typeof block.thinking === "string" && block.thinking.trim()) {
			allText.push(block.thinking.trim());
		}
	}
	const raw = allText.join("\n");
	if (!raw) return null;

	// Strip think tags
	const cleaned = stripThinkTags(raw);
	const lines = cleaned
		.split("\n")
		.map(normalizeCandidateLine)
		.filter((l) => l.length > 0);

	// Try to find any line between 2-10 words, no special chars
	for (const line of lines) {
		const words = line.split(/\s+/).filter(Boolean);
		if (words.length >= 2 && words.length <= 10 && /^[\w\s\-:.,&+]+$/.test(line)) {
			const name = enforceNameLength(line, maxNameLength);
			if (name) return name;
		}
	}

	// Last resort: first non-empty line that's not too long
	for (const line of lines) {
		if (line.length >= 3 && line.length <= maxNameLength) {
			return line.replace(/\.+$/, "").trim();
		}
	}

	return null;
}

function handleLlmError(errorMsg: string, config: ResolvedConfig, ctx: ExtensionContext): void {
	if (config.debug && ctx.hasUI) {
		ctx.ui.notify(`[pure-sessions] LLM call failed: ${errorMsg}`, "warning");
	}

	if (!ctx.hasUI) return;

	const providerName = config.model?.provider ?? "unknown";
	if (errorMsg.includes("401") || errorMsg.includes("403") || errorMsg.includes("authentication")) {
		ctx.ui.notify(`[pure-sessions] Authentication failed for ${providerName}. Check your API key.`, "error");
	} else if (errorMsg.includes("429") || errorMsg.includes("rate limit")) {
		ctx.ui.notify(`[pure-sessions] Rate limited by ${providerName}. Using fallback.`, "warning");
	} else if (errorMsg.includes("timeout") || errorMsg.includes("ETIMEDOUT")) {
		ctx.ui.notify("[pure-sessions] Request timed out. Using fallback.", "warning");
	}
}

async function tryLlmGeneration(
	query: string,
	config: ResolvedConfig,
	ctx: ExtensionContext,
	resolution: ModelResolutionResult,
): Promise<NameGenerationResult | null> {
	if (!resolution.model) {
		return null;
	}

	const trimmedQuery = truncateQuery(query, config.maxQueryLength);
	if (trimmedQuery.length < query.length && config.debug && ctx.hasUI) {
		ctx.ui.notify(`[pure-sessions] Query truncated from ${query.length} to ${trimmedQuery.length} chars`, "info");
	}
	const promptBase = config.prompt.replace("{{query}}", trimmedQuery);
	const prompt =
		config.emoji === true
			? promptBase.replace(
					"Reply with ONLY the title, nothing else.",
					`${EMOJI_INSTRUCTION}Reply with ONLY the title, nothing else.`,
				)
			: promptBase;

	debugNotify(
		ctx,
		config,
		`[pure-sessions] Calling LLM: ${resolution.model.provider}/${resolution.model.id} (apiKey=${resolution.apiKey ? "yes" : "no"})`,
	);

	try {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), 15000);

		const response = await complete(
			resolution.model,
			{
				messages: [
					{
						role: "user",
						content: [{ type: "text", text: prompt }],
						timestamp: Date.now(),
					},
				],
			},
			{ apiKey: resolution.apiKey ?? undefined, signal: controller.signal },
		);
		clearTimeout(timeout);

		debugNotify(
			ctx,
			config,
			`[pure-sessions] LLM response received: stop=${response.stopReason ?? "ok"} content=${response.content?.length ?? 0} err=${response.errorMessage ?? "none"}`,
		);

		// If the LLM returned an error (429, auth, etc.), bail and let fallback chain continue
		if (response.stopReason === "error" || (response.errorMessage && response.content?.length === 0)) {
			const errMsg = response.errorMessage ?? "Unknown LLM error";
			debugNotify(ctx, config, `[pure-sessions] LLM error response: ${errMsg}`, "warning");
			handleLlmError(errMsg, config, ctx);
			return null;
		}

		const name = parseNameFromResponse(response, config.maxNameLength);
		debugNotify(ctx, config, `[pure-sessions] Parsed name: ${name ?? "(null)"}`);
		debugNotify(ctx, config, `[pure-sessions] emoji config: ${JSON.stringify(config.emoji)}`);
		debugNotify(
			ctx,
			config,
			`[pure-sessions] Response content types: ${JSON.stringify(response.content?.map((c: any) => ({ type: c.type, len: (c.text ?? c.thinking ?? "").length })))}`,
		);

		if (name) {
			// Check if the raw response was longer (name was truncated by enforceNameLength)
			const rawName = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("")
				.trim();
			if (rawName.length > config.maxNameLength && config.debug && ctx.hasUI) {
				ctx.ui.notify(
					`[pure-sessions] LLM name truncated from ${rawName.length} to ${name.length} chars (max ${config.maxNameLength})`,
					"info",
				);
			}
			return {
				name,
				source: resolution.source === "primary" ? "llm-primary" : "llm-fallback",
				error: null,
			};
		}

		if (config.debug && ctx.hasUI) {
			ctx.ui.notify("[pure-sessions] parseNameFromResponse returned null, trying fallback parser", "warning");
		}

		const fallbackName = extractTitleFallback(response, config.maxNameLength);
		if (fallbackName) {
			debugNotify(ctx, config, `[pure-sessions] Fallback parser succeeded: ${fallbackName}`);
			return {
				name: fallbackName,
				source: resolution.source === "primary" ? "llm-primary" : "llm-fallback",
				error: null,
			};
		}

		if (config.debug && ctx.hasUI) {
			ctx.ui.notify("[pure-sessions] All parsers failed, using deterministic fallback", "warning");
		}
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : String(error);
		handleLlmError(errorMsg, config, ctx);
	}

	return null;
}

async function generateSessionName(
	query: string,
	config: ResolvedConfig,
	ctx: ExtensionContext,
	sessionId: string | null,
	wordlist: WordlistConfig | null,
): Promise<NameGenerationResult> {
	const resolution = await resolveModelWithFallback(config, ctx);

	const llmResult = await tryLlmGeneration(query, config, ctx, resolution);
	if (llmResult) {
		return llmResult;
	}

	const deterministicName = generateDeterministicName(query, config.fallbackDeterministic, sessionId, wordlist);

	if (deterministicName) {
		if (config.debug && ctx.hasUI) {
			ctx.ui.notify(`[pure-sessions] Using deterministic fallback (${config.fallbackDeterministic})`, "info");
		}
		return {
			name: deterministicName,
			source: "deterministic",
			error: resolution.error,
		};
	}

	return {
		name: null,
		source: null,
		error: resolution.error || "All name generation methods failed",
	};
}

// ============================================================================
// Session Naming Helpers
// ============================================================================

function resolveEmoji(configEmoji: boolean | string, name: string): string | null {
	// Fixed emoji from config
	if (typeof configEmoji === "string" && configEmoji) return configEmoji;
	if (configEmoji !== true) return null;

	// Try to extract emoji from LLM response (first emoji/pictographic character)
	const emojiRegex = /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u;
	const match = name.match(emojiRegex);
	if (match) return match[1];

	// Fallback: pick emoji based on keywords in the name
	const lower = name.toLowerCase();
	const emojiMap: [RegExp, string][] = [
		[/\b(fix|bug|error|debug|crash|issue|repair)\b/, "🐛"],
		[/\b(add|create|new|build|setup|implement)\b/, "✨"],
		[/\b(remove|delete|clean|strip)\b/, "🗑️"],
		[/\b(refactor|rewrite|restructure|improve)\b/, "♻️"],
		[/\b(test|spec|coverage)\b/, "🧪"],
		[/\b(doc|readme|guide|tutorial)\b/, "📝"],
		[/\b(config|setting|setup)\b/, "⚙️"],
		[/\b(security|auth|login|password|token)\b/, "🔒"],
		[/\b(perform|speed|fast|optim|cache)\b/, "⚡"],
		[/\b(docker|deploy|ci|cd|release)\b/, "🚀"],
		[/\b(design|ui|ux|style|css|theme|layout)\b/, "🎨"],
		[/\b(data|database|sql|query|migration)\b/, "🗄️"],
		[/\b(api|endpoint|route|server)\b/, "🌐"],
		[/\b(analyz|research|investigat|explor)\b/, "🔍"],
		[/\b(plan|strategy|roadmap|architect)\b/, "📋"],
		[/\b(learn|study|tutorial|course)\b/, "📚"],
		[/\b(chat|discuss|conversation|talk)\b/, "💬"],
		[/\b(music|song|audio)\b/, "🎵"],
		[/\b(travel|trip|journey|flight)\b/, "✈️"],
		[/\b(food|recipe|cook|meal)\b/, "🍳"],
		[/\b(health|medical|doctor|fitness)\b/, "❤️"],
		[/\b(game|play|gaming)\b/, "🎮"],
		[/\b(art|draw|paint|illustration)\b/, "🖼️"],
		[/\b(math|calcul|equation|formula)\b/, "🧮"],
		[/\b(write|blog|article|story)\b/, "✍️"],
	];
	for (const [regex, emoji] of emojiMap) {
		if (regex.test(lower)) return emoji;
	}
	return "📌"; // Default generic emoji
}

function stripEmojiFromName(name: string): string {
	return name.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}]+(?:\uFE0F|\u200D)*\s*/u, "").trim();
}

function formatFullName(prefix: string, name: string, suffix: string | null, emoji: string | null): string {
	const withEmoji = emoji ? `${emoji} ${name}` : name;
	const baseName = prefix ? `${prefix}: ${withEmoji}` : withEmoji;
	return suffix ? `${baseName} [${suffix}]` : baseName;
}

function resolveReadableIdOverride(config: ResolvedConfig): string | null {
	const envKey = config.readableIdEnv?.trim();
	if (!envKey) return null;
	const value = process.env[envKey];
	if (!value) return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function resolveReadableIdSuffix(
	config: ResolvedConfig,
	sessionId: string | null,
	wordlist: WordlistConfig | null,
	name: string,
	ctx: ExtensionContext,
): string | null {
	if (!config.readableIdSuffix) return null;
	const override = resolveReadableIdOverride(config);
	if (override) {
		return override === name ? null : override;
	}
	if (!sessionId || !wordlist) {
		debugNotify(ctx, config, "[pure-sessions] readableIdSuffix enabled but wordlist or sessionId missing", "warning");
		return null;
	}
	const readableId = readableIdFromSessionId(sessionId, wordlist);
	return readableId === name ? null : readableId;
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleRegen(
	ctx: ExtensionCommandContext,
	config: ResolvedConfig,
	prefix: string,
	pi: ExtensionAPI,
	setRenamed: () => void,
): Promise<void> {
	if (config.prefixOnly) {
		if (!prefix) {
			ctx.ui.notify("prefixOnly set but no prefix available", "warning");
			return;
		}
		pi.setSessionName(prefix);
		setRenamed();
		ctx.ui.notify(`Session renamed (prefix only): ${prefix}`, "info");
		return;
	}

	const query = extractConversationSummary(ctx, config.regenMaxChars);

	if (!query) {
		ctx.ui.notify("No conversation found to generate name from", "warning");
		return;
	}

	ctx.ui.notify("Regenerating session name from full conversation...", "info");
	const sessionId = getSessionId(ctx);
	const wordlist = loadWordlist(config, ctx.cwd);

	// Use regenPrompt (conversation-aware) instead of the first-message prompt
	const regenConfig = { ...config, prompt: config.regenPrompt };
	const result = await generateSessionName(query, regenConfig, ctx, sessionId, wordlist);

	if (result.name) {
		const emoji = resolveEmoji(config.emoji, result.name);
		const cleanName = config.emoji === true ? stripEmojiFromName(result.name) : result.name;
		const suffix = resolveReadableIdSuffix(config, sessionId, wordlist, cleanName, ctx);
		const fullName = formatFullName(prefix, cleanName, suffix, emoji);
		pi.setSessionName(fullName);
		setRenamed();
		ctx.ui.notify(`Session renamed (${result.source}): ${fullName}`, "info");
	} else {
		ctx.ui.notify(`Failed to generate name: ${result.error || "unknown error"}`, "error");
	}
}

function handleConfig(ctx: ExtensionCommandContext, config: ResolvedConfig): void {
	const parts = [
		config.model
			? `model=${config.model.provider}/${config.model.id}`
			: "model=auto (current session model, then cheapest)",
		config.fallbackModel ? `fallback=${config.fallbackModel.provider}/${config.fallbackModel.id}` : null,
		`deterministic=${config.fallbackDeterministic}`,
		`modelSelection=${config.modelSelection}`,
		config.wordlistPath ? `wordlistPath=${config.wordlistPath}` : null,
		config.wordlist ? "wordlist=inline" : null,
		config.readableIdEnv ? `readableIdEnv=${config.readableIdEnv}` : null,
		config.prefix ? `prefix="${config.prefix}"` : null,
		config.prefixCommand
			? `prefixCmd="${config.prefixCommand.slice(0, 30)}${config.prefixCommand.length > 30 ? "..." : ""}"`
			: null,
		config.prefixOnly ? "prefixOnly=true" : null,
		config.readableIdSuffix ? "readableIdSuffix=true" : null,
		`maxQuery=${config.maxQueryLength}`,
		`maxName=${config.maxNameLength}`,
		`enabled=${config.enabled}`,
	].filter(Boolean);

	ctx.ui.notify(`Config: ${parts.join(", ")}`, "info");
}

function handleInit(ctx: ExtensionCommandContext, cwd: string): void {
	const { file: configPath } = getPurePath(CONFIG_FILENAME, "config", "project", cwd);

	if (existsSync(configPath)) {
		ctx.ui.notify(`Config already exists: ${configPath}`, "warning");
		return;
	}

	writePureJson(CONFIG_FILENAME, "config", "project", DEFAULT_CONFIG, cwd);
	ctx.ui.notify(`Created config: ${configPath}`, "info");
}

async function handleTest(ctx: ExtensionCommandContext, config: ResolvedConfig): Promise<void> {
	ctx.ui.notify("Testing model connectivity...", "info");

	const resolution = await resolveModelWithFallback(config, ctx);

	if (resolution.model) {
		ctx.ui.notify(`Model OK: ${resolution.model.provider}/${resolution.model.id}`, "info");
	} else {
		ctx.ui.notify(`Model error: ${resolution.error}`, "error");
	}
}

// ============================================================================
// Extension Entry Point
// ============================================================================

export default function (pi: ExtensionAPI) {
	// Migrate old ~/.pi/agent/pure-sessions.json → ~/.pi/agent/pure/config/pure-sessions.json
	migrateIfNeeded(CONFIG_FILENAME, OLD_SESSIONS_PATH, "config");

	let sessionRenamed = false;
	let firstPromptHandled = false;

	const setRenamed = () => {
		sessionRenamed = true;
	};

	/**
	 * Set the session name and notify the Oqto runner via a status event.
	 * The runner picks up the TITLE_CHANGED_STATUS_KEY and broadcasts
	 * a canonical session.title_changed event to the frontend.
	 */
	const setNameAndNotify = (name: string, ctx: ExtensionContext) => {
		pi.setSessionName(name);
		ctx.ui.setStatus(TITLE_CHANGED_STATUS_KEY, name);
	};

	const checkExistingName = () => {
		const existingName = pi.getSessionName();
		if (!existingName) return;
		const normalized = existingName.trim().toLowerCase();
		if (!normalized || normalized === "chat") return;
		sessionRenamed = true;
	};

	pi.on("session_start", async () => {
		sessionRenamed = false;
		firstPromptHandled = false;
		checkExistingName();
	});

	// session_switch is not a real Pi event —
	// session_start fires on resume/switch already, covering this case

	const renameFromQuery = async (query: string, ctx: ExtensionContext): Promise<void> => {
		const config = loadConfig(ctx.cwd);
		if (!config.enabled) return;

		if (pi.getSessionName()) {
			sessionRenamed = true;
			return;
		}

		const prefix = resolvePrefix(config, ctx.cwd, ctx);
		if (config.prefixOnly) {
			if (!prefix) {
				debugNotify(ctx, config, "[pure-sessions] prefixOnly set but no prefix available", "warning");
				return;
			}
			setNameAndNotify(prefix, ctx);
			sessionRenamed = true;
			debugNotify(ctx, config, `[pure-sessions] Named (prefix only): ${prefix}`, "info");
			return;
		}

		const sessionId = getSessionId(ctx);
		const wordlist = loadWordlist(config, ctx.cwd);
		const result = await generateSessionName(query, config, ctx, sessionId, wordlist);

		if (!result.name) {
			debugNotify(
				ctx,
				config,
				`[pure-sessions] Failed to generate name: ${result.error || "unknown error"}`,
				"warning",
			);
			return;
		}

		const suffix = resolveReadableIdSuffix(config, sessionId, wordlist, result.name, ctx);
		const emoji = resolveEmoji(config.emoji, result.name);
		const cleanName = config.emoji === true ? stripEmojiFromName(result.name) : result.name;
		const fullName = formatFullName(prefix, cleanName, suffix, emoji);
		setNameAndNotify(fullName, ctx);
		sessionRenamed = true;
		debugNotify(ctx, config, `[pure-sessions] Named (${result.source}): ${fullName}`, "info");
	};

	pi.on("before_agent_start", async (event, ctx) => {
		const config = loadConfig(ctx.cwd);
		debugNotify(
			ctx,
			config,
			`[pure-sessions] before_agent_start: renamed=${sessionRenamed} handled=${firstPromptHandled}`,
		);
		if (sessionRenamed || firstPromptHandled) return;
		firstPromptHandled = true;

		const prompt = event.prompt?.trim();
		if (!prompt) {
			debugNotify(ctx, config, "[pure-sessions] before_agent_start: no prompt", "warning");
			return;
		}
		debugNotify(ctx, config, `[pure-sessions] before_agent_start: triggering rename for "${prompt.slice(0, 30)}..."`);
		void renameFromQuery(prompt, ctx);
	});

	pi.on("agent_end", async (_event, ctx) => {
		if (sessionRenamed) return;

		const config = loadConfig(ctx.cwd);
		if (!config.enabled) return;

		if (pi.getSessionName()) {
			sessionRenamed = true;
			return;
		}

		// Use full conversation summary for better context-aware naming
		const summary = extractConversationSummary(ctx, config.regenMaxChars);
		if (!summary) {
			debugNotify(ctx, config, "[pure-sessions] No conversation summary found", "warning");
			return;
		}

		debugNotify(ctx, config, `[pure-sessions] agent_end: naming from conversation summary`);
		const regenConfig = { ...config, prompt: config.regenPrompt };
		void renameFromQuery(summary, regenConfig, ctx);
	});

	// ============================================================================
	// Session Browser (TUI)
	// ============================================================================

	type SessionInfo = Awaited<ReturnType<typeof SessionManager.list>>[number];

	function formatAge(date: Date): string {
		const s = Math.floor((Date.now() - date.getTime()) / 1000);
		if (s < 60) return `${s}s`;
		if (s < 3600) return `${Math.floor(s / 60)}m`;
		if (s < 86400) return `${Math.floor(s / 3600)}h`;
		return `${Math.floor(s / 86400)}d`;
	}

	function shortCwd(cwd: string): string {
		const home = process.env.HOME || "";
		const s = home ? cwd.replace(home, "~") : cwd;
		const p = s.split("/").filter(Boolean);
		return p.length <= 3 ? s : `\u2026/${p.slice(-3).join("/")}`;
	}

	function sessionTitle(s: SessionInfo): string {
		if (s.name) return s.name;
		const f = (s.firstMessage ?? "").trim();
		if (!f) return basename(s.path, ".jsonl");
		return f.length > 60 ? `${f.slice(0, 57)}\u2026` : f;
	}

	async function browseSessions(
		pi: ExtensionAPI,
		ctx: ExtensionCommandContext,
		initialShowAll: boolean,
	): Promise<void> {
		if (!ctx.hasUI) return;
		await ctx.waitForIdle();

		let showAll = initialShowAll;

		while (true) {
			const sessions = (showAll ? await SessionManager.listAll() : await SessionManager.list(ctx.cwd)).sort(
				(a, b) => b.modified.getTime() - a.modified.getTime(),
			);

			if (!sessions.length) {
				ctx.ui.notify(
					showAll ? "No sessions found." : "No sessions in this project. Use /sesh all for all projects.",
					"info",
				);
				return;
			}

			const items: SelectItem[] = sessions.map((s, i) => {
				const age = formatAge(s.modified).padEnd(5);
				const msgs = `${s.messageCount} msg`.padStart(8);
				const cwdPart = showAll ? `  ${truncateToWidth(shortCwd(s.cwd), 12)}` : "";
				return {
					value: String(i),
					label: sessionTitle(s),
					description: `${age} ${msgs}${cwdPart}`,
				};
			});

			type R = { a: "resume" | "delete" | "rename" | "smart_rename" | "regen" | "cancel" | "tab"; s?: SessionInfo };

			const result = await ctx.ui.custom<R>((tui, theme, _kb, done) => {
				const container = new Container();

				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				const scopeLabel = showAll ? "all projects" : "current project";
				container.addChild(
					new Text(
						theme.fg("accent", theme.bold("Sessions")) +
							theme.fg("dim", ` — ${scopeLabel} — ${sessions.length} sessions`),
					),
				);

				const selectList = new SelectList(items, Math.min(items.length, 10), {
					selectedPrefix: (t) => theme.fg("accent", t),
					selectedText: (t) => theme.fg("accent", t),
					description: (t) => theme.fg("muted", t),
					scrollInfo: (t) => theme.fg("dim", t),
					noMatch: (t) => theme.fg("warning", t),
				});
				selectList.onSelect = (item) => done({ a: "resume", s: sessions[Number(item.value)] });
				selectList.onCancel = () => done({ a: "cancel" });
				container.addChild(selectList);

				container.addChild(
					new Text(
						theme.fg(
							"dim",
							"↑↓ navigate · ⏎ resume · r rename · s smart rename · g regen · d delete · Tab scope · Esc cancel",
						),
					),
				);

				container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

				return {
					render(width: number) {
						return container.render(width);
					},
					invalidate() {
						container.invalidate();
					},
					handleInput(data: string) {
						if (matchesKey(data, Key.tab)) {
							done({ a: "tab" });
							return;
						}
						if (data === "r") {
							const sel = selectList.getSelectedItem();
							if (sel) done({ a: "rename", s: sessions[Number(sel.value)] });
							return;
						}
						if (data === "s") {
							const sel = selectList.getSelectedItem();
							if (sel) done({ a: "smart_rename", s: sessions[Number(sel.value)] });
							return;
						}
						if (data === "g") {
							const sel = selectList.getSelectedItem();
							if (sel) done({ a: "regen", s: sessions[Number(sel.value)] });
							return;
						}
						if (data === "d") {
							const sel = selectList.getSelectedItem();
							if (sel) done({ a: "delete", s: sessions[Number(sel.value)] });
							return;
						}
						selectList.handleInput(data);
						tui.requestRender();
					},
				};
			});

			if (!result || result.a === "cancel") return;

			if (result.a === "tab") {
				showAll = !showAll;
				continue;
			}

			if (result.a === "resume") {
				if (result.s?.path === ctx.sessionManager.getSessionFile()) {
					ctx.ui.notify("Already in this session.", "info");
					return;
				}
				const res = await ctx.switchSession(result.s?.path);
				if (!res.cancelled) {
					const name = ctx.sessionManager.getSessionName();
					ctx.ui.setStatus("sesh", name ? ctx.ui.theme.fg("accent", `📁 ${name}`) : undefined);
				}
				return;
			}

			if (result.a === "delete") {
				const isCurrent = result.s?.path === ctx.sessionManager.getSessionFile();
				const title = sessionTitle(result.s!);
				const msg = isCurrent
					? `"${title}"\n\n⚠ This is your current session! Deleting it will not end your conversation, but the session file will be permanently removed.`
					: `"${title}"\n\nThis cannot be undone.`;
				if (await ctx.ui.confirm("Delete?", msg)) {
					try {
						await unlink(result.s?.path);
						ctx.ui.notify("Deleted.", "info");
					} catch (e) {
						ctx.ui.notify(`Failed: ${e}`, "error");
					}
				}
				continue;
			}

			if (result.a === "rename") {
				const name = await ctx.ui.input("New name:", result.s?.name ?? "");
				if (name?.trim()) {
					if (result.s?.path === ctx.sessionManager.getSessionFile()) {
						pi.setSessionName(name.trim());
						ctx.ui.setStatus("sesh", ctx.ui.theme.fg("accent", `📁 ${name.trim()}`));
					} else {
						// Rename a session we're not currently in
						const sm = await SessionManager.open(result.s?.path);
						sm.appendSessionInfo(name.trim());
					}
					ctx.ui.notify(`Renamed: ${name.trim()}`, "info");
				}
				continue;
			}

			if (result.a === "smart_rename") {
				// Prompt for a name, then apply prefix + emoji + readable ID
				const raw = await ctx.ui.input("Smart rename:", result.s?.name ?? "");
				if (!raw?.trim()) continue;
				const config = loadConfig(ctx.cwd);
				const prefix = resolvePrefix(config, ctx.cwd, ctx);
				const sessionId = getSessionId(ctx);
				const wordlist = loadWordlist(config, ctx.cwd);
				const emoji = resolveEmoji(config.emoji, raw.trim());
				const cleanName = config.emoji === true ? stripEmojiFromName(raw.trim()) : raw.trim();
				const suffix = resolveReadableIdSuffix(config, sessionId, wordlist, cleanName, ctx);
				const fullName = formatFullName(prefix, cleanName, suffix, emoji);
				if (result.s?.path === ctx.sessionManager.getSessionFile()) {
					pi.setSessionName(fullName);
					ctx.ui.setStatus("sesh", ctx.ui.theme.fg("accent", `\ud83d\udcc1 ${fullName}`));
				} else {
					const sm = await SessionManager.open(result.s?.path);
					sm.appendSessionInfo(fullName);
				}
				ctx.ui.notify(`Smart renamed: ${fullName}`, "info");
				continue;
			}

			if (result.a === "regen") {
				// LLM-based name regeneration from conversation
				const config = loadConfig(ctx.cwd);
				const prefix = resolvePrefix(config, ctx.cwd, ctx);

				if (result.s?.path === ctx.sessionManager.getSessionFile()) {
					await handleRegen(ctx, config, prefix, pi, setRenamed);
				} else {
					// Non-current session: extract conversation from file
					const sm = await SessionManager.open(result.s?.path);
					const branch = sm.getBranch();
					const parts: string[] = [];
					for (const entry of branch) {
						if (entry.type !== "message") continue;
						const msg = (entry as { message?: { role?: string; content?: unknown } }).message;
						if (!msg) continue;
						let text: string | null = null;
						if (msg.role === "user") {
							text =
								typeof msg.content === "string"
									? msg.content.trim()
									: Array.isArray(msg.content)
										? extractTextFromContent(msg.content as Array<{ type: string; text?: string }>).trim()
										: null;
							if (text) parts.push(`[User] ${text}`);
						} else if (msg.role === "assistant") {
							text =
								typeof msg.content === "string"
									? msg.content.trim()
									: Array.isArray(msg.content)
										? extractTextFromContent(msg.content as Array<{ type: string; text?: string }>).trim()
										: null;
							if (text) {
								const snippet = text.length > 150 ? `${text.slice(0, 150).trim()}...` : text;
								parts.push(`[Assistant] ${snippet}`);
							}
						}
					}
					if (!parts.length) {
						ctx.ui.notify("No conversation found to generate name from", "warning");
						continue;
					}
					const query = truncateQuery(parts.join("\n"), config.regenMaxChars);
					ctx.ui.notify("Regenerating session name...", "info");
					const sessionId = sm.getSessionId();
					const wordlist = loadWordlist(config, ctx.cwd);
					const regenConfig = { ...config, prompt: config.regenPrompt };
					const genResult = await generateSessionName(query, regenConfig, ctx, sessionId, wordlist);
					if (genResult.name) {
						const emoji = resolveEmoji(config.emoji, genResult.name);
						const cleanName = config.emoji === true ? stripEmojiFromName(genResult.name) : genResult.name;
						const suffix = resolveReadableIdSuffix(config, sessionId, wordlist, cleanName, ctx);
						const fullName = formatFullName(prefix, cleanName, suffix, emoji);
						sm.appendSessionInfo(fullName);
						ctx.ui.notify(`Regen (${genResult.source}): ${fullName}`, "info");
					} else {
						ctx.ui.notify(`Failed to generate name: ${genResult.error || "unknown error"}`, "error");
					}
				}
			}
		}
	}

	function handleInfo(ctx: ExtensionCommandContext, pi: ExtensionAPI): void {
		const name = pi.getSessionName();
		const currentFile = (ctx.sessionManager as { getSessionFile?: () => string }).getSessionFile?.();
		ctx.ui.notify(name ? `Current name: ${name}` : "No session name set", "info");
		if (currentFile) {
			ctx.ui.notify(`Session file: ${currentFile}`, "info");
		}
	}

	pi.registerCommand("sesh", {
		description: "Session browser and naming: /sesh [all] | info | ls | regen | rename <name> | config | init | test",
		handler: async (args: string, ctx: ExtensionCommandContext) => {
			const trimmed = args.trim();
			const config = loadConfig(ctx.cwd);

			// /sesh info | /sesh ls — show current session info
			if (trimmed === "info" || trimmed === "ls") {
				handleInfo(ctx, pi);
				return;
			}

			// /sesh all — browse all sessions
			if (trimmed === "all") {
				await browseSessions(pi, ctx, true);
				return;
			}

			// /sesh regen — regenerate from full conversation
			if (trimmed === "regen" || trimmed === "regenerate") {
				const prefix = resolvePrefix(config, ctx.cwd, ctx);
				await handleRegen(ctx, config, prefix, pi, setRenamed);
				return;
			}

			// /sesh rename <name> — rename with prefix + emoji
			if (trimmed.startsWith("rename ")) {
				const newName = trimmed.slice(7).trim();
				if (!newName) {
					ctx.ui.notify("Usage: /sesh rename <name>", "warning");
					return;
				}
				const prefix = resolvePrefix(config, ctx.cwd, ctx);
				const sessionId = getSessionId(ctx);
				const wordlist = loadWordlist(config, ctx.cwd);
				const emoji = resolveEmoji(config.emoji, newName);
				const cleanName = config.emoji === true ? stripEmojiFromName(newName) : newName;
				const suffix = resolveReadableIdSuffix(config, sessionId, wordlist, cleanName, ctx);
				const fullName = formatFullName(prefix, cleanName, suffix, emoji);
				pi.setSessionName(fullName);
				setRenamed();
				ctx.ui.notify(`Session renamed: ${fullName}`, "info");
				return;
			}

			// Named subcommands
			if (trimmed === "config") {
				handleConfig(ctx, config);
				return;
			}
			if (trimmed === "init") {
				handleInit(ctx, ctx.cwd);
				return;
			}
			if (trimmed === "test") {
				await handleTest(ctx, config);
				return;
			}

			// Bare /sesh — open session browser for current project
			if (!trimmed) {
				await browseSessions(pi, ctx, false);
				return;
			}

			// Fallback: treat as manual name (for backwards compat)
			pi.setSessionName(trimmed);
			sessionRenamed = true;
			ctx.ui.notify(`Session renamed: ${trimmed}`, "info");
		},
	});
}
