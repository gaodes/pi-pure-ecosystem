/**
 * pure-git — Per-repo configuration
 *
 * Loads settings from pure-git.json using the pure-ecosystem standard:
 *   Project: <project>/.pi/pure/config/pure-git.json
 *   Global:  ~/.pi/agent/pure/config/pure-git.json
 *
 * Resolution: project config overrides global.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";

// ── Schema ──────────────────────────────────────────────────────────────────

const HookCommandsSchema = Type.Union([Type.String(), Type.Array(Type.String())]);

export const GitConfigSchema = Type.Object(
	{
		worktreeRoot: Type.Optional(Type.String()),
		onCreate: Type.Optional(HookCommandsSchema),
		onSwitch: Type.Optional(HookCommandsSchema),
		onBeforeRemove: Type.Optional(HookCommandsSchema),
		branchNameGenerator: Type.Optional(Type.String()),
		projects: Type.Optional(
			Type.Record(
				Type.String(),
				Type.Object(
					{
						worktreeRoot: Type.Optional(Type.String()),
						onCreate: Type.Optional(HookCommandsSchema),
						onSwitch: Type.Optional(HookCommandsSchema),
						onBeforeRemove: Type.Optional(HookCommandsSchema),
						branchNameGenerator: Type.Optional(Type.String()),
					},
					{ additionalProperties: false },
				),
			),
		),
	},
	{ additionalProperties: false },
);

export type GitConfig = Static<typeof GitConfigSchema>;

export type HookCommands = string | string[];

// ── Defaults ─────────────────────────────────────────────────────────────────

const BUILTIN_DEFAULTS: Required<Omit<GitConfig, "projects">> = {
	worktreeRoot: "{{mainWorktree}}/.worktrees",
	onCreate: "",
	onSwitch: "",
	onBeforeRemove: "",
	branchNameGenerator: "",
};

// ── Path helpers ─────────────────────────────────────────────────────────────

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
	const dir = join(root, category);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return { dir, file: join(dir, filename) };
}

// ── Config loading ───────────────────────────────────────────────────────────

let configCache: GitConfig | null = null;
let configCacheTime = 0;
const CACHE_TTL = 5000; // 5s

function readJsonFile(path: string): GitConfig | null {
	try {
		if (!existsSync(path)) return null;
		return JSON.parse(readFileSync(path, "utf-8")) as GitConfig;
	} catch {
		return null;
	}
}

/**
 * Load the full config (merged global + project).
 * Results are cached for CACHE_TTL ms.
 */
export function loadConfig(cwd: string): GitConfig {
	const now = Date.now();
	if (configCache && now - configCacheTime < CACHE_TTL) return configCache;

	const globalPath = getPurePath("pure-git.json", "config", "global").file;
	const projectPath = getPurePath("pure-git.json", "config", "project", cwd).file;

	const global = readJsonFile(globalPath) ?? {};
	const project = readJsonFile(projectPath);

	configCache = project ?? global;
	configCacheTime = now;
	return configCache;
}

/**
 * Resolve effective settings for a specific project.
 * Resolution: projects[<basename>] → top-level defaults → built-in defaults.
 */
export function resolveConfig(cwd: string, projectName: string): Required<Omit<GitConfig, "projects">> {
	const config = loadConfig(cwd);
	const projectOverride = config.projects?.[projectName];

	return {
		worktreeRoot: projectOverride?.worktreeRoot ?? config.worktreeRoot ?? BUILTIN_DEFAULTS.worktreeRoot,
		onCreate: projectOverride?.onCreate ?? config.onCreate ?? BUILTIN_DEFAULTS.onCreate,
		onSwitch: projectOverride?.onSwitch ?? config.onSwitch ?? BUILTIN_DEFAULTS.onSwitch,
		onBeforeRemove: projectOverride?.onBeforeRemove ?? config.onBeforeRemove ?? BUILTIN_DEFAULTS.onBeforeRemove,
		branchNameGenerator:
			projectOverride?.branchNameGenerator ?? config.branchNameGenerator ?? BUILTIN_DEFAULTS.branchNameGenerator,
	};
}

/**
 * Get the configured worktree root path (with templates expanded).
 * Falls back to `<mainWorktree>/.worktrees` if not configured.
 */
export function getWorktreeRoot(cwd: string, projectName: string, mainWorktree: string): string {
	const settings = resolveConfig(cwd, projectName);
	if (!settings.worktreeRoot) return `${mainWorktree}/.worktrees`;
	// Expand only non-path template vars for the root
	return settings.worktreeRoot
		.replace(/\{\{project\}\}/g, projectName)
		.replace(/\{\{mainWorktree\}\}/g, mainWorktree)
		.replace(/^~/, process.env.HOME ?? "");
}

/**
 * Invalidate the config cache (e.g. after saving).
 */
export function invalidateConfigCache(): void {
	configCache = null;
	configCacheTime = 0;
}

/**
 * Save config to the global config file.
 * Scaffolds defaults on first save.
 */
export function saveGlobalConfig(config: GitConfig): void {
	const { file } = getPurePath("pure-git.json", "config", "global");
	writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`, "utf-8");
	invalidateConfigCache();
}

/**
 * Get the resolved settings for the current project, ready for use.
 * Returns null if no hooks or branchNameGenerator are configured.
 */
export function getEffectiveConfig(cwd: string, projectName: string): Required<Omit<GitConfig, "projects">> {
	return resolveConfig(cwd, projectName);
}

/**
 * Check if any hooks are configured for the given project.
 */
export function hasHooks(cwd: string, projectName: string): boolean {
	const settings = resolveConfig(cwd, projectName);
	return !!settings.onCreate || !!settings.onSwitch || !!settings.onBeforeRemove;
}
