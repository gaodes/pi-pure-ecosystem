// pure-statusline
// Configurable Pi status footer — Starship-inspired per-segment config system.
// Every color, icon, and option is overridable via JSON config.
// Colors default to Pi theme tokens (theme.fg()) so they follow the active theme automatically.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ReadonlyFooterDataProvider, Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@mariozechner/pi-tui";

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

/** A color is either a Pi theme token name or a hex color like "#d787af" */
type ColorRef = ThemeColor | `#${string}`;
type ToolSortOrder = "firstSeen" | "countDesc" | "nameAsc";

interface ConfigRow {
	left?: SegmentId[];
	right?: SegmentId[];
}

type SegmentId =
	| "persona"
	| "pi"
	| "model"
	| "path"
	| "git"
	| "token_in"
	| "token_out"
	| "token_total"
	| "cost"
	| "context_pct"
	| "context_total"
	| "cache_read"
	| "cache_write"
	| "thinking"
	| "tools"
	| "tool_counter"
	| "tool_total_uses"
	| "separator"
	| `text:${string}`;

interface SegCfg {
	disabled?: boolean;
	symbol?: string;
	style?: string;
	[key: string]: unknown;
}

interface UserConfig {
	lines?: ConfigRow[];
	leftSegments?: SegmentId[];
	rightSegments?: SegmentId[];
	colors?: Record<string, ColorRef>;
	icons?: Record<string, string>;
	segments?: Record<string, Partial<SegCfg>>;
	/** Per-tool background colors for pills (tool name → hex color). Overrides built-in defaults. */
	tool_colors?: Record<string, `#${string}`>;
}

interface GitStatus {
	branch: string | null;
	staged: number;
	unstaged: number;
	untracked: number;
}
interface UsageStats {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
}

