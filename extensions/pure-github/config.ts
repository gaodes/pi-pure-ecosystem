import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";

export type MergeStrategy = "squash" | "merge" | "rebase";

export interface RawGithubConfig {
	defaultOwner?: string;
	mergeStrategy?: MergeStrategy;
	notifications?: {
		enabled?: boolean;
	};
}

export interface ResolvedGithubConfig {
	defaultOwner: string | undefined;
	mergeStrategy: MergeStrategy;
	notifications: {
		enabled: boolean;
	};
}

const CONFIG_FILENAME = "pure-github.json";
const DEFAULT_CONFIG: ResolvedGithubConfig = {
	defaultOwner: undefined,
	mergeStrategy: "squash",
	notifications: {
		enabled: true,
	},
};

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
		return JSON.parse(readFileSync(file, "utf-8")) as T;
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
) {
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
	} catch {}
}

function scaffoldGlobalConfig(): void {
	const { file } = getPurePath(CONFIG_FILENAME, "config", "global");
	if (existsSync(file)) return;
	writePureJson(CONFIG_FILENAME, "config", "global", {
		defaultOwner: "",
		mergeStrategy: DEFAULT_CONFIG.mergeStrategy,
		notifications: {
			enabled: DEFAULT_CONFIG.notifications.enabled,
		},
	});
}

function normalizeConfig(raw?: RawGithubConfig): ResolvedGithubConfig {
	const trimmedDefaultOwner = raw?.defaultOwner?.trim();
	return {
		defaultOwner: trimmedDefaultOwner ? trimmedDefaultOwner : undefined,
		mergeStrategy:
			raw?.mergeStrategy === "merge" || raw?.mergeStrategy === "rebase" || raw?.mergeStrategy === "squash"
				? raw.mergeStrategy
				: DEFAULT_CONFIG.mergeStrategy,
		notifications: {
			enabled:
				typeof raw?.notifications?.enabled === "boolean"
					? raw.notifications.enabled
					: DEFAULT_CONFIG.notifications.enabled,
		},
	};
}

export function loadGithubConfig(cwd?: string): ResolvedGithubConfig {
	scaffoldGlobalConfig();
	const project = cwd ? readPureJson<RawGithubConfig>(CONFIG_FILENAME, "config", "project", cwd) : undefined;
	const global = readPureJson<RawGithubConfig>(CONFIG_FILENAME, "config", "global");
	return normalizeConfig(project !== undefined ? project : global);
}

export function initializeGithubConfig(): void {
	migrateIfNeeded(CONFIG_FILENAME, join(getAgentDir(), "pure-github.json"), "config");
	scaffoldGlobalConfig();
}
