// working-vibes.ts
// AI-generated contextual working messages that match a user's preferred theme/vibe.
// Uses module-level state.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Context, complete } from "@mariozechner/pi-ai";
import type { ExtensionContext } from "@mariozechner/pi-coding-agent";
import { ensureConfigExists, loadConfig, updateConfig } from "./config.js";
import type { VibeMode } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════════════════

const BATCH_PROMPT = `Generate {count} unique 2-4 word loading messages for a "{theme}" theme.
Each message should end with "..."
Be creative, varied, and thematic. No duplicates.
Output one message per line, nothing else. No numbering, no bullets.`;

// Reasoning models often emit only thinking content for several seconds.
// If we abort too early, `complete()` can resolve with no final text, which
// looked like a fallback to the generic "Working..." message.
const MIN_REASONING_TIMEOUT_MS = 60000;
const BATCH_REASONING_TIMEOUT_MS = 120000;
const GENERATED_VIBE_CACHE_TTL_MS = 15 * 60 * 1000;
const MAX_GENERATED_VIBE_CACHE_ENTRIES = 128;

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface VibeGenContext {
	theme: string;
	userPrompt: string;
}

interface CachedGeneratedVibe {
	vibe: string;
	timestamp: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Module-level State
// ═══════════════════════════════════════════════════════════════════════════

let extensionCtx: ExtensionContext | null = null;
let currentGeneration: AbortController | null = null;
let isStreaming = false;
let lastVibeTime = 0;

// Working-line state: elapsed timer, active tool, thinking
let workingLineTimer: ReturnType<typeof setInterval> | undefined;
let agentStartTime = 0;
let activeToolSuffix: string | undefined;
let thinkingStartTime: number | undefined;
let lastThoughtDurationMs: number | undefined;
let workingMessageSetterRef: ((msg?: string) => void) | undefined;
let lastVibePhrase: string | undefined;

// File-based mode state
let vibeCache: string[] = [];
let vibeCacheTheme: string | null = null;
let vibeSeed = Date.now();
let vibeIndex = 0;

// Recent vibes tracking (to avoid repetition in generate mode)
const MAX_RECENT_VIBES = 5;
let recentVibes: string[] = [];

// Small in-memory memo cache for generate mode so repeated task hints can reuse
// the last successful vibe instantly without another model roundtrip.
const generatedVibeCache = new Map<string, CachedGeneratedVibe>();

// ═══════════════════════════════════════════════════════════════════════════
// Configuration Accessors
// ═══════════════════════════════════════════════════════════════════════════

function cfg() {
	return loadConfig();
}

function persistVibeConfig(patch: {
	theme?: string | null;
	mode?: VibeMode;
	model?: string;
	fallback?: string;
	timeoutMs?: number;
	refreshIntervalSeconds?: number;
	promptTemplate?: string;
	maxLength?: number;
}): void {
	updateConfig(patch);
}

// ═══════════════════════════════════════════════════════════════════════════
// File-Based Vibe Management
// ═══════════════════════════════════════════════════════════════════════════

function getVibesDir(): string {
	const homeDir = process.env.HOME || process.env.USERPROFILE || "";
	return join(homeDir, ".pi", "agent", "vibes");
}

function getVibeFilePath(theme: string): string {
	const filename = `${theme.toLowerCase().replace(/\s+/g, "-")}.txt`;
	return join(getVibesDir(), filename);
}

function loadVibesFromFile(theme: string): string[] {
	const filePath = getVibeFilePath(theme);
	if (!existsSync(filePath)) return [];

	try {
		const content = readFileSync(filePath, "utf-8");
		return content
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0 && line.endsWith("..."));
	} catch {
		return [];
	}
}

function saveVibesToFile(theme: string, vibes: string[]): void {
	const vibesDir = getVibesDir();
	const filePath = getVibeFilePath(theme);

	if (!existsSync(vibesDir)) {
		mkdirSync(vibesDir, { recursive: true });
	}

	writeFileSync(filePath, vibes.join("\n"));
}

