// pure-statusline
// Configurable Pi status footer — Starship-inspired per-segment config system.
// Every color, icon, and option is overridable via JSON config.
// Colors default to Pi theme tokens (theme.fg()) so they follow the active theme automatically.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import type { AssistantMessage } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ExtensionContext, ReadonlyFooterDataProvider, Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
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
	| "tool_stats"
	| "session"
	| "separator"
	| "separator1"
	| "separator2"
	| "separator3"
	| "path1"
	| "path2"
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
	/** Show extension statuses (from ctx.ui.setStatus) as a 4th line. Default: true */
	show_extension_statuses?: boolean;
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
type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

interface RenderCtx {
	theme: Theme;
	palette: Record<string, ColorRef>;
	segs: Record<string, SegCfg>;
	icons: Record<string, string>;
	data: {
		cwd: string;
		model: { id: string; name?: string; reasoning?: boolean; contextWindow?: number } | undefined;
		thinkingLevel: ThinkingLevel;
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
		sessionName: string;
		persona: string;
		extensionStatuses: ReadonlyMap<string, string>;
	};
}

// ═══════════════════════════════════════════════════════════════════════════
// Icon Sets
// ═══════════════════════════════════════════════════════════════════════════

const NERD: Record<string, string> = {
	pi: "\uE22C",
	model: "\uEC19",
	path: "\uF114",
	git: "\uF126",
	thinking: "\uEE9C",
	session: "",
	token_in: "\uF090",
	token_out: "\uF08B",
	token_total: "\uE26B",
	cost: "\uF155",
	context_pct: "",
	context_total: "",
	cache_read: "\uF1C0",
	cache_write: "\uF1C0",
	separator: "\uEB10",
	separator1: "\uF142",
	separator2: "\uDB80\uDDDD",
	separator3: "\uEF4D",
	path1: "\uEA83",
	path2: "",
	auto: "\uF0068",
	tools: "\uF0AD",
};

const ASCII: Record<string, string> = {
	pi: "π",
	model: "◈",
	path: "📁",
	git: "⎇",
	thinking: "\u{1F9E0}",
	session: "",
	token_in: "↑",
	token_out: "↓",
	token_total: "⊛",
	cost: "$",
	context_pct: "",
	context_total: "",
	cache_read: "↙",
	cache_write: "↗",
	separator: "|",
	separator1: "|",
	separator2: "╱",
	separator3: "·",
	path1: "📁",
	path2: "",
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
	model: "text",
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
	tools: "dim",
	tools_dim: "dim",
	separator: "dim",
	separator1: "dim",
	separator2: "dim",
	separator3: "dim",
	path1: "text",
	path2: "text",
	persona: "syntaxKeyword",
	session: "text",
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
	{
		left: ["persona", "separator", "model", "thinking", "separator", "context_pct", "separator", "session"],
		right: [],
	},
	{
		left: ["path2", "separator", "path1", "git"],
		right: [],
	},
	{ left: ["tool_stats"] },
];

const DEFAULT_SEGMENTS: Record<string, SegCfg> = {
	persona: { style: "persona" },
	session: { style: "session" },
	model: { style: "model", show_thinking_level: false },
	path: { style: "path", mode: "basename", max_length: 40 },
	path1: { style: "path1", mode: "basename", max_length: 40 },
	path2: { style: "path2", mode: "parent", bold: true },
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
	thinking: { style: "", show_label: false, show_when_off: false },
	token_in: { style: "tokens" },
	token_out: { style: "tokens" },
	token_total: { style: "tokens" },
	cost: { style: "cost" },
	context_pct: {
		style: "success",
		warn_style: "warning",
		error_style: "text",
		warn_threshold: 50,
		error_threshold: 80,
		show_auto_icon: false,
		show_window: false,
	},
	context_total: { style: "context" },
	cache_read: { style: "tokens" },
	cache_write: { style: "tokens" },
	separator: { text: "" },
	separator1: { text: "" },
	separator2: { text: "" },
	separator3: { text: "" },
	tools: { style: "tools", dim_style: "tools_dim", max_tools: 4, show_icon: true, sort_by: "countDesc" },
	tool_counter: {
		label: "Tools",
		label_style: "dim",
		pill_text_style: "text",
		palette: [] as string[],
		max_tools: 0,
		show_on_empty: true,
		sort_by: "firstSeen",
		waiting_text: "waiting...",
	},
	tool_total_uses: { style: "tools_dim" },
	tool_stats: {
		icon: "tools",
		max_tools: 4,
		pill_text_color: true,
	},
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

function refToRgb(theme: Theme, ref: ColorRef): [number, number, number] | null {
	if (ref.startsWith("#")) {
		const h = ref.replace("#", "");
		return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
	}
	const ansi = theme.getFgAnsi(ref as ThemeColor);
	const m = ansi.match(/\x1b\[38;2;(\d+);(\d+);(\d+)m/);
	if (!m) return null;
	return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)];
}