/** Resolved config passed to segment renderers */
interface RenderCtx {
	theme: Theme;
	palette: Record<string, ColorRef>;
	segs: Record<string, SegCfg>;
	icons: Record<string, string>;
	data: {
		cwd: string;
		model: { id: string; name?: string; reasoning?: boolean; contextWindow?: number } | undefined;
		thinkingLevel: string;
		usageStats: UsageStats;
		contextPercent: number;
		contextWindow: number;
		autoCompactEnabled: boolean;
		usingSubscription: boolean;
		git: GitStatus;
		toolCounts: Record<string, number>;
		toolTotal: number;
		toolsLoaded: number;
		toolColors: Record<string, `#${string}`>;
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Icon Sets
// ═══════════════════════════════════════════════════════════════════════════

const NERD: Record<string, string> = {
	pi: "\uE22C",
	model: "\uEC19",
	path: "\uF115",
	git: "\uF126",
	thinking: "\uEE9C",
	token_in: "\uF090",
	token_out: "\uF08B",
	token_total: "\uE26B",
	cost: "\uF155",
	context_pct: "\uE70F",
	context_total: "\uE70F",
	cache_read: "\uF1C0",
	cache_write: "\uF1C0",
	separator: "\uE0B1",
	auto: "\uF0068",
	tools: "\uF0AD",
};

const ASCII: Record<string, string> = {
	pi: "π",
	model: "◈",
	path: "📁",
	git: "⎇",
	thinking: "🧠",
	token_in: "↑",
	token_out: "↓",
	token_total: "⊛",
	cost: "$",
	context_pct: "◫",
	context_total: "◫",
	cache_read: "↙",
	cache_write: "↗",
	separator: "|",
	auto: "⚡",
	tools: "🔧",
};

function hasNerdFonts(): boolean {
	if (process.env.POWERLINE_NERD_FONTS === "1") return true;
	if (process.env.POWERLINE_NERD_FONTS === "0") return false;
	if (process.env.GHOSTTY_RESOURCES_DIR) return true;
	const term = (process.env.TERM_PROGRAM || "").toLowerCase();
	return ["iterm", "wezterm", "kitty", "ghostty", "alacritty"].some((t) => term.includes(t));
}

// ═══════════════════════════════════════════════════════════════════════════
// Default Color Palette (semantic names → Pi theme tokens)
//
// These are the defaults. Users override in config "colors" section.
// Values can be Pi theme tokens (resolved at render time via theme.fg())
// or hex colors like "#d787af" (applied directly).
//
// Theme integration: since defaults use Pi theme tokens, any Pi theme
// (built-in, custom, or set by pure-theme) is followed automatically.
// No dependency on pure-theme — just Pi's standard Theme API.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_COLORS: Record<string, ColorRef> = {
	model: "accent",
	path: "text",
	git_clean: "success",
	git_dirty: "warning",
	git_staged: "success",
	git_unstaged: "warning",
	git_untracked: "muted",
	context: "dim",
	context_warn: "warning",
	context_error: "error",
	tokens: "muted",
	cost: "text",
	tools: "accent",
	tools_dim: "muted",
	separator: "dim",
	persona: "accent",
	thinking_minimal: "thinkingMinimal",
	thinking_low: "thinkingLow",
	thinking_medium: "thinkingMedium",
	thinking_high: "thinkingHigh",
	thinking_xhigh: "thinkingXhigh",
};

// ═══════════════════════════════════════════════════════════════════════════
// Default Segment Configs
// Each segment has: style (color key), symbol (icon), disabled, + specific options.
// Users override per-segment in config "segments" section.
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_LINES: ConfigRow[] = [
	{ left: ["persona", "separator", "model", "separator", "path", "git"], right: ["context_pct"] },
	{ left: ["tool_counter"], right: ["tool_total_uses"] },
];

const DEFAULT_SEGMENTS: Record<string, SegCfg> = {
	persona: { style: "persona" },
	model: { style: "model", show_thinking_level: false },
	path: { style: "path", mode: "basename", max_length: 40 },
	git: {
		branch_style: "git_clean",
		dirty_branch_style: "git_dirty",
		show_branch: true,
		show_staged: true,
		staged_style: "git_staged",
		show_unstaged: true,
		unstaged_style: "git_unstaged",
		show_untracked: true,
		untracked_style: "git_untracked",
	},
	thinking: { style: "" },
	token_in: { style: "tokens" },
	token_out: { style: "tokens" },
	token_total: { style: "tokens" },
	cost: { style: "cost" },
	context_pct: {
		style: "context",
		warn_style: "context_warn",
		error_style: "context_error",
		warn_threshold: 70,
		error_threshold: 90,
		show_auto_icon: false,
	},
	context_total: { style: "context" },
	cache_read: { style: "tokens" },
	cache_write: { style: "tokens" },
	separator: { text: "" },
	tools: { style: "tools", dim_style: "tools_dim", max_tools: 4, show_icon: true, sort_by: "countDesc" },
	tool_counter: {
		label: "Tools",
		label_style: "muted",
		pill_text_style: "text",
		palette: [] as string[],
		max_tools: 0,
		show_on_empty: true,
		sort_by: "firstSeen",
		waiting_text: "waiting...",
	},
	tool_total_uses: { style: "tools_dim" },
};

// ═══════════════════════════════════════════════════════════════════════════
// Color & Icon Resolution
// ═══════════════════════════════════════════════════════════════════════════

function hexFg(hex: string, text: string): string {
	const h = hex.replace("#", "");
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `\x1b[38;2;${r};${g};${b}m${text}\x1b[0m`;
}

function hexBg(hex: string, text: string): string {
	const h = hex.replace("#", "");
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `\x1b[48;2;${r};${g};${b}m${text}\x1b[49m`;
}

const RAINBOW = ["#b281d6", "#d787af", "#febc38", "#e4c00f", "#89d281", "#00afaf", "#178fb9", "#b281d6"];
function rainbow(text: string): string {
	let result = "";
	let ci = 0;
	for (const char of text) {
		if (char === " " || char === ":") result += char;
		else {
			result += hexFg(RAINBOW[ci % RAINBOW.length], char);
			ci++;
		}
	}
	return `${result}\x1b[0m`;
}

/** Resolve a palette color key to styled text. Looks up user overrides first, then defaults. */
function c(theme: Theme, palette: Record<string, ColorRef>, key: string, text: string): string {
	const ref = palette[key] ?? DEFAULT_COLORS[key];
	if (!ref) return text;
	if (ref.startsWith("#")) return hexFg(ref, text);
	return theme.fg(ref as ThemeColor, text);
}

/** Resolve icon for a segment: user segment.symbol → user icons[id] → default */
function ico(segId: string, userIcons: Record<string, string>, segs: Record<string, SegCfg>): string {
	const segSymbol = segs[segId]?.symbol;
	if (segSymbol === "none") return "";
	if (segSymbol) return String(segSymbol);
	if (userIcons[segId]) return userIcons[segId];
	return (hasNerdFonts() ? NERD : ASCII)[segId] ?? "";
}

function withIcon(i: string, text: string): string {
	return i ? `${i} ${text}` : text;
}

function fmtTokens(n: number): string {
	if (n < 1000) return n.toString();
	if (n < 10_000) return `${(n / 1000).toFixed(1)}k`;
	if (n < 1_000_000) return `${Math.round(n / 1000)}k`;
	if (n < 10_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	return `${Math.round(n / 1_000_000)}M`;
}

function sortTools(entries: Array<[string, number]>, order: ToolSortOrder = "countDesc"): Array<[string, number]> {
	if (order === "firstSeen") return entries;
	const s = [...entries];
	if (order === "nameAsc") {
		s.sort((a, b) => a[0].localeCompare(b[0]));
		return s;
	}
	s.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
	return s;
}

const THINKING_TEXT: Record<string, Record<string, string>> = {
	nerd: {
		minimal: "\u{F0E7} min",
		low: "\u{F10C} low",
		medium: "\u{F192} med",
		high: "\u{F111} high",
		xhigh: "\u{F06D} xhi",
	},
	ascii: { minimal: "[min]", low: "[low]", medium: "[med]", high: "[high]", xhigh: "[xhi]" },
};

const THINKING_THEME: Record<string, string> = {
	minimal: "thinking_minimal",
	low: "thinking_low",
	medium: "thinking_medium",
	high: "thinking_high",
	xhigh: "thinking_xhigh",
};

// ═══════════════════════════════════════════════════════════════════════════
// Git Status (cached async)
// ═══════════════════════════════════════════════════════════════════════════

let cachedGitStatus: { staged: number; unstaged: number; untracked: number; ts: number } | null = null;
let cachedGitBranch: { branch: string | null; ts: number } | null = null;
let pendingGitStatus: Promise<void> | null = null;
let pendingGitBranch: Promise<void> | null = null;
let gitStatusVer = 0;
let gitBranchVer = 0;

function runGit(args: string[], timeoutMs = 200): Promise<string | null> {
	return new Promise((resolve) => {
		const proc = spawn("git", args, { stdio: ["ignore", "pipe", "pipe"] });
		let stdout = "";
		let done = false;
		const finish = (r: string | null) => {
			if (done) return;
			done = true;
			clearTimeout(tid);
			resolve(r);
		};
		proc.stdout.on("data", (d) => {
			stdout += d.toString();
		});
		proc.on("close", (code) => finish(code === 0 ? stdout.trim() : null));
		proc.on("error", () => finish(null));
		const tid = setTimeout(() => {
			proc.kill();
			finish(null);
		}, timeoutMs);
	});
}

function parseGitPorcelain(output: string) {
	let staged = 0;
	let unstaged = 0;
	let untracked = 0;
	for (const line of output.split("\n")) {
		if (!line) continue;
		const x = line[0];
		const y = line[1];
		if (x === "?" && y === "?") {
			untracked++;
			continue;
		}
		if (x && x !== " " && x !== "?") staged++;
		if (y && y !== " ") unstaged++;
	}
	return { staged, unstaged, untracked };
}

async function fetchBranch(): Promise<string | null> {
	const b = await runGit(["branch", "--show-current"]);
	if (b === null) return null;
	if (b) return b;
	const sha = await runGit(["rev-parse", "--short", "HEAD"]);
	return sha ? `${sha} (detached)` : "detached";
}

function getCurrentBranch(providerBranch: string | null): string | null {
	const now = Date.now();
	if (cachedGitBranch && now - cachedGitBranch.ts < 500) return cachedGitBranch.branch;
	if (!pendingGitBranch) {
		const v = gitBranchVer;
		pendingGitBranch = fetchBranch().then((r) => {
			if (v === gitBranchVer) cachedGitBranch = { branch: r, ts: Date.now() };
			pendingGitBranch = null;
		});
	}
	return cachedGitBranch ? cachedGitBranch.branch : providerBranch;
}

function getGitStatus(providerBranch: string | null): GitStatus {
	const now = Date.now();
	const branch = getCurrentBranch(providerBranch);
	if (cachedGitStatus && now - cachedGitStatus.ts < 1000) return { branch, ...cachedGitStatus };
	if (!pendingGitStatus) {
		const v = gitStatusVer;
		pendingGitStatus = runGit(["status", "--porcelain"], 500).then((out) => {
			if (v === gitStatusVer) {
				const r = out === null ? null : parseGitPorcelain(out);
				cachedGitStatus = r
					? { staged: r.staged, unstaged: r.unstaged, untracked: r.untracked, ts: Date.now() }
					: { staged: 0, unstaged: 0, untracked: 0, ts: Date.now() };
			}
			pendingGitStatus = null;
		});
	}
	if (cachedGitStatus) return { branch, ...cachedGitStatus };
	return { branch, staged: 0, unstaged: 0, untracked: 0 };
}

function invalidateGit() {
	cachedGitStatus = null;
	gitStatusVer++;
}
function invalidateGitBranch() {
	cachedGitBranch = null;
	gitBranchVer++;
}

// ═══════════════════════════════════════════════════════════════════════════
// Config Loading
// ═══════════════════════════════════════════════════════════════════════════

let configCache: UserConfig | null = null;
let configCacheTime = 0;

function configPath(): string {
	return join(getAgentDir(), "pure", "config", "pure-statusline.json");
}

function findConfigPath(): string | null {
	const p = configPath();
	if (existsSync(p)) return p;
	for (const leg of [join(getAgentDir(), "pure-statusline.json"), join(getAgentDir(), "powerline.json")]) {
		if (existsSync(leg)) return leg;
	}
	return null;
}

function loadConfig(): UserConfig | null {
	const now = Date.now();
	if (configCache && now - configCacheTime < 5000) return configCache;
	const path = findConfigPath();
	if (!path) {
		configCache = null;
		configCacheTime = now;
		return null;
	}
	try {
		configCache = JSON.parse(readFileSync(path, "utf-8"));
		configCacheTime = now;
		return configCache;
	} catch {
		configCache = null;
		configCacheTime = now;
		return null;
	}
}

function saveConfig(config: UserConfig): boolean {
	const p = configPath();
	try {
		mkdirSync(dirname(p), { recursive: true });
		writeFileSync(p, JSON.stringify(config, null, 2), "utf-8");
		configCache = config;
		configCacheTime = Date.now();
		return true;
	} catch {
		return false;
	}
}

function ensureConfig() {
	if (findConfigPath()) return;
	saveConfig({
		lines: DEFAULT_LINES.map((l) => ({ left: [...(l.left ?? [])], right: [...(l.right ?? [])] })),
	});
}

function clearConfigCache() {
	configCache = null;
	configCacheTime = 0;
}

/** Read pure.persona.id from Pi settings (project overrides global). Returns empty string if not set. */
function readPersonaId(): string {
	try {
		// Check project settings first, then global
		for (const p of [join(process.cwd(), ".pi", "settings.json"), join(getAgentDir(), "settings.json")]) {
			if (!existsSync(p)) continue;
			const raw = JSON.parse(readFileSync(p, "utf-8"));
			const id = raw?.pure?.persona?.id;
			if (typeof id === "string" && id) return id;
		}
	} catch {
		/* ignore */
	}
	return "";
}

/** Deep-merge user config with defaults to produce resolved config */
function resolveConfig(uc: UserConfig | null) {
	const palette: Record<string, ColorRef> = { ...DEFAULT_COLORS, ...uc?.colors };
	const userIcons = uc?.icons ?? {};
	const userSegs = uc?.segments ?? {};

	// Merge each segment's config with defaults
	const segs: Record<string, SegCfg> = {};
	for (const [id, defaults] of Object.entries(DEFAULT_SEGMENTS)) {
		segs[id] = { ...defaults, ...(userSegs[id] ?? {}) };
	}
	// Also include any user-defined segments not in defaults
	for (const id of Object.keys(userSegs)) {
		if (!segs[id]) segs[id] = userSegs[id] as SegCfg;
	}

	const lines = uc?.lines?.length
		? uc.lines.map((l) => ({ left: [...(l.left ?? [])], right: [...(l.right ?? [])] }))
		: (() => {
				const left = uc?.leftSegments ?? DEFAULT_LINES[0].left!;
				const right = uc?.rightSegments ?? DEFAULT_LINES[0].right!;
				return [{ left: [...left], right: [...right] }];
			})();

	return { palette, segs, userIcons, lines };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tool Counter State
// ═══════════════════════════════════════════════════════════════════════════

// Built-in Pi tools mapped to semantic theme tokens.
// The actual color is resolved from the active theme at assignment time.
const BUILTIN_TOOL_THEME: Record<string, ThemeColor> = {
	read: "success", // green
	write: "error", // red
	bash: "syntaxKeyword", // purple
	edit: "warning", // orange/yellow
};

/** Extract and dim a theme fg token into a pill background color */
function themeTokenToPillBg(theme: Theme, token: ThemeColor): `#${string}` | null {
	const ansi = theme.getFgAnsi(token);
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape matching
	const m = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
	if (!m) return null;
	const sr = parseInt(m[1], 10);
	const sg = parseInt(m[2], 10);
	const sb = parseInt(m[3], 10);
	const isLight = isLightTheme(theme);
	if (isLight) {
		// Pastel: mix color toward white at ~80%
		const r = Math.round(sr * 0.2 + 255 * 0.8);
		const g = Math.round(sg * 0.2 + 255 * 0.8);
		const b = Math.round(sb * 0.2 + 255 * 0.8);
		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}` as `#${string}`;
	}
	// Dark: dim to ~25%
	const r = Math.round(sr * 0.25);
	const g = Math.round(sg * 0.25);
	const b = Math.round(sb * 0.25);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}` as `#${string}`;
}

// Vibrant random color pool for non-built-in tools
const RANDOM_COLOR_POOL: `#${string}`[] = [
	"#1565c0",
	"#00838f",
	"#6a1b9a",
	"#ad1457",
	"#00695c",
	"#4527a0",
	"#283593",
	"#00838f",
	"#558b2f",
	"#bf360c",
	"#4e342e",
	"#37474f",
	"#1b5e20",
	"#880e4f",
	"#311b92",
];
let randomColorIdx = 0;

const toolCounts: Record<string, number> = {};
let toolTotal = 0;
let toolsLoaded = 0;
const toolColors: Record<string, `#${string}`> = {};
let _colorIdx = 0;

let cachedPillPalette: { themeName: string; colors: string[] } | null = null;

function isLightTheme(theme: Theme): boolean {
	// Check theme name first (covers built-in and common names)
	const name = (theme.name ?? "").toLowerCase();
	if (name.includes("light") || name.includes("latte")) return true;
	if (name.includes("dark") || name.includes("frappe") || name.includes("mocha") || name.includes("macchiato"))
		return false;
	// Fallback: measure brightness of the "text" fg color
	const ansi = theme.getFgAnsi("text");
	// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape matching
	const m = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
	if (!m) return false;
	const luminance = 0.299 * parseInt(m[1], 10) + 0.587 * parseInt(m[2], 10) + 0.114 * parseInt(m[3], 10);
	return luminance > 140;
}

function _getPillPalette(theme: Theme, segs: Record<string, SegCfg>): string[] {
	const userPalette = (segs.tool_counter?.palette as string[]) ?? [];
	if (userPalette.length > 0) return [...userPalette];
	if (cachedPillPalette && cachedPillPalette.themeName === (theme.name ?? "")) return cachedPillPalette.colors;
	const isLight = isLightTheme(theme);
	// Dark theme: dim the source colors for subtle backgrounds
	// Light theme: brighten + desaturate for pastel-like backgrounds
	const sources: ThemeColor[] = ["accent", "syntaxKeyword", "syntaxString", "syntaxType", "syntaxFunction"];
	const palette = sources.map((tc) => {
		const ansi = theme.getFgAnsi(tc);
		// biome-ignore lint/suspicious/noControlCharactersInRegex: ANSI escape matching
		const m = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
		if (!m) return isLight ? "#d4c8e8" : "#413158";
		const sr = parseInt(m[1], 10);
		const sg = parseInt(m[2], 10);
		const sb = parseInt(m[3], 10);
		if (isLight) {
			// Pastel: mix color toward white (255) at ~70% white
			const r = Math.round(sr * 0.2 + 255 * 0.8);
			const g = Math.round(sg * 0.2 + 255 * 0.8);
			const b = Math.round(sb * 0.2 + 255 * 0.8);
			return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
		}
		// Dark: dim to ~25% for subtle backgrounds
		const r = Math.round(sr * 0.25);
		const g = Math.round(sg * 0.25);
		const b = Math.round(sb * 0.25);
		return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
	});
	cachedPillPalette = { themeName: theme.name ?? "", colors: palette };
	return palette;
}

function getUserToolColors(): Record<string, `#${string}`> {
	return loadConfig()?.tool_colors ?? {};
}

function assignToolColor(name: string, theme: Theme, _segs: Record<string, SegCfg>) {
	if (toolColors[name]) return;
	const userColors = getUserToolColors();
	// Priority: user config → built-in theme-derived → random from pool
	if (userColors[name]) {
		toolColors[name] = userColors[name];
	} else if (BUILTIN_TOOL_THEME[name]) {
		const bg = themeTokenToPillBg(theme, BUILTIN_TOOL_THEME[name]);
		toolColors[name] = bg ?? (RANDOM_COLOR_POOL[randomColorIdx++ % RANDOM_COLOR_POOL.length] as `#${string}`);
	} else {
		toolColors[name] = RANDOM_COLOR_POOL[randomColorIdx % RANDOM_COLOR_POOL.length] as `#${string}`;
		randomColorIdx++;
	}
}

function resetToolCounts() {
	for (const k of Object.keys(toolCounts)) delete toolCounts[k];
	for (const k of Object.keys(toolColors)) delete toolColors[k];
	toolTotal = 0;
	_colorIdx = 0;
	randomColorIdx = 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// Segment Rendering
// ═══════════════════════════════════════════════════════════════════════════

type Seg = { content: string; visible: boolean };

function renderSegment(id: SegmentId, ctx: RenderCtx): Seg {
	if (id.startsWith("text:")) return { content: id.slice(5), visible: id.length > 5 };

	const { theme, palette, segs, icons, data } = ctx;
	const seg = segs[id] ?? {};

	if (seg.disabled) return { content: "", visible: false };

	const i = ico(id, icons, segs);
	const cc = (key: string, text: string) => c(theme, palette, key, text);

	switch (id) {
		case "persona": {
			const personaId = readPersonaId();
			if (!personaId) return { content: "", visible: false };
			const icon = i ? `${i} ` : "";
			return { content: cc((seg.style as string) || "persona", `${icon}${personaId}`), visible: true };
		}
		case "pi": {
			if (!i) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "model", `${i} `), visible: true };
		}
		case "model": {
			let name = data.model?.name || data.model?.id || "no-model";
			if (name.startsWith("Claude ")) name = name.slice(7);
			let content = cc((seg.style as string) || "model", withIcon(i, name));
			if (seg.show_thinking_level !== false && data.model?.reasoning) {
				const level = data.thinkingLevel || "off";
				if (level !== "off") {
					const tt = THINKING_TEXT[hasNerdFonts() ? "nerd" : "ascii"][level];
					if (tt) content += ` · ${cc(THINKING_THEME[level] ?? "", tt)}`;
				}
			}
			return { content, visible: true };
		}
		case "path": {
			const mode = seg.mode ?? "basename";
			let pwd = data.cwd;
			const home = process.env.HOME || process.env.USERPROFILE;
			if (mode === "basename") {
				pwd = basename(pwd) || pwd;
			} else {
				if (home && pwd.startsWith(home)) pwd = `~${pwd.slice(home.length)}`;
				if (mode === "abbreviated") {
					const max = (seg.max_length as number) ?? 40;
					if (pwd.length > max) pwd = `…${pwd.slice(-(max - 1))}`;
				}
			}
			return { content: cc((seg.style as string) || "path", withIcon(i, pwd)), visible: true };
		}
		case "git": {
			const { branch, staged, unstaged, untracked } = data.git;
			if (!branch && !staged && !unstaged && !untracked) return { content: "", visible: false };
			const dirty = staged > 0 || unstaged > 0 || untracked > 0;
			let content = "";
			if (seg.show_branch !== false && branch) {
				content = cc(
					dirty ? (seg.dirty_branch_style as string) || "git_dirty" : (seg.branch_style as string) || "git_clean",
					withIcon(i, branch),
				);
			}
			const ind: string[] = [];
			if (seg.show_unstaged !== false && unstaged > 0)
				ind.push(cc((seg.unstaged_style as string) || "git_unstaged", `*${unstaged}`));
			if (seg.show_staged !== false && staged > 0)
				ind.push(cc((seg.staged_style as string) || "git_staged", `+${staged}`));
			if (seg.show_untracked !== false && untracked > 0)
				ind.push(cc((seg.untracked_style as string) || "git_untracked", `?${untracked}`));
			if (ind.length > 0) content += (content ? " " : "") + ind.join(" ");
			return content ? { content, visible: true } : { content: "", visible: false };
		}
		case "thinking": {
			const level = data.thinkingLevel || "off";
			if (level === "off") return { content: "", visible: false };
			const labels: Record<string, string> = {
				minimal: "min",
				low: "low",
				medium: "med",
				high: "high",
				xhigh: "xhigh",
			};
			const text = withIcon(i, labels[level] ?? level);
			if (level === "high" || level === "xhigh") return { content: rainbow(text), visible: true };
			const styleKey = (seg.style as string) || THINKING_THEME[level] || "";
			return { content: styleKey ? cc(styleKey, text) : text, visible: true };
		}
		case "token_in": {
			const { input } = data.usageStats;
			if (!input) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tokens", withIcon(i, fmtTokens(input))), visible: true };
		}
		case "token_out": {
			const { output } = data.usageStats;
			if (!output) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tokens", withIcon(i, fmtTokens(output))), visible: true };
		}
		case "token_total": {
			const { input, output, cacheRead, cacheWrite } = data.usageStats;
			const total = input + output + cacheRead + cacheWrite;
			if (!total) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tokens", withIcon(i, fmtTokens(total))), visible: true };
		}
		case "cost": {
			const { cost } = data.usageStats;
			if (!cost && !data.usingSubscription) return { content: "", visible: false };
			return {
				content: cc((seg.style as string) || "cost", data.usingSubscription ? "(sub)" : `$${cost.toFixed(2)}`),
				visible: true,
			};
		}
		case "context_pct": {
			const pct = data.contextPercent;
			const window = data.contextWindow;
			const autoIcon =
				data.autoCompactEnabled && seg.show_auto_icon !== false && ico("auto", icons, segs)
					? ` ${ico("auto", icons, segs)}`
					: "";
			const text = `${pct.toFixed(1)}%/${fmtTokens(window)}${autoIcon}`;
			const wt = (seg.warn_threshold as number) ?? 70;
			const et = (seg.error_threshold as number) ?? 90;
			const styleKey =
				pct > et
					? (seg.error_style as string) || "context_error"
					: pct > wt
						? (seg.warn_style as string) || "context_warn"
						: (seg.style as string) || "context";
			return { content: withIcon(i, cc(styleKey, text)), visible: true };
		}
		case "context_total": {
			if (!data.contextWindow) return { content: "", visible: false };
			return {
				content: cc((seg.style as string) || "context", withIcon(i, fmtTokens(data.contextWindow))),
				visible: true,
			};
		}
		case "cache_read": {
			const { cacheRead } = data.usageStats;
			if (!cacheRead) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tokens", withIcon(i, fmtTokens(cacheRead))), visible: true };
		}
		case "cache_write": {
			const { cacheWrite } = data.usageStats;
			if (!cacheWrite) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tokens", withIcon(i, fmtTokens(cacheWrite))), visible: true };
		}
		case "separator": {
			const text = (seg.text as string) || i;
			return { content: text, visible: true };
		}
		case "tools": {
			const entries = Object.entries(data.toolCounts);
			if (!entries.length) return { content: "", visible: false };
			const sorted = sortTools(entries, (seg.sort_by as ToolSortOrder) ?? "countDesc");
			const max = (seg.max_tools as number) ?? 4;
			const limited = max > 0 ? sorted.slice(0, max) : sorted;
			const parts = limited.map(
				([n, cnt]) =>
					`${cc((seg.style as string) || "tools", n)}${cc((seg.dim_style as string) || "tools_dim", `(${cnt})`)}`,
			);
			const iconStr = seg.show_icon !== false && i ? `${i} ` : "";
			return { content: `${iconStr}${parts.join(cc("separator", " "))}`, visible: true };
		}
		case "tool_counter": {
			const entries = Object.entries(data.toolCounts);
			const label = (seg.label as string) ?? "Tools";
			const labelStyle = (seg.label_style as string) ?? "muted";
			const _pillTextStyle = (seg.pill_text_style as string) ?? "text";
			const unique = Object.keys(data.toolCounts).length;
			const iconStr = seg.show_icon !== false ? i : "";
			const iconPart = iconStr ? `${iconStr} ` : "";
			const labelText = cc(labelStyle, `${iconPart}${label} (${data.toolsLoaded}|${unique}):`);
			if (!entries.length) {
				if (seg.show_on_empty === false) return { content: "", visible: false };
				return {
					content: `${labelText} ${cc("tools_dim", (seg.waiting_text as string) ?? "waiting...")}`,
					visible: true,
				};
			}
			const sorted = sortTools(entries, (seg.sort_by as ToolSortOrder) ?? "firstSeen");
			const max = (seg.max_tools as number) ?? 0;
			const limited = max > 0 ? sorted.slice(0, max) : sorted;
			const overflow = max > 0 ? sorted.length - limited.length : 0;
			// Detect light theme for pill text contrast
			const isLight = isLightTheme(theme);
			const pills = limited.map(([name, count]) => {
				const bg = data.toolColors[name] ?? (isLight ? "#d4c8e8" : "#413158");
				// Dark text on light backgrounds, bright white on dark backgrounds
				const textColor = isLight ? "\x1b[30m" : "\x1b[97m";
				const pillText = `${textColor} ${name} ${count} \x1b[0m`;
				return hexBg(bg, pillText);
			});
			const overflowText = overflow > 0 ? ` ${cc("tools_dim", `+${overflow}`)}` : "";
			return { content: `${labelText} ${pills.join(" ")}${overflowText}`, visible: true };
		}
		case "tool_total_uses": {
			if (!data.toolTotal) return { content: "", visible: false };
			return { content: cc((seg.style as string) || "tools_dim", `${data.toolTotal} uses`), visible: true };
		}
		default:
			return { content: "", visible: false };
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// Footer Layout
// ═══════════════════════════════════════════════════════════════════════════

function renderSegList(ids: SegmentId[], ctx: RenderCtx): string {
	const parts: string[] = [];
	for (const id of ids) {
		const { content, visible } = renderSegment(id, ctx);
		if (visible && content) parts.push(content);
	}
	return parts.join(" ");
}

function renderRow(row: ConfigRow, ctx: RenderCtx, width: number): string {
	const inner = Math.max(1, width - 2);
	const left = renderSegList(row.left ?? [], ctx);
	const right = renderSegList(row.right ?? [], ctx);
	if (!left && !right) return "";
	if (!right) return ` ${truncateToWidth(left, inner)} `;
	if (!left) {
		const t = truncateToWidth(right, inner);
		return ` ${" ".repeat(Math.max(0, inner - visibleWidth(t)))}${t} `;
	}
	const lw = visibleWidth(left);
	const rw = visibleWidth(right);
	if (lw + 1 + rw <= inner) return ` ${left}${" ".repeat(inner - lw - rw)}${right} `;
	if (rw >= inner) {
		const t = truncateToWidth(right, inner);
		return ` ${" ".repeat(Math.max(0, inner - visibleWidth(t)))}${t} `;
	}
	const lb = Math.max(1, inner - rw - 1);
	const tl = truncateToWidth(left, lb);
	const gap = Math.max(1, inner - visibleWidth(tl) - rw);
	return ` ${tl}${" ".repeat(gap)}${right} `;
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension
// ═══════════════════════════════════════════════════════════════════════════

const GIT_BRANCH_RE = [
	/\bgit\s+(checkout|switch|branch\s+-[dDmM]|merge|rebase|pull|reset|worktree)/,
	/\bgit\s+stash\s+(pop|apply)/,
];
function isGitBranchCmd(cmd: string): boolean {
	return GIT_BRANCH_RE.some((p) => p.test(cmd));
}

export default function pureStatusLine(pi: ExtensionAPI) {
	let currentCtx: any = null;
	let footerRef: ReadonlyFooterDataProvider | null = null;
	let getThinkingLevel: (() => string) | null = null;
	let tuiRef: any = null;
	let currentTheme: Theme | null = null;
	let currentThemeName: string | null = null;

	pi.on("tool_execution_end", async (event) => {
		if (currentTheme) {
			const { segs } = resolveConfig(loadConfig());
			assignToolColor(event.toolName, currentTheme, segs);
		}
		toolCounts[event.toolName] = (toolCounts[event.toolName] || 0) + 1;
		toolTotal++;
		tuiRef?.requestRender();
	});

	pi.on("session_start", async (_event, ctx) => {
		ensureConfig();
		clearConfigCache();
		cachedPillPalette = null;
		currentCtx = ctx;
		resetToolCounts();
		try {
			toolsLoaded = pi.getActiveTools?.()?.length ?? 0;
		} catch {
			toolsLoaded = 0;
		}
		if (typeof ctx.getThinkingLevel === "function") getThinkingLevel = () => ctx.getThinkingLevel();
		if (ctx.hasUI) setupFooter(ctx);
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName === "write" || event.toolName === "edit") invalidateGit();
		if (event.toolName === "bash" && event.input?.command) {
			if (isGitBranchCmd(String(event.input.command))) {
				invalidateGit();
				invalidateGitBranch();
				setTimeout(() => tuiRef?.requestRender(), 100);
			}
		}
	});

	pi.on("user_bash", async (event) => {
		if (isGitBranchCmd(event.command)) {
			invalidateGit();
			invalidateGitBranch();
			for (const ms of [100, 300, 500]) setTimeout(() => tuiRef?.requestRender(), ms);
		}
	});

	pi.registerCommand("statusline", {
		description: "Configure status footer (reload, debug, reset-tools, tools [on|off])",
		handler: async (args, ctx) => {
			currentCtx = ctx;
			const a = args?.trim().toLowerCase() ?? "reload";
			if (!a || a === "reload") {
				clearConfigCache();
				cachedPillPalette = null;
				ensureConfig();
				if (ctx.hasUI) setupFooter(ctx);
				ctx.ui.notify(`Config reloaded from ${configPath()}`, "info");
				return;
			}
			if (a === "debug") {
				const { lines, palette, segs } = resolveConfig(loadConfig());
				const lns = lines.map(
					(l, idx) => `L${idx + 1} left=[${l.left?.join(", ") ?? "-"}] right=[${l.right?.join(", ") ?? "-"}]`,
				);
				const paletteInfo = Object.entries(palette)
					.filter(([k]) => k !== (DEFAULT_COLORS as Record<string, ColorRef>)[k])
					.map(([k, v]) => `${k}=${v}`);
				const segOverrides = Object.entries(segs)
					.filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(DEFAULT_SEGMENTS[k]))
					.map(([k]) => k);
				ctx.ui.notify(
					[
						`Config: ${configPath()}`,
						...lns,
						`Palette overrides: ${paletteInfo.join(", ") || "(defaults)"}`,
						`Segment overrides: ${segOverrides.join(", ") || "(defaults)"}`,
					].join(" | "),
					"info",
				);
				return;
			}
			if (a === "reset-tools") {
				resetToolCounts();
				tuiRef?.requestRender();
				ctx.ui.notify("Tool counters reset", "info");
				return;
			}
			if (a.startsWith("tools")) {
				const ec = resolveConfig(loadConfig());
				const enabled = ec.segs.tool_counter?.disabled !== true;
				const want = a === "tools on" ? true : a === "tools off" ? false : !enabled;
				const uc = loadConfig() ?? {};
				const prevSegs = uc.segments ?? {};
				saveConfig({
					...uc,
					lines: uc.lines ?? ec.lines,
					segments: { ...prevSegs, tool_counter: { ...prevSegs.tool_counter, disabled: !want } },
				});
				clearConfigCache();
				cachedPillPalette = null;
				tuiRef?.requestRender();
				ctx.ui.notify(`Tools display ${want ? "enabled" : "disabled"}`, "info");
				return;
			}
			ctx.ui.notify("Usage: /statusline [reload|debug|reset-tools|tools [on|off]]", "info");
		},
	});

	function buildRenderCtx(ctx: any, _width: number, theme: Theme): RenderCtx {
		// Reassign tool colors when theme changes (built-in tools derive from theme tokens)
		if (currentThemeName !== (theme.name ?? null)) {
			cachedPillPalette = null;
			for (const name of Object.keys(toolColors)) {
				if (BUILTIN_TOOL_THEME[name]) {
					const bg = themeTokenToPillBg(theme, BUILTIN_TOOL_THEME[name]);
					if (bg) toolColors[name] = bg;
				}
			}
		}
		currentTheme = theme;
		currentThemeName = theme.name ?? null;
		const { palette, segs, userIcons } = resolveConfig(loadConfig());

		let input = 0,
			output = 0,
			cacheRead = 0,
			cacheWrite = 0,
			cost = 0;
		let lastAssistant: AssistantMessage | undefined;
		let thinkingLevel = "off";
		for (const e of ctx.sessionManager?.getBranch?.() ?? []) {
			if (e.type === "thinking_level_change" && e.thinkingLevel) thinkingLevel = e.thinkingLevel;
			if (e.type === "message" && e.message.role === "assistant") {
				const m = e.message as AssistantMessage;
				if (m.stopReason === "error" || m.stopReason === "aborted") continue;
				input += m.usage.input;
				output += m.usage.output;
				cacheRead += m.usage.cacheRead;
				cacheWrite += m.usage.cacheWrite;
				cost += m.usage.cost.total;
				lastAssistant = m;
			}
		}
		const ctxTokens = lastAssistant
			? lastAssistant.usage.input +
				lastAssistant.usage.output +
				lastAssistant.usage.cacheRead +
				lastAssistant.usage.cacheWrite
			: 0;
		const ctxWindow = ctx.model?.contextWindow || 0;
		const gitBranch = footerRef?.getGitBranch() ?? null;

		return {
			theme,
			palette,
			segs,
			icons: userIcons,
			data: {
				cwd: ctx.cwd,
				model: ctx.model,
				thinkingLevel: thinkingLevel || getThinkingLevel?.() || "off",
				usageStats: { input, output, cacheRead, cacheWrite, cost },
				contextPercent: ctxWindow > 0 ? (ctxTokens / ctxWindow) * 100 : 0,
				contextWindow: ctxWindow,
				autoCompactEnabled: ctx.settingsManager?.getCompactionSettings?.()?.enabled ?? true,
				usingSubscription: ctx.model ? (ctx.modelRegistry?.isUsingOAuth?.(ctx.model) ?? false) : false,
				git: getGitStatus(gitBranch),
				toolCounts: { ...toolCounts },
				toolTotal,
				toolsLoaded,
				toolColors: { ...toolColors },
			},
		};
	}

	function setupFooter(ctx: any) {
		ensureConfig();
		ctx.ui.setFooter((tui: any, theme: Theme, footerData: ReadonlyFooterDataProvider) => {
			footerRef = footerData;
			tuiRef = tui;
			const unsub = footerData.onBranchChange(() => tui.requestRender());
			return {
				dispose: unsub,
				invalidate() {},
				render(width: number): string[] {
					const rctx = buildRenderCtx(currentCtx ?? ctx, width, theme);
					const { lines } = resolveConfig(loadConfig());
					const rendered = lines.map((l) => renderRow(l, rctx, width)).filter((l) => l.length > 0);
					return rendered.length > 0 ? rendered : [` ${truncateToWidth("", Math.max(1, width - 2))} `];
				},
			};
		});
	}
}