function mulberry32(seed: number): () => number {
	let s = seed;
	return () => {
		// biome-ignore lint/suspicious/noAssignInExpressions: PRNG state mutation
		let t = (s += 0x6d2b79f5);
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

function getVibeAtIndex(vibes: string[], index: number, seed: number): string {
	if (vibes.length === 0) return `${cfg().fallback}...`;

	const effectiveIndex = index % vibes.length;
	const rng = mulberry32(seed);
	const indices = Array.from({ length: vibes.length }, (_, i) => i);

	for (let i = indices.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[indices[i], indices[j]] = [indices[j], indices[i]];
	}

	return vibes[indices[effectiveIndex]];
}

function getNextVibeFromFile(): string {
	if (!cfg().theme) return `${cfg().fallback}...`;

	if (vibeCacheTheme !== cfg().theme) {
		vibeCache = loadVibesFromFile(cfg().theme!);
		vibeCacheTheme = cfg().theme;
		vibeSeed = Date.now();
		vibeIndex = 0;
	}

	if (vibeCache.length === 0) {
		return `${cfg().fallback}...`;
	}

	const vibe = getVibeAtIndex(vibeCache, vibeIndex, vibeSeed);
	vibeIndex++;
	return vibe;
}

// ═══════════════════════════════════════════════════════════════════════════
// Prompt Building & Response Parsing
// ═══════════════════════════════════════════════════════════════════════════

function buildVibePrompt(ctx: VibeGenContext): string {
	const config = cfg();
	const task = ctx.userPrompt.slice(0, 100);
	const exclude = recentVibes.length > 0 ? `Don't use: ${recentVibes.join(", ")}` : "";

	return config.promptTemplate
		.replace(/\{theme\}/g, ctx.theme)
		.replace(/\{task\}/g, task)
		.replace(/\{exclude\}/g, exclude);
}

function parseVibeResponse(response: string, fallback: string): string {
	if (!response) return `${fallback}...`;

	let vibe = response.trim().split("\n")[0]?.trim() ?? "";
	vibe = vibe.replace(/^["']|["']$/g, "");

	if (!vibe.endsWith("...")) {
		vibe = `${vibe.replace(/\.+$/, "")}...`;
	}

	if (vibe.length > cfg().maxLength) {
		vibe = `${vibe.slice(0, cfg().maxLength - 3)}...`;
	}

	if (!vibe || vibe === "...") {
		return `${fallback}...`;
	}

	return vibe;
}

function buildGeneratedVibeCacheKey(theme: string, prompt: string): string {
	const config = cfg();
	const normalizedPrompt = prompt.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 180);
	return `${config.model}::${theme.trim().toLowerCase()}::${normalizedPrompt}`;
}

function getCachedGeneratedVibe(theme: string, prompt: string): string | null {
	const key = buildGeneratedVibeCacheKey(theme, prompt);
	const cached = generatedVibeCache.get(key);
	if (!cached) {
		return null;
	}

	if (Date.now() - cached.timestamp > GENERATED_VIBE_CACHE_TTL_MS) {
		generatedVibeCache.delete(key);
		return null;
	}

	generatedVibeCache.delete(key);
	generatedVibeCache.set(key, cached);
	return cached.vibe;
}

function cacheGeneratedVibe(theme: string, prompt: string, vibe: string): void {
	const config = cfg();
	if (!vibe || vibe === `${config.fallback}...`) {
		return;
	}

	const key = buildGeneratedVibeCacheKey(theme, prompt);
	generatedVibeCache.delete(key);
	generatedVibeCache.set(key, { vibe, timestamp: Date.now() });

	while (generatedVibeCache.size > MAX_GENERATED_VIBE_CACHE_ENTRIES) {
		const oldestKey = generatedVibeCache.keys().next().value;
		if (!oldestKey) {
			break;
		}
		generatedVibeCache.delete(oldestKey);
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// AI Generation
// ═══════════════════════════════════════════════════════════════════════════

async function generateVibe(ctx: VibeGenContext, signal: AbortSignal): Promise<string> {
	if (!extensionCtx) {
		return `${cfg().fallback}...`;
	}

	const config = cfg();
	const slashIndex = config.model.indexOf("/");
	if (slashIndex === -1) {
		return `${config.fallback}...`;
	}
	const provider = config.model.slice(0, slashIndex);
	const modelId = config.model.slice(slashIndex + 1);
	if (!provider || !modelId) {
		return `${config.fallback}...`;
	}

	const model = extensionCtx.modelRegistry.find(provider, modelId);
	if (!model) {
		console.debug(`[working-vibes] Model not found: ${config.model}`);
		return `${config.fallback}...`;
	}

	const auth = await extensionCtx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		console.debug(`[working-vibes] Auth error for provider ${provider}: ${auth.error}`);
		return `${config.fallback}...`;
	}

	const aiContext: Context = {
		messages: [
			{
				role: "user",
				content: [{ type: "text", text: buildVibePrompt(ctx) }],
				timestamp: Date.now(),
			},
		],
	};

	const timeoutMs = model.reasoning ? Math.max(config.timeoutMs, MIN_REASONING_TIMEOUT_MS) : config.timeoutMs;
	const combinedSignal = AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]);

	const response = await complete(model, aiContext, {
		apiKey: auth.apiKey,
		headers: auth.headers,
		signal: combinedSignal,
	});

	const textContent = response.content.find((c) => c.type === "text");
	return parseVibeResponse(textContent?.text || "", config.fallback);
}

function trackRecentVibe(vibe: string): void {
	if (vibe === `${cfg().fallback}...`) return;
	recentVibes = [vibe, ...recentVibes.filter((v) => v !== vibe)].slice(0, MAX_RECENT_VIBES);
}

function updateVibeFromFile(): void {
	const vibe = getNextVibeFromFile();
	lastVibePhrase = vibe;
	renderWorkingLine();
}

async function generateAndUpdate(prompt: string): Promise<void> {
	const config = cfg();
	if (config.mode === "file") {
		updateVibeFromFile();
		return;
	}

	const theme = config.theme;
	if (!theme) {
		return;
	}

	const cachedVibe = getCachedGeneratedVibe(theme, prompt);
	if (cachedVibe) {
		trackRecentVibe(cachedVibe);
		lastVibePhrase = cachedVibe;
		renderWorkingLine();
		return;
	}

	const controller = new AbortController();
	currentGeneration?.abort();
	currentGeneration = controller;

	try {
		const vibe = await generateVibe({ theme, userPrompt: prompt }, controller.signal);

		// Allow pre-agent-start generations to update the pending working message.
		if (currentGeneration === controller && !controller.signal.aborted) {
			if (vibe !== `${config.fallback}...`) {
				cacheGeneratedVibe(theme, prompt, vibe);
				trackRecentVibe(vibe);
				lastVibePhrase = vibe;
				renderWorkingLine();
			}
		}
	} catch (error) {
		if (error instanceof Error && error.name === "AbortError") {
			console.debug("[working-vibes] Generation aborted");
		} else {
			console.debug("[working-vibes] Generation failed:", error);
		}
	} finally {
		if (currentGeneration === controller) {
			currentGeneration = null;
		}
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Working-Line: Tool / Elapsed / Thinking
// ═══════════════════════════════════════════════════════════════════════════

const TOOL_LABELS: Record<string, string> = {
	bash: "running bash",
	read: "reading file",
	write: "writing file",
	edit: "editing file",
	grep: "searching files",
	find: "finding files",
	ls: "listing files",
};

function formatToolLabel(name: string): string {
	return TOOL_LABELS[name] ?? `running ${name}`;
}

export function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const seconds = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const minutes = totalMinutes % 60;
	const hours = Math.floor(totalMinutes / 60);
	if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m ${String(seconds).padStart(2, "0")}s`;
	if (totalMinutes > 0) return `${totalMinutes}m ${String(seconds).padStart(2, "0")}s`;
	return `${seconds}s`;
}

function getThinkingSuffix(): string | undefined {
	if (thinkingStartTime !== undefined) return "thinking";
	if (lastThoughtDurationMs !== undefined)
		return `thought for ${Math.max(1, Math.round(lastThoughtDurationMs / 1000))}s`;
	return undefined;
}

function composeWorkingLine(): string | undefined {
	const parts: string[] = [];
	if (lastVibePhrase) parts.push(lastVibePhrase);
	if (activeToolSuffix) parts.push(activeToolSuffix);
	if (agentStartTime > 0) parts.push(formatElapsed(Date.now() - agentStartTime));
	const thinking = getThinkingSuffix();
	if (thinking) parts.push(thinking);
	return parts.length > 0 ? parts.join(" · ") : undefined;
}

function renderWorkingLine(): void {
	if (!workingMessageSetterRef) return;
	const message = composeWorkingLine();
	workingMessageSetterRef(message);
}

function startElapsedTimer(): void {
	clearElapsedTimer();
	workingLineTimer = setInterval(renderWorkingLine, 1000);
}

function clearElapsedTimer(): void {
	if (workingLineTimer) {
		clearInterval(workingLineTimer);
		workingLineTimer = undefined;
	}
}

function resetWorkingLineState(): void {
	clearElapsedTimer();
	agentStartTime = 0;
	activeToolSuffix = undefined;
	thinkingStartTime = undefined;
	lastThoughtDurationMs = undefined;
	lastVibePhrase = undefined;
}

export function onToolExecutionStart(toolName: string, _toolCallId?: string): void {
	activeToolSuffix = formatToolLabel(toolName);
	renderWorkingLine();
}

export function onToolExecutionEnd(_toolCallId?: string): void {
	activeToolSuffix = undefined;
	renderWorkingLine();
}

export function onThinkingStart(): void {
	thinkingStartTime = Date.now();
	lastThoughtDurationMs = undefined;
	renderWorkingLine();
}

export function onThinkingEnd(): void {
	if (thinkingStartTime !== undefined) {
		lastThoughtDurationMs = Date.now() - thinkingStartTime;
		thinkingStartTime = undefined;
	}
	renderWorkingLine();
}

// ═══════════════════════════════════════════════════════════════════════════
// Exported Functions
// ═══════════════════════════════════════════════════════════════════════════

export function initVibeManager(ctx: ExtensionContext): void {
	extensionCtx = ctx;
	ensureConfigExists();
}

export function refreshVibeConfig(): void {
	// Config is always re-read on next cfg() call (cache TTL handles staleness)
}

export function getVibeTheme(): string | null {
	return cfg().theme;
}

export function setVibeTheme(theme: string | null): void {
	recentVibes = [];
	persistVibeConfig({ theme });
}

export function getVibeModel(): string {
	return cfg().model;
}

export function setVibeModel(modelSpec: string): void {
	persistVibeConfig({ model: modelSpec });
}

export function onVibeBeforeAgentStart(prompt: string, setWorkingMessage: (msg?: string) => void): void {
	workingMessageSetterRef = setWorkingMessage;
	resetWorkingLineState();

	const config = cfg();
	if (!config.theme || !extensionCtx) {
		agentStartTime = Date.now();
		startElapsedTimer();
		renderWorkingLine();
		return;
	}

	lastVibePhrase = `Channeling ${config.theme}...`;
	agentStartTime = Date.now();
	startElapsedTimer();
	renderWorkingLine();
	lastVibeTime = Date.now();
	generateAndUpdate(prompt);
}

export function onVibeAgentStart(): void {
	isStreaming = true;
	// Ensure elapsed timer is running (in case before_agent_start didn't fire)
	if (agentStartTime === 0) {
		agentStartTime = Date.now();
	}
	startElapsedTimer();
}

export function onVibeToolCall(toolName: string, toolInput: Record<string, unknown>, agentContext?: string): void {
	const config = cfg();
	if (!config.theme || !extensionCtx || !isStreaming) return;

	const now = Date.now();
	if (now - lastVibeTime < config.refreshIntervalSeconds * 1000) return;

	let hint: string;
	if (agentContext && agentContext.length > 10) {
		hint = agentContext.slice(0, 150);
	} else {
		hint = `using ${toolName} tool`;
		if (toolName === "read" && toolInput.path) {
			hint = `reading file: ${toolInput.path}`;
		} else if (toolName === "write" && toolInput.path) {
			hint = `writing file: ${toolInput.path}`;
		} else if (toolName === "edit" && toolInput.path) {
			hint = `editing file: ${toolInput.path}`;
		} else if (toolName === "bash" && toolInput.command) {
			const cmd = String(toolInput.command).slice(0, 40);
			hint = `running command: ${cmd}`;
		}
	}

	lastVibeTime = now;
	generateAndUpdate(hint);
}

export function onVibeAgentEnd(setWorkingMessage: (msg?: string) => void): void {
	isStreaming = false;
	currentGeneration?.abort();
	resetWorkingLineState();
	workingMessageSetterRef = undefined;
	setWorkingMessage(undefined);
}

export function getVibeMode(): VibeMode {
	return cfg().mode;
}

export function setVibeMode(mode: VibeMode): void {
	persistVibeConfig({ mode });
}

export function hasVibeFile(theme: string): boolean {
	return existsSync(getVibeFilePath(theme));
}

export function getVibeFileCount(theme: string): number {
	return loadVibesFromFile(theme).length;
}

export interface GenerateVibesResult {
	success: boolean;
	count: number;
	filePath: string;
	error?: string;
}

export async function generateVibesBatch(theme: string, count = 100): Promise<GenerateVibesResult> {
	const filePath = getVibeFilePath(theme);

	if (!extensionCtx) {
		return { success: false, count: 0, filePath, error: "Extension not initialized" };
	}

	const config = cfg();
	const slashIndex = config.model.indexOf("/");
	if (slashIndex === -1) {
		return { success: false, count: 0, filePath, error: "Invalid model spec" };
	}
	const provider = config.model.slice(0, slashIndex);
	const modelId = config.model.slice(slashIndex + 1);

	const model = extensionCtx.modelRegistry.find(provider, modelId);
	if (!model) {
		return { success: false, count: 0, filePath, error: `Model not found: ${config.model}` };
	}

	const auth = await extensionCtx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok) {
		return { success: false, count: 0, filePath, error: auth.error };
	}

	const prompt = BATCH_PROMPT.replace(/\{theme\}/g, theme).replace(/\{count\}/g, String(count));

	const aiContext: Context = {
		messages: [
			{
				role: "user",
				content: [{ type: "text", text: prompt }],
				timestamp: Date.now(),
			},
		],
	};

	try {
		const signal = AbortSignal.timeout(model.reasoning ? BATCH_REASONING_TIMEOUT_MS : 30000);
		const response = await complete(model, aiContext, {
			apiKey: auth.apiKey,
			headers: auth.headers,
			signal,
		});

		const textContent = response.content.find((c) => c.type === "text");
		if (!textContent?.text) {
			return { success: false, count: 0, filePath, error: "Empty response from model" };
		}

		const vibes = textContent.text
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.map((line) => {
				let vibe = line.replace(/^["'\d.\-)\s]+/, "").trim();
				vibe = vibe.replace(/["']$/g, "");
				if (!vibe.endsWith("...")) {
					vibe = `${vibe.replace(/\.+$/, "")}...`;
				}
				return vibe;
			})
			.filter((vibe) => vibe.length > 3 && vibe !== "...");

		if (vibes.length === 0) {
			return { success: false, count: 0, filePath, error: "No valid vibes generated" };
		}

		saveVibesToFile(theme, vibes);

		if (vibeCacheTheme === theme) {
			vibeCache = [];
			vibeCacheTheme = null;
		}

		return { success: true, count: vibes.length, filePath };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return { success: false, count: 0, filePath, error: message };
	}
}