function blendToHex(source: [number, number, number], target: [number, number, number], factor: number): `#${string}` {
	const r = Math.round(source[0] * (1 - factor) + target[0] * factor);
	const g = Math.round(source[1] * (1 - factor) + target[1] * factor);
	const b = Math.round(source[2] * (1 - factor) + target[2] * factor);
	return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function cFaint(theme: Theme, palette: Record<string, ColorRef>, key: string, text: string, factor = 0.72): string {
	const ref = palette[key] ?? DEFAULT_COLORS[key];
	if (!ref) return theme.fg("dim", text);
	const source = refToRgb(theme, ref);
	const dim = refToRgb(theme, "dim");
	if (!source || !dim) return c(theme, palette, key, text);
	return hexFg(blendToHex(source, dim, factor), text);
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

const THINKING_TEXT: Record<"nerd" | "ascii", Record<ThinkingLevel, string>> = {
	nerd: {
		off: "off",
		minimal: "\u{F0E7} min",
		low: "\u{F10C} low",
		medium: "\u{F192} med",
		high: "\u{F111} high",
		xhigh: "\u{F06D} xhi",
	},
	ascii: {
		off: "off",
		minimal: "[min]",
		low: "[low]",
		medium: "[med]",
		high: "[high]",
		xhigh: "[xhi]",
	},
};

const THINKING_THEME: Record<ThinkingLevel, string> = {
	off: "dim",
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
	const icons = hasNerdFonts() ? NERD : ASCII;
	saveConfig({
		lines: DEFAULT_LINES.map((l) => ({ left: [...(l.left ?? [])], right: [...(l.right ?? [])] })),
		colors: { ...DEFAULT_COLORS },
		icons: { ...icons },
		segments: Object.fromEntries(Object.entries(DEFAULT_SEGMENTS).map(([id, cfg]) => [id, { ...cfg }])),
	});
}

function clearConfigCache() {
	configCache = null;
	configCacheTime = 0;
}

function normalizeThinkingLevel(value: unknown): ThinkingLevel {
	if (
		value === "off" ||
		value === "minimal" ||
		value === "low" ||
		value === "medium" ||
		value === "high" ||
		value === "xhigh"
	) {
		return value;
	}
	return "off";
}

function getUsageStats(ctx: ExtensionContext): UsageStats {
	let input = 0;
	let output = 0;
	let cacheRead = 0;
	let cacheWrite = 0;
	let cost = 0;
	for (const e of ctx.sessionManager.getBranch()) {
		if (e.type !== "message" || e.message.role !== "assistant") continue;
		const m = e.message as AssistantMessage;
		input += m.usage?.input ?? 0;
		output += m.usage?.output ?? 0;
		cacheRead += m.usage?.cacheRead ?? 0;
		cacheWrite += m.usage?.cacheWrite ?? 0;
		cost += m.usage?.cost?.total ?? 0;
	}
	return { input, output, cacheRead, cacheWrite, cost };
}

function formatCount(n: number): string {
	return n < 1000 ? `${n}` : `${(n / 1000).toFixed(1)}k`;
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
		: DEFAULT_LINES.map((l) => ({ left: [...(l.left ?? [])], right: [...(l.right ?? [])] }));

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

function dimHex(hex: string, isDark: boolean): string {
	const h = hex.replace("#", "");
	if (h.length < 6) return "\x1b[90m";
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	const factor = isDark ? 0.85 : 0.55;
	return `\x1b[38;2;${Math.round(r * factor)};${Math.round(g * factor)};${Math.round(b * factor)}m`;
}


// ═══════════════════════════════════════════════════════════════════════════
// Segment Rendering
// ═══════════════════════════════════════════════════════════════════════════

type Seg = { content: string; visible: boolean };

function renderSegment(id: SegmentId, ctx: RenderCtx): Seg {
	if (id.startsWith("text:")) return { content: id.slice(5), visible: id.length > 5 };
	const seg = (ctx.segs as Record<string, SegCfg>)[id];
	if (!seg || (seg.disabled as boolean)) return { content: "", visible: false };

	const theme = ctx.theme;
	const data = ctx.data;
	const icons = ctx.icons;
	const segs = ctx.segs as Record<string, SegCfg>;

	switch (id as SegmentId) {
		case "tool_stats": {
			const iconStr = (seg as any).icon ? ico((seg as any).icon as string, icons, segs) : "";
			const label = (seg as any).label as string | undefined;
			const labelPart = label ? ` ${label}` : "";
			const unique = Object.keys(data.toolCounts).length;
			const stats = theme.fg("dim", `${iconStr}  ${data.toolsLoaded}${labelPart} • ${unique} • ${data.toolTotal}`);
			const entries = Object.entries(data.toolCounts);
			const sorted = sortTools(entries, ((seg as any).sort_by as ToolSortOrder) ?? "countDesc");
			const max = ((seg as any).max_tools as number) ?? 0;
			const limited = max > 0 ? sorted.slice(0, max) : sorted;
			const isLight = isLightTheme(theme);
			const dimCode = theme.getFgAnsi("dim");
			const useBg = (seg as any).pill_bg === true;
			const useTextColor = (seg as any).pill_text_color === true;
			const pills = limited.map(([name, count]) => {
				const bg = data.toolColors[name] ?? (isLight ? "#d4c8e8" : "#413158");
				let textColor = dimCode;
				if (useTextColor) textColor = dimHex(bg, isLight);
				const text = `${textColor}${name}×${count}\x1b[0m`;
				if (!useBg) return text;
				return hexBg(bg, text);
			});
			return { content: pills.length > 0 ? `${stats} ${pills.join(" ")}` : stats, visible: true };
		}
		case "tool_counter": {
			const label = ((seg as any).label as string) ?? "";
			const entries = Object.entries(data.toolCounts);
			const sorted = sortTools(entries, ((seg as any).sort_by as ToolSortOrder) ?? "firstSeen");
			const max = ((seg as any).max_tools as number) ?? 0;
			const limited = max > 0 ? sorted.slice(0, max) : sorted;
			const isLight = isLightTheme(theme);
			const pills = limited.map(([name, count]) => {
				const bg = data.toolColors[name] ?? (isLight ? "#d4c8e8" : "#413158");
				const dimCode = theme.getFgAnsi("dim");
				const pillText = `${dimCode} ${name} ${count} \x1b[0m`;
				return hexBg(bg, pillText);
			});
			const overflowText = max > 0 && sorted.length > max ? ` ${theme.fg("dim", `+${sorted.length - max}`)}` : "";
			const labelText = label ? ` ${label}` : "";
			return { content: `${labelText} ${pills.join(" ")}${overflowText}`, visible: true };
		}
		case "tool_total_uses":
			if (!data.toolTotal) return { content: "", visible: false };
			return { content: theme.fg("dim", `${data.toolTotal} uses`), visible: true };
		case "persona": {
			const icon = ico("user", icons, segs) || "›";
			const name = data.persona || "Assistant";
			const style = (seg as any).style ?? "persona";
			return { content: c(theme, ctx.palette, style, `${icon} ${name}`.trim()), visible: true };
		}
		case "model": {
			const model = data.model?.name ?? data.model?.id ?? "unknown";
			const icon = ico("chip", icons, segs) || "";
			const style = (seg as any).style ?? "model";
			return { content: c(theme, ctx.palette, style, `${icon} ${model}`.trim()), visible: true };
		}
		case "token_in":
			return { content: c(theme, ctx.palette, "tokens", `${ico("token_in", icons, segs) || ""} ${formatCount(data.usageStats.input)}`.trim()), visible: data.usageStats.input > 0 };
		case "token_out":
			return { content: c(theme, ctx.palette, "tokens", `${ico("token_out", icons, segs) || ""} ${formatCount(data.usageStats.output)}`.trim()), visible: data.usageStats.output > 0 };
		case "token_total": {
			const total = data.usageStats.input + data.usageStats.output;
			return { content: c(theme, ctx.palette, "tokens", `${ico("token_total", icons, segs) || ""} ${formatCount(total)}`.trim()), visible: total > 0 };
		}
		case "cache_read":
			return { content: c(theme, ctx.palette, "tokens", `${ico("cache_read", icons, segs) || ""} ${formatCount(data.usageStats.cacheRead)}`.trim()), visible: data.usageStats.cacheRead > 0 };
		case "cache_write":
			return { content: c(theme, ctx.palette, "tokens", `${ico("cache_write", icons, segs) || ""} ${formatCount(data.usageStats.cacheWrite)}`.trim()), visible: data.usageStats.cacheWrite > 0 };
		case "cost":
			return { content: c(theme, ctx.palette, "cost", `${ico("cost", icons, segs) || ""} $${data.usageStats.cost.toFixed(3)}`.trim()), visible: data.usageStats.cost > 0 };
		case "separator":
			return { content: theme.fg("dim", (seg as any).text ?? "│"), visible: true };
		case "separator1":
		case "separator2":
		case "separator3":
		case "separator4": {
			const char = (seg as any).char ?? " ";
			const style = (seg as any).style ?? "dim";
			return { content: theme.fg(style, char), visible: true };
		}
		case "context_pct": {
			const pct = data.contextPercent ?? 0;
			const icon = ico("database", icons, segs) || "";
			const errorThresh = ((seg as any).error_threshold as number) ?? 90;
			const warnThresh = ((seg as any).warn_threshold as number) ?? 70;
			let colorKey = ((seg as any).style as string) ?? "context";
			if (pct >= errorThresh) colorKey = ((seg as any).error_style as string) ?? "error";
			else if (pct >= warnThresh) colorKey = ((seg as any).warn_style as string) ?? "warning";
			return { content: c(theme, ctx.palette, colorKey, `${icon} ${pct}%`.trim()), visible: pct > 0 };
		}
		case "session": {
			const name = data.sessionName;
			if (!name) return { content: "", visible: false };
			const icon = ico("terminal", icons, segs) || "";
			const style = (seg as any).style ?? "session";
			return { content: c(theme, ctx.palette, style, `${icon} ${name}`.trim()), visible: true };
		}
		case "thinking": {
			const level = normalizeThinkingLevel(data.thinkingLevel);
			if (level === "off" && (seg as any).show_when_off === false) return { content: "", visible: false };
			const textSet = THINKING_TEXT[hasNerdFonts() ? "nerd" : "ascii"];
			const label = textSet[level] ?? level;
			const colorKey = THINKING_THEME[level] ?? "dim";
			const icon = ico("brain", icons, segs) || "";
			const showLabel = (seg as any).show_label === true;
			const content = showLabel ? `${icon} ${label}`.trim() : icon;
			return { content: c(theme, ctx.palette, colorKey, content), visible: !!content };
		}
		case "path":
		case "path1":
		case "path2":
		case "path3": {
			const cwd = data.cwd ?? "";
			const parts = cwd.split("/").filter(Boolean);
			const mode = ((seg as any).mode as string) ?? "truncated";
			const maxParts = ((seg as any).max_parts as number) ?? 3;
			const maxLength = ((seg as any).max_length as number) ?? 40;
			const prefix = ((seg as any).tilde as boolean) ? "~" : "";
			const sep = (seg as any).sep ?? "/";
			const style = (seg as any).style ?? "text";
			const icon = ico(id, icons, segs) || "";
			let pathStr = "";
			if (mode === "basename") {
				pathStr = parts[parts.length - 1] ?? "";
				if (pathStr && pathStr.length > maxLength) {
					pathStr = `${pathStr.slice(0, Math.max(1, maxLength - 1))}…`;
				}
			} else if (mode === "parent") {
				pathStr = parts[parts.length - 2] ?? "";
			} else {
				const displayed = parts.slice(-maxParts);
				pathStr = prefix + displayed.join(sep);
			}
			if (!pathStr) return { content: "", visible: false };
			let rendered = c(theme, ctx.palette, style, `${icon} ${pathStr}`.trim());
			if ((seg as any).bold === true) rendered = theme.bold(rendered);
			return { content: rendered, visible: true };
		}
		case "git": {
			const s = data.git;
			if (!s.branch) return { content: "", visible: false };
			const icon = ico("git", icons, segs) || "";
			const isDirty = s.staged > 0 || s.unstaged > 0 || s.untracked > 0;
			const branchStyle = isDirty
				? ((seg as any).dirty_branch_style as string) ?? "git_dirty"
				: ((seg as any).branch_style as string) ?? "git_clean";
			const parts = [c(theme, ctx.palette, branchStyle, `${icon} ${s.branch}`.trim())];
			if ((seg as any).show_staged !== false && s.staged > 0) {
				parts.push(c(theme, ctx.palette, ((seg as any).staged_style as string) ?? "git_staged", `+${s.staged}`));
			}
			if ((seg as any).show_unstaged !== false && s.unstaged > 0) {
				parts.push(c(theme, ctx.palette, ((seg as any).unstaged_style as string) ?? "git_unstaged", `~${s.unstaged}`));
			}
			if ((seg as any).show_untracked !== false && s.untracked > 0) {
				parts.push(c(theme, ctx.palette, ((seg as any).untracked_style as string) ?? "git_untracked", `?${s.untracked}`));
			}
			return { content: parts.join(" "), visible: true };
		}
		case "git_branch": {
			const branch = data.git.branch;
			if (!branch) return { content: "", visible: false };
			const icon = ico("git-branch", icons, segs) || "";
			const style = (seg as any).style ?? "git_clean";
			return { content: c(theme, ctx.palette, style, `${icon} ${branch}`.trim()), visible: true };
		}
		case "git_status": {
			if (!cachedGitStatus) {
				pendingGitStatus = pendingGitStatus ?? runGit(["status", "--porcelain"], 500).then((out) => {
					cachedGitStatus = parseGitPorcelain(out ?? "");
					cachedGitStatus.ts = Date.now();
					pendingGitStatus = null;
					invalidateGitBranch();
				});
			}
			const s = cachedGitStatus;
			if (!s || (s.staged === 0 && s.unstaged === 0 && s.untracked === 0)) return { content: "", visible: false };
			const icon = ico("git-status", icons, segs) || "";
			const parts: string[] = [];
			if (s.staged > 0) parts.push(c(theme, ctx.palette, ((seg as any).staged_style as string) ?? "git_staged", `+${s.staged}`));
			if (s.unstaged > 0) parts.push(c(theme, ctx.palette, ((seg as any).unstaged_style as string) ?? "git_unstaged", `~${s.unstaged}`));
			if (s.untracked > 0) parts.push(c(theme, ctx.palette, ((seg as any).untracked_style as string) ?? "git_untracked", `?${s.untracked}`));
			return { content: `${icon} ${parts.join(" ")}`, visible: true };
		}
		case "tools": {
			const iconStr = ico("tools", icons, segs) || "";
			const style = (seg as any).style ?? "tools";
			return { content: c(theme, ctx.palette, style, `${iconStr} ${data.toolsLoaded}`.trim()), visible: true };
		}
		case "context_total": {
			if (!data.contextWindow) return { content: "", visible: false };
			return { content: c(theme, ctx.palette, "context", formatCount(data.contextWindow)), visible: true };
		}
		default: {
			const style = (seg as any).style as string ?? "text";
			const icon = (seg as any).icon ? ico((seg as any).icon as string, icons, segs) : "";
			const text = (seg as any).text as string | undefined;
			if (!icon && !text) return { content: "", visible: false };
			return { content: theme.fg(style, `${icon}${text ?? ""}`), visible: true };
		}
	}
}

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
	const gap = "  ";
	const space = Math.max(0, inner - visibleWidth(left) - visibleWidth(right) - visibleWidth(gap));
	return ` ${truncateToWidth(left + gap + " ".repeat(space) + right, inner)} `;
}

// ═══════════════════════════════════════════════════════════════════════════
// Footer Layout
// ═══════════════════════════════════════════════════════════════════════════

function truncate(s: string, w: number): string {
	const n = visibleWidth(s);
	if (n <= w) return s;
	if (w < 1) return "";
	let out = "";
	let cw = 0;
	const clean = s.replace(/\x1b\[[0-9;]*m/g, "");
	for (const c of clean) {
		const cwc = c.charCodeAt(0) > 127 ? 2 : 1;
		if (cw + cwc > w - 1) break;
		out += c;
		cw += cwc;
	}
	return out + "…";
}

function setupFooter(ctx: ExtensionContext, pi: ExtensionAPI) {
	ctx.ui.setFooter((tui, theme, footerData) => {
		tuiRef = tui;
		const rerender = () => tui.requestRender();
		const branchUnsub = footerData.onBranchChange(rerender);
		return {
			dispose() {
				branchUnsub?.();
			},
			invalidate() {},
			render(width: number): string[] {
				const { palette, segs, userIcons, lines } = resolveConfig(loadConfig());
				const extensionStatuses = footerData.getExtensionStatuses();
				const renderCtx: RenderCtx = {
					theme,
					palette,
					segs,
					icons: userIcons,
					data: {
						cwd: process.cwd(),
						model: (ctx as any).model,
						thinkingLevel: normalizeThinkingLevel(pi.getThinkingLevel?.() ?? "off"),
						usageStats: getUsageStats(ctx),
						contextPercent: ctx.getContextUsage?.()?.percent ?? 0,
						contextWindow: Number((ctx as any).model?.contextWindow ?? 0),
						autoCompactEnabled: false,
						usingSubscription: false,
						git: getGitStatus(footerData.getGitBranch()),
						toolCounts,
						toolTotal,
						toolsLoaded,
						toolColors,
						sessionName: pi.getSessionName?.() ?? "",
						persona: readPersonaId(),
						extensionStatuses,
					},
				};
				const rendered = lines.map((l) => renderRow(l, renderCtx, width)).filter((l) => l.length > 0);
				const cfg = loadConfig();
				if (cfg?.show_extension_statuses !== false && extensionStatuses.size > 0) {
					const sorted = Array.from(extensionStatuses.entries())
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([, text]) => text.replace(/[\r\n\t]/g, " ").replace(/ +/g, " ").trim());
					const inner = Math.max(1, width - 2);
					const statusLine = theme.fg("dim", truncate(sorted.join(" "), inner));
					rendered.push(` ${statusLine} `);
				}
				return rendered.length > 0 ? rendered : [` ${" ".repeat(Math.max(0, width - 2))} `];
			},
		};
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════════════

let tuiRef: any = null;
let currentCtx: any = null;
let getThinkingLevel: (() => ThinkingLevel) | null = null;

function resetToolCounts() {
	for (const k of Object.keys(toolCounts)) delete toolCounts[k];
	for (const k of Object.keys(toolColors)) delete toolColors[k];
	toolTotal = 0;
	_colorIdx = 0;
	randomColorIdx = 0;
}

function assignToolColor(toolName: string, theme: Theme, segs: Record<string, SegCfg>) {
	if (toolColors[toolName]) return;
	const override = loadConfig()?.tool_colors?.[toolName];
	if (override) {
		toolColors[toolName] = override;
		return;
	}
	const builtin = BUILTIN_TOOL_THEME[toolName];
	if (builtin) {
		const c = themeTokenToPillBg(theme, builtin);
		if (c) {
			toolColors[toolName] = c;
			return;
		}
	}
	const palette = _getPillPalette(theme, segs);
	if (palette.length > 0) {
		toolColors[toolName] = palette[_colorIdx % palette.length] as `#${string}`;
		_colorIdx++;
		return;
	}
	toolColors[toolName] = RANDOM_COLOR_POOL[randomColorIdx % RANDOM_COLOR_POOL.length];
	randomColorIdx++;
}

function isGitBranchCmd(command: string): boolean {
	return /\bgit\s+(checkout|switch|branch|merge|rebase|pull)\b/.test(command);
}

function showAllSegs(ctx: ExtensionContext) {
	const { segs } = resolveConfig(loadConfig());
	ctx.ui.notify(`Segments: ${Object.keys(segs).join(", ")}`, "info");
}

// ═══════════════════════════════════════════════════════════════════════════
// Command Handlers
// ═══════════════════════════════════════════════════════════════════════════

function readPersona(_args: any, ctx: ExtensionContext): string {
	const name = ctx.sessionManager?.getSessionMeta?.()?.persona ?? "Assistant";
	return `Current persona: ${name}`;
}

function readSession(_args: any, ctx: ExtensionContext): string {
	const name = ctx.sessionName ?? "Unnamed";
	return `Session: ${name}`;
}


export default function pureStatusLine(pi: ExtensionAPI) {
	ensureConfig();

	pi.on("tool_execution_end", async (event) => {
		if (currentCtx?.theme) {
			const { segs } = resolveConfig(loadConfig());
			assignToolColor(event.toolName, currentCtx.theme, segs);
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
		if (ctx.hasUI) setupFooter(ctx, pi);
	});

	pi.on("tool_result", async (event) => {
		if (event.toolName === "write" || event.toolName === "edit") invalidateGit();
		if (event.toolName === "bash" && (event.input as any)?.command) {
			if (isGitBranchCmd(String((event.input as any).command))) {
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

	pi.on("file_edit", async () => {
		invalidateGit();
		for (const ms of [100, 300]) setTimeout(() => tuiRef?.requestRender(), ms);
	});

	pi.on("file_write", async () => {
		invalidateGit();
		for (const ms of [100, 300]) setTimeout(() => tuiRef?.requestRender(), ms);
	});

	pi.on("command", async (event, ctx) => {
		const cmd = event.command;
		const args = event.args ?? {};

		if (cmd === "pure-statusline" || cmd === "statusline" || cmd === "sl") {
			const a = (args._ ?? [])[0] as string;
			if (a === "show") {
				showAllSegs(ctx);
				ctx.ui.notify("Statusline segments shown", "info");
				return;
			}
			if (a === "reset-tools") {
				resetToolCounts();
				tuiRef?.requestRender();
				ctx.ui.notify("Tool counters reset", "info");
				return;
			}
			if (a?.startsWith("tools")) {
				const seg = a.slice(5) || "tool_stats";
				ctx.ui.notify(`Tool segment: ${seg}`, "info");
				return;
			}
			if (a === "edit") {
				const path = configPath();
				ctx.ui.notify(`Config: ${path}`, "info");
				return;
			}
			const cfg = loadConfig();
			ctx.ui.notify(`Statusline: ${cfg?.segments ? Object.keys(cfg.segments).length : 0} segs`, "info");
		}
	});

	pi.on("tui_ready", async (_event, ctx) => {
		tuiRef = ctx;
		if (ctx.hasUI) setupFooter(ctx, pi);
	});
}
