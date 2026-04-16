import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import type { VibeConfig } from "./types.js";

const DEFAULT_CONFIG: VibeConfig = {
	theme: null,
	mode: "generate",
	model: "anthropic/claude-haiku-4-5",
	fallback: "Working",
	timeoutMs: 60000,
	refreshIntervalSeconds: 30,
	promptTemplate: `Generate a 2-4 word "{theme}" themed loading message ending with "...".

Task: {task}

Be creative and unexpected. Avoid obvious/clichéd phrases for this theme.
The message should hint at the task using theme vocabulary.
{exclude}
Output only the message, nothing else.`,
	maxLength: 65,
};

let configCache: VibeConfig | null = null;
let configCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

export function getConfigDir(): string {
	return join(getAgentDir(), "pure", "config");
}

export function getPrimaryConfigPath(): string {
	return join(getConfigDir(), "pure-vibes.json");
}

function getLegacyConfigPath(): string {
	return join(getAgentDir(), "pure-vibes.json");
}

export function ensureConfigExists(): void {
	if (existsSync(getPrimaryConfigPath())) return;
	if (existsSync(getLegacyConfigPath())) return;
	saveConfig(DEFAULT_CONFIG);
}

export function loadConfig(): VibeConfig {
	const now = Date.now();
	if (configCache && now - configCacheTime < CACHE_TTL) {
		return configCache;
	}

	const configPath = getPrimaryConfigPath();
	const legacyPath = getLegacyConfigPath();
	const activePath = existsSync(configPath) ? configPath : existsSync(legacyPath) ? legacyPath : null;

	if (!activePath) {
		configCache = { ...DEFAULT_CONFIG };
		configCacheTime = now;
		return configCache;
	}

	try {
		const content = readFileSync(activePath, "utf-8");
		const parsed = JSON.parse(content);
		configCache = { ...DEFAULT_CONFIG, ...parsed };
		configCacheTime = now;
		return configCache;
	} catch {
		configCache = { ...DEFAULT_CONFIG };
		configCacheTime = now;
		return configCache;
	}
}

export function saveConfig(config: VibeConfig): boolean {
	const configPath = getPrimaryConfigPath();

	try {
		mkdirSync(dirname(configPath), { recursive: true });
		const content = JSON.stringify(config, null, 2);
		writeFileSync(configPath, content, "utf-8");
		configCache = config;
		configCacheTime = Date.now();
		return true;
	} catch {
		return false;
	}
}

export function updateConfig(patch: Partial<VibeConfig>): boolean {
	const current = loadConfig();
	const updated = { ...current, ...patch };
	return saveConfig(updated);
}

export function clearConfigCache(): void {
	configCache = null;
	configCacheTime = 0;
}

export function getDefaultConfig(): VibeConfig {
	return { ...DEFAULT_CONFIG };
}
