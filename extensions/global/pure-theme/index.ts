/**
 * Pure Theme Extension v2
 *
 * Auto-syncs Pi theme with system/terminal dark/light mode.
 *
 * Detection strategies (priority order):
 *   1. macOS: Event-driven JXA watcher + fs.watch() (instant, zero CPU)
 *   2. OSC 11: Terminal background color query via /dev/tty subprocess
 *   3. macOS: `defaults read -g AppleInterfaceStyle` (fallback)
 *   4. Linux: gsettings color-scheme / kdeglobals
 *   5. Terminal: $COLORFGBG env var
 *   6. Fallback: dark
 *
 * Commands:
 *   /theme           — open interactive theme selector
 *   /theme sync      — toggle sync on/off
 *   /theme status    — show current theme and sync status
 *   /theme dark      — switch to paired dark theme
 *   /theme light     — switch to paired light theme
 *   /theme refresh   — force redetect and apply
 *   /theme debug     — show detection trace
 *
 * Settings (in settings.json under `pure.theme`):
 *   - sync_on_start: boolean — auto-switch theme on startup (default: true)
 *   - light_theme: string   — theme name for light mode (default: auto-detect)
 *   - dark_theme: string    — theme name for dark mode (default: auto-detect)
 */

import { execFile, spawn } from "node:child_process";
import { existsSync, type FSWatcher, readdirSync, readFileSync, unlinkSync, watch, writeFileSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";

const execFileAsync = promisify(execFile);

// ─── Constants ───────────────────────────────────────────────────────

const LIGHT_KEYWORDS = ["latte", "light"];
const DARK_KEYWORDS = ["frappe", "macchiato", "mocha", "dark"];

const STATE_FILE = "/tmp/pi-macos-theme";
const STATE_DIR = "/tmp";
const STATE_FILE_NAME = "pi-macos-theme";
const PID_FILE = "/tmp/pi-macos-theme.pid";
const WATCH_RETRY_MS = 2000;
const RECONCILE_INTERVAL_MS = 30_000;
const DETECTION_TIMEOUT_MS = 3000;
const OSC11_QUERY_TIMEOUT_MS = 3500;
const OSC11_MIN_INTERVAL_MS = 4000;
const OSC11_DISABLE_AFTER_FAILURES = 3;
const OSC11_DISABLE_COOLDOWN_MS = 60_000;

// ─── Types ───────────────────────────────────────────────────────────

type Appearance = "dark" | "light";

interface ThemeSettings {
	sync_on_start: boolean;
	light_theme?: string;
	dark_theme?: string;
}

interface Osc11State {
	lastCheckedAt: number;
	lastAppearance: Appearance | null;
	failures: number;
	disabledUntil: number;
}

interface DetectionTrace {
	chosen: "jxa-watcher" | "osc11" | "osc11-cache" | "macos-defaults" | "linux" | "colorfgbg" | "fallback";
	appearance: Appearance;
	strategy: string;
	details: string;
}

const DEFAULT_SETTINGS: ThemeSettings = { sync_on_start: true };

// ─── Theme classification ────────────────────────────────────────────

function isLightTheme(name: string): boolean {
	const lower = name.toLowerCase();
	return LIGHT_KEYWORDS.some((k) => lower.includes(k));
}

function isDarkTheme(name: string): boolean {
	const lower = name.toLowerCase();
	return DARK_KEYWORDS.some((k) => lower.includes(k));
}

// ─── Settings helpers ────────────────────────────────────────────────

function loadSettings(): ThemeSettings {
	const settingsPath = join(getAgentDir(), "settings.json");
	if (!existsSync(settingsPath)) return { ...DEFAULT_SETTINGS };
	try {
		const raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
		const pure = raw?.pure?.theme;
		return {
			sync_on_start: typeof pure?.sync_on_start === "boolean" ? pure.sync_on_start : true,
			light_theme: typeof pure?.light_theme === "string" ? pure.light_theme : undefined,
			dark_theme: typeof pure?.dark_theme === "string" ? pure.dark_theme : undefined,
		};
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

function saveSettings(settings: ThemeSettings): void {
	const settingsPath = join(getAgentDir(), "settings.json");
	let raw: Record<string, unknown> = {};
	if (existsSync(settingsPath)) {
		try {
			raw = JSON.parse(readFileSync(settingsPath, "utf-8"));
		} catch {
			raw = {};
		}
	}
	if (!raw.pure) raw.pure = {};

	// Only store overrides — remove keys that match defaults
	const overrides: Record<string, unknown> = {};
	if (settings.sync_on_start !== DEFAULT_SETTINGS.sync_on_start) {
		overrides.sync_on_start = settings.sync_on_start;
	}
	if (settings.light_theme !== undefined) {
		overrides.light_theme = settings.light_theme;
	}
	if (settings.dark_theme !== undefined) {
		overrides.dark_theme = settings.dark_theme;
	}

	if (Object.keys(overrides).length === 0) {
		// All defaults — remove the section entirely
		delete (raw.pure as Record<string, unknown>).theme;
		// Remove pure section if empty
		if (Object.keys(raw.pure as Record<string, unknown>).length === 0) {
			delete raw.pure;
		}
	} else {
		(raw.pure as Record<string, unknown>).theme = overrides;
	}

	writeFileSync(settingsPath, `${JSON.stringify(raw, null, 2)}\n`, "utf-8");
}

// ─── Platform helpers ────────────────────────────────────────────────

function isMacOS(): boolean {
	return process.platform === "darwin";
}

function isLinux(): boolean {
	return process.platform === "linux";
}

function isGhosttyIDE(): boolean {
	return Boolean(process.env.GHOSTTY_AGENT_PORT);
}

// ─── Strategy 1: macOS JXA watcher (event-driven) ───────────────────

const JXA_WATCHER = `
ObjC.import('Cocoa');
ObjC.import('Foundation');

var stateFile = "${STATE_FILE}";

function isDark() {
	var style = $.NSUserDefaults.standardUserDefaults
		.stringForKey('AppleInterfaceStyle');
	return (style && style.js === 'Dark');
}

function writeState() {
	var state = isDark() ? 'dark' : 'light';
	var str = $.NSString.alloc.initWithUTF8String(state);
	str.writeToFileAtomicallyEncodingError(
		stateFile, true, $.NSUTF8StringEncoding, null
	);
}

writeState();

ObjC.registerSubclass({
	name: 'PiThemeWatcher' + $.NSProcessInfo.processInfo.processIdentifier,
	methods: {
		'themeChanged:': {
			types: ['void', ['id']],
			implementation: function(notification) {
				writeState();
			}
		}
	}
});

var className = 'PiThemeWatcher' + $.NSProcessInfo.processInfo.processIdentifier;
var handler = $.NSClassFromString(className).new;
$.NSDistributedNotificationCenter.defaultCenter
	.addObserverSelectorNameObject(
		handler,
		'themeChanged:',
		'AppleInterfaceThemeChangedNotification',
		$.nil
	);

var runLoop = $.NSRunLoop.currentRunLoop;
while (true) {
	runLoop.runModeBeforeDate(
		$.NSDefaultRunLoopMode,
		$.NSDate.dateWithTimeIntervalSinceNow(60.0)
	);
}
`;

function isProcessAlive(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

function getRunningWatcherPid(): number | null {
	try {
		const pidStr = readFileSync(PID_FILE, "utf-8").trim();
		const pid = Number.parseInt(pidStr, 10);
		if (!Number.isNaN(pid) && isProcessAlive(pid)) {
			return pid;
		}
		try {
			unlinkSync(PID_FILE);
		} catch {
			// best effort
		}
	} catch {
		// no pid file
	}
	return null;
}

function ensureWatcherRunning(): void {
	if (getRunningWatcherPid() !== null) return;

	const child = spawn("osascript", ["-l", "JavaScript", "-e", JXA_WATCHER], {
		detached: true,
		stdio: "ignore",
	});
	child.unref();

	if (child.pid) {
		try {
			writeFileSync(PID_FILE, `${child.pid}\n`, "utf-8");
		} catch {
			// best effort
		}
	}
}

function readStateFile(): Appearance | null {
	try {
		const content = readFileSync(STATE_FILE, "utf-8").trim();
		if (content === "dark" || content === "light") return content;
	} catch {
		// file missing
	}
	return null;
}

// ─── Strategy 2: OSC 11 terminal background query ───────────────────

const OSC11_QUERY_SCRIPT = `
'use strict';
const fs = require('fs');
const tty = require('tty');

const O_NONBLOCK = fs.constants.O_NONBLOCK ?? 0;
let fd;
try { fd = fs.openSync('/dev/tty', fs.constants.O_RDWR | fs.constants.O_NOCTTY | O_NONBLOCK); }
catch { process.exit(1); }

let ttyIn = null;
try {
	ttyIn = new tty.ReadStream(fd);
	if (ttyIn.isTTY) ttyIn.setRawMode(true);
} catch {}

function cleanup() {
	try { if (ttyIn && ttyIn.isTTY) ttyIn.setRawMode(false); } catch {}
	try { fs.closeSync(fd); } catch {}
}

try { fs.writeSync(fd, '\\x1b]11;?\\x07'); }
catch { cleanup(); process.exit(1); }

const buf = Buffer.alloc(1024);
let response = '';
const deadline = Date.now() + 2500;

function tryRead() {
	while (true) {
		try {
			const n = fs.readSync(fd, buf, 0, buf.length, null);
			if (n <= 0) return;
			response += buf.toString('utf8', 0, n);
			if (response.length > 8192) response = response.slice(-4096);
		} catch (err) {
			const code = err && err.code;
			if (code === 'EAGAIN' || code === 'EWOULDBLOCK') return;
			return;
		}
	}
}

function to8Bit(hex) {
	if (!hex) return 0;
	const h = String(hex);
	if (h.length <= 2) return parseInt(h.padEnd(2, h[h.length - 1] || '0'), 16);
	return parseInt(h.slice(0, 2), 16);
}

function done() {
	cleanup();
	const m = response.match(/rgb:([0-9a-fA-F]{2,8})\\/([0-9a-fA-F]{2,8})\\/([0-9a-fA-F]{2,8})/);
	if (m) {
		const r = to8Bit(m[1]);
		const g = to8Bit(m[2]);
		const b = to8Bit(m[3]);
		const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
		process.stdout.write(luminance < 128 ? 'dark' : 'light');
	}
	process.exit(0);
}

function poll() {
	tryRead();
	if (response.includes('rgb:') || Date.now() > deadline) return done();
	setTimeout(poll, 16);
}

poll();
`;

function queryTerminalBackground(): Promise<Appearance | null> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			child.kill();
			resolve(null);
		}, OSC11_QUERY_TIMEOUT_MS + 300);

		const child = spawn(process.execPath, ["-e", OSC11_QUERY_SCRIPT], {
			stdio: ["ignore", "pipe", "ignore"],
			timeout: OSC11_QUERY_TIMEOUT_MS + 300,
		});

		let stdout = "";
		child.stdout!.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.on("close", () => {
			clearTimeout(timer);
			const trimmed = stdout.trim();
			if (trimmed === "dark" || trimmed === "light") {
				resolve(trimmed);
			} else {
				resolve(null);
			}
		});

		child.on("error", () => {
			clearTimeout(timer);
			resolve(null);
		});
	});
}

// ─── Strategy 3: macOS defaults fallback ─────────────────────────────

async function detectMacAppearance(): Promise<Appearance | null> {
	try {
		const { stdout } = await execFileAsync("/usr/bin/defaults", ["read", "-g", "AppleInterfaceStyle"], {
			timeout: DETECTION_TIMEOUT_MS,
		});
		const value = stdout.trim().toLowerCase();
		return value === "dark" ? "dark" : null;
	} catch (error) {
		const stderr = typeof error === "object" && error !== null ? ((error as { stderr?: string }).stderr ?? "") : "";
		if (stderr.toLowerCase().includes("does not exist")) {
			return "light";
		}
		return null;
	}
}

// ─── Strategy 4: Linux detection ─────────────────────────────────────

async function detectLinuxAppearance(): Promise<Appearance | null> {
	try {
		const { stdout } = await execFileAsync("gsettings", ["get", "org.gnome.desktop.interface", "color-scheme"], {
			timeout: DETECTION_TIMEOUT_MS,
		});
		const value = stdout.trim().toLowerCase().replace(/['"]/g, "");
		if (value === "prefer-dark") return "dark";
		if (value === "prefer-light") return "light";
	} catch {
		// fall through
	}

	// KDE: read kdeglobals
	try {
		const kdeConfig = readFileSync(join(process.env.HOME || "~", ".config", "kdeglobals"), "utf-8");
		if (kdeConfig.toLowerCase().includes("dark")) return "dark";
	} catch {
		// fall through
	}

	return null;
}

// ─── Strategy 5: $COLORFGBG env var ──────────────────────────────────

function detectColorFGBG(): Appearance | null {
	const colorfgbg = process.env.COLORFGBG;
	if (!colorfgbg) return null;
	const parts = colorfgbg.split(";");
	const bg = Number.parseInt(parts[parts.length - 1], 10);
	if (Number.isNaN(bg)) return null;
	return bg <= 7 ? "dark" : "light";
}

// ─── Unified detection ──────────────────────────────────────────────

async function resolveAppearance(
	osc11State: Osc11State,
	options?: { allowOsc11?: boolean; forceOsc11?: boolean; allowOsc11Cache?: boolean },
): Promise<DetectionTrace> {
	const trace: DetectionTrace = {
		chosen: "fallback",
		appearance: "dark",
		strategy: "fallback",
		details: "No other strategy succeeded",
	};

	// 1. macOS: JXA watcher state file (event-driven, instant)
	if (isMacOS()) {
		const state = readStateFile();
		if (state) {
			return {
				chosen: "jxa-watcher",
				appearance: state,
				strategy: "JXA watcher",
				details: `State file: ${state}`,
			};
		}
	}

	// 2. OSC 11 terminal background query
	const forceOsc11 = options?.forceOsc11 === true;
	const allowOsc11 = forceOsc11 || options?.allowOsc11 === true;
	const allowOsc11Cache = options?.allowOsc11Cache !== false;

	if (allowOsc11) {
		const now = Date.now();
		const canProbe =
			now >= osc11State.disabledUntil && (forceOsc11 || now - osc11State.lastCheckedAt >= OSC11_MIN_INTERVAL_MS);

		if (canProbe) {
			osc11State.lastCheckedAt = now;
			const fromTerminal = await queryTerminalBackground();
			if (fromTerminal) {
				osc11State.lastAppearance = fromTerminal;
				osc11State.failures = 0;
				return {
					chosen: "osc11",
					appearance: fromTerminal,
					strategy: "OSC 11",
					details: `Terminal background: ${fromTerminal}`,
				};
			}
			osc11State.failures += 1;
			if (osc11State.failures >= OSC11_DISABLE_AFTER_FAILURES) {
				osc11State.disabledUntil = now + OSC11_DISABLE_COOLDOWN_MS;
				osc11State.failures = 0;
			}
		}

		// OSC 11 cache fallback
		if (allowOsc11Cache && osc11State.lastAppearance) {
			return {
				chosen: "osc11-cache",
				appearance: osc11State.lastAppearance,
				strategy: "OSC 11 (cached)",
				details: `Cached: ${osc11State.lastAppearance}`,
			};
		}
	}

	// 3. macOS: defaults read fallback
	if (isMacOS()) {
		const macResult = await detectMacAppearance();
		if (macResult) {
			return {
				chosen: "macos-defaults",
				appearance: macResult,
				strategy: "macOS defaults",
				details: `AppleInterfaceStyle: ${macResult}`,
			};
		}
	}

	// 4. Linux detection
	if (isLinux()) {
		const linuxResult = await detectLinuxAppearance();
		if (linuxResult) {
			return {
				chosen: "linux",
				appearance: linuxResult,
				strategy: "Linux",
				details: `gsettings/kdeglobals: ${linuxResult}`,
			};
		}
	}

	// 5. $COLORFGBG
	const colorResult = detectColorFGBG();
	if (colorResult) {
		return {
			chosen: "colorfgbg",
			appearance: colorResult,
			strategy: "$COLORFGBG",
			details: `bg value → ${colorResult}`,
		};
	}

	// 6. Fallback: dark
	return trace;
}

// ─── Theme discovery ─────────────────────────────────────────────────

function discoverLocalThemes(): Array<{ name: string; path: string }> {
	const themesDir = join(getAgentDir(), "themes");
	const themes: Array<{ name: string; path: string }> = [];

	if (!existsSync(themesDir)) return themes;

	try {
		const files = readdirSync(themesDir);
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const fullPath = join(themesDir, file);
			try {
				const content = JSON.parse(readFileSync(fullPath, "utf-8"));
				if (content.name) {
					themes.push({ name: content.name, path: fullPath });
				}
			} catch {
				// Skip invalid JSON
			}
		}
	} catch {
		// No themes found
	}

	return themes;
}

// ─── Theme matching ──────────────────────────────────────────────────

function findBestTheme(themes: Array<{ name: string }>, dark: boolean, settings: ThemeSettings): string | null {
	// Prefer explicit user choice
	const explicit = dark ? settings.dark_theme : settings.light_theme;
	if (explicit && themes.some((t) => t.name === explicit)) {
		return explicit;
	}

	// Fallback: keyword heuristics
	const keywords = dark ? DARK_KEYWORDS : LIGHT_KEYWORDS;
	const antiKeywords = dark ? LIGHT_KEYWORDS : DARK_KEYWORDS;

	for (const t of themes) {
		const lower = t.name.toLowerCase();
		if (keywords.some((k) => lower.includes(k)) && !antiKeywords.some((k) => lower.includes(k))) {
			return t.name;
		}
	}
	for (const t of themes) {
		const lower = t.name.toLowerCase();
		if (keywords.some((k) => lower.includes(k))) {
			return t.name;
		}
	}

	return null;
}

// ─── Theme selector UI ───────────────────────────────────────────────

async function showThemeSelector(
	ctx: ExtensionContext,
	_pi: ExtensionAPI,
	settings: ThemeSettings,
	osc11State: Osc11State,
	onSyncToggle: () => void,
): Promise<void> {
	const allThemes = ctx.ui.getAllThemes();
	const localThemes = discoverLocalThemes();
	const localNames = new Set(localThemes.map((t) => t.name));

	const themeEntries: Array<{
		name: string;
		isLocal: boolean;
		isDark: boolean;
		isLight: boolean;
	}> = [];

	for (const t of allThemes) {
		if (!localNames.has(t.name)) {
			themeEntries.push({
				name: t.name,
				isLocal: false,
				isDark: isDarkTheme(t.name),
				isLight: isLightTheme(t.name),
			});
		}
	}
	for (const t of localThemes) {
		themeEntries.push({
			name: t.name,
			isLocal: true,
			isDark: isDarkTheme(t.name),
			isLight: isLightTheme(t.name),
		});
	}

	const items: SelectItem[] = themeEntries.map((t) => {
		const badges: string[] = [];
		if (t.isLocal) badges.push("local");
		if (t.isDark) badges.push("dark");
		if (t.isLight) badges.push("light");
		if (t.name === settings.light_theme) badges.push("★ light pair");
		if (t.name === settings.dark_theme) badges.push("★ dark pair");
		const desc = badges.length > 0 ? badges.join(", ") : "built-in";
		return { value: t.name, label: t.name, description: desc };
	});

	items.push({ value: "---", label: "───────────────────", description: "" });
	items.push({
		value: "set:light",
		label: `Light theme: ${settings.light_theme ?? "auto"}`,
		description: "Theme to use when system is in light mode",
	});
	items.push({
		value: "set:dark",
		label: `Dark theme: ${settings.dark_theme ?? "auto"}`,
		description: "Theme to use when system is in dark mode",
	});
	items.push({
		value: "sync:toggle",
		label: `Sync on start: ${settings.sync_on_start ? "ON" : "OFF"}`,
		description: "Auto-switch theme based on system dark/light mode",
	});

	// Detect current appearance for display
	const currentTrace = await resolveAppearance(osc11State, { allowOsc11: true, forceOsc11: false });
	const modeLabel = `${currentTrace.appearance} (${currentTrace.strategy})`;

	const result = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
		const container = new Container();
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
		container.addChild(new Text(theme.fg("accent", theme.bold("Theme Selector"))));
		container.addChild(new Text(theme.fg("muted", `Detected: ${modeLabel}`)));
		container.addChild(new Text(""));

		const selectList = new SelectList(items, Math.min(items.length, 12), {
			selectedPrefix: (text) => theme.fg("accent", text),
			selectedText: (text) => theme.fg("accent", text),
			description: (text) => theme.fg("muted", text),
			scrollInfo: (text) => theme.fg("dim", text),
			noMatch: (text) => theme.fg("warning", text),
		});

		selectList.onSelect = (item) => done(item.value);
		selectList.onCancel = () => done(null);

		container.addChild(selectList);
		container.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
		container.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

		return {
			render(width: number) {
				return container.render(width);
			},
			invalidate() {
				container.invalidate();
			},
			handleInput(data: string) {
				selectList.handleInput(data);
				tui.requestRender();
			},
		};
	});

	if (!result || result === "---") return;

	if (result === "set:light" || result === "set:dark") {
		const isDark = result === "set:dark";
		const pickItems: SelectItem[] = themeEntries.map((t) => ({
			value: t.name,
			label: t.name,
			description: isDark ? (isDarkTheme(t.name) ? "dark" : "") : isLightTheme(t.name) ? "light" : "",
		}));
		pickItems.push({ value: "", label: "auto", description: "Detect by keyword heuristics" });

		const picked = await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
			const c = new Container();
			c.addChild(new DynamicBorder((str) => theme.fg("accent", str)));
			c.addChild(new Text(theme.fg("accent", theme.bold(isDark ? "Select Dark Theme" : "Select Light Theme"))));
			c.addChild(new Text(""));

			const sl = new SelectList(pickItems, Math.min(pickItems.length, 10), {
				selectedPrefix: (text) => theme.fg("accent", text),
				selectedText: (text) => theme.fg("accent", text),
				description: (text) => theme.fg("muted", text),
				scrollInfo: (text) => theme.fg("dim", text),
				noMatch: (text) => theme.fg("warning", text),
			});
			sl.onSelect = (item) => done(item.value);
			sl.onCancel = () => done(null);

			c.addChild(sl);
			c.addChild(new Text(theme.fg("dim", "↑↓ navigate • enter select • esc cancel")));
			c.addChild(new DynamicBorder((str) => theme.fg("accent", str)));

			return {
				render(width: number) {
					return c.render(width);
				},
				invalidate() {
					c.invalidate();
				},
				handleInput(data: string) {
					sl.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (picked !== null) {
			if (isDark) settings.dark_theme = picked || undefined;
			else settings.light_theme = picked || undefined;
			saveSettings(settings);
			ctx.ui.notify(`${isDark ? "Dark" : "Light"} theme: ${picked || "auto"}`, "info");
		}
		return;
	}

	if (result === "sync:toggle") {
		settings.sync_on_start = !settings.sync_on_start;
		saveSettings(settings);
		ctx.ui.notify(`Sync on start: ${settings.sync_on_start ? "ON" : "OFF"}`, "info");
		onSyncToggle();
		return;
	}

	// Switch to selected theme
	const setResult = ctx.ui.setTheme(result);
	if ("success" in setResult && !setResult.success) {
		ctx.ui.notify(`Failed to set theme: ${(setResult as { error?: string }).error ?? "unknown"}`, "error");
	} else {
		ctx.ui.notify(`Theme: ${result}`, "info");
	}
}

// ─── Status bar ──────────────────────────────────────────────────────

function updateStatus(ctx: ExtensionContext, trace: DetectionTrace | null, settings: ThemeSettings): void {
	if (!settings.sync_on_start) {
		ctx.ui.setStatus("pure-theme", undefined);
		return;
	}
	const icon = trace?.appearance === "light" ? "☀" : "🌙";
	const strategy = trace ? trace.strategy : "?";
	ctx.ui.setStatus("pure-theme", ctx.ui.theme.fg("dim", ` ${icon} ${strategy}`));
}

// ─── Extension entry point ───────────────────────────────────────────

export default function pureThemeExtension(pi: ExtensionAPI) {
	let fileWatcher: FSWatcher | null = null;
	let watchRetryTimer: ReturnType<typeof setTimeout> | null = null;
	let reconcileTimer: ReturnType<typeof setInterval> | null = null;
	let syncInProgress = false;
	let lastAppliedAppearance: Appearance | null = null;
	let lastTrace: DetectionTrace | null = null;

	const settings = loadSettings();
	const osc11State: Osc11State = {
		lastCheckedAt: 0,
		lastAppearance: null,
		failures: 0,
		disabledUntil: 0,
	};

	// ── Sync logic ──

	async function syncTheme(ctx: ExtensionContext, force = false): Promise<void> {
		if (!ctx.hasUI) return;
		if (ctx.ui.getAllThemes().length === 0) return;
		if (!settings.sync_on_start && !force) return;
		if (syncInProgress) return;

		syncInProgress = true;
		try {
			const trace = await resolveAppearance(osc11State, { allowOsc11: true });
			lastTrace = trace;

			if (!force && trace.appearance === lastAppliedAppearance) return;

			const allThemes = ctx.ui.getAllThemes();
			const target = findBestTheme(allThemes, trace.appearance === "dark", settings);
			if (!target) return;

			if (ctx.ui.theme.name === target && !force) {
				lastAppliedAppearance = trace.appearance;
				return;
			}

			const result = ctx.ui.setTheme(target);
			if ("success" in result && !result.success) {
				// silently ignore
			} else {
				lastAppliedAppearance = trace.appearance;
			}

			updateStatus(ctx, trace, settings);
		} finally {
			syncInProgress = false;
		}
	}

	// ── macOS: fs.watch() on state file ──

	function stopFileWatcher(): void {
		if (fileWatcher) {
			fileWatcher.close();
			fileWatcher = null;
		}
	}

	function clearRetryTimer(): void {
		if (watchRetryTimer) {
			clearTimeout(watchRetryTimer);
			watchRetryTimer = null;
		}
	}

	function startFileWatcher(ctx: ExtensionContext): void {
		stopFileWatcher();

		try {
			fileWatcher = watch(STATE_DIR, (_eventType, filename) => {
				if (!filename || filename !== STATE_FILE_NAME) return;
				void syncTheme(ctx);
			});

			fileWatcher.on("error", () => {
				stopFileWatcher();
				scheduleWatchRetry(ctx);
			});
		} catch {
			scheduleWatchRetry(ctx);
		}
	}

	function scheduleWatchRetry(ctx: ExtensionContext): void {
		clearRetryTimer();
		watchRetryTimer = setTimeout(() => {
			watchRetryTimer = null;
			ensureWatcherRunning();
			startFileWatcher(ctx);
		}, WATCH_RETRY_MS);
	}

	// ── Reconciliation timer (safety net) ──

	function startReconcileTimer(ctx: ExtensionContext): void {
		stopReconcileTimer();
		reconcileTimer = setInterval(() => {
			void syncTheme(ctx, true);
		}, RECONCILE_INTERVAL_MS);
	}

	function stopReconcileTimer(): void {
		if (reconcileTimer) {
			clearInterval(reconcileTimer);
			reconcileTimer = null;
		}
	}

	// ── /theme command ──

	pi.registerCommand("theme", {
		description: "Select theme or toggle dark/light sync",
		getArgumentCompletions: (prefix: string) => {
			const subcommands = ["sync", "status", "dark", "light", "refresh", "debug"];
			const filtered = subcommands.filter((s) => s.startsWith(prefix));
			return filtered.length > 0 ? filtered.map((s) => ({ value: s, label: s })) : null;
		},
		handler: async (args, ctx) => {
			if (!ctx.hasUI) return;
			const arg = args?.trim().toLowerCase();

			if (arg === "sync") {
				settings.sync_on_start = !settings.sync_on_start;
				saveSettings(settings);
				ctx.ui.notify(`Sync on start: ${settings.sync_on_start ? "ON" : "OFF"}`, "info");
				if (settings.sync_on_start) {
					await syncTheme(ctx, true);
				}
				updateStatus(ctx, lastTrace, settings);
				return;
			}

			if (arg === "status") {
				const trace = await resolveAppearance(osc11State, { allowOsc11: true, forceOsc11: false });
				const allThemes = ctx.ui.getAllThemes();
				const best = findBestTheme(allThemes, trace.appearance === "dark", settings);
				ctx.ui.notify(
					`Appearance: ${trace.appearance} • Strategy: ${trace.strategy} • Best match: ${best ?? "none"} • Sync: ${settings.sync_on_start ? "ON" : "OFF"}`,
					"info",
				);
				return;
			}

			if (arg === "dark") {
				const allThemes = ctx.ui.getAllThemes();
				const target = findBestTheme(allThemes, true, settings);
				if (target) {
					ctx.ui.setTheme(target);
					ctx.ui.notify(`Theme: ${target}`, "info");
				} else {
					ctx.ui.notify("No dark theme found", "warning");
				}
				return;
			}

			if (arg === "light") {
				const allThemes = ctx.ui.getAllThemes();
				const target = findBestTheme(allThemes, false, settings);
				if (target) {
					ctx.ui.setTheme(target);
					ctx.ui.notify(`Theme: ${target}`, "info");
				} else {
					ctx.ui.notify("No light theme found", "warning");
				}
				return;
			}

			if (arg === "refresh") {
				// Force immediate redetection
				lastAppliedAppearance = null;
				osc11State.disabledUntil = 0;
				await syncTheme(ctx, true);
				if (lastTrace) {
					ctx.ui.notify(`Refreshed: ${lastTrace.appearance} (${lastTrace.strategy}) → applied`, "info");
				} else {
					ctx.ui.notify("Refresh: could not detect appearance", "warning");
				}
				return;
			}

			if (arg === "debug") {
				const trace = await resolveAppearance(osc11State, { forceOsc11: true });
				const allThemes = ctx.ui.getAllThemes();
				const target = findBestTheme(allThemes, trace.appearance === "dark", settings);
				const lines = [
					`Chosen strategy: ${trace.chosen}`,
					`Appearance: ${trace.appearance}`,
					`Details: ${trace.details}`,
					`OSC11: enabled=${true} failures=${osc11State.failures} disabledUntil=${osc11State.disabledUntil ? new Date(osc11State.disabledUntil).toISOString() : "none"}`,
					`OSC11 cache: ${osc11State.lastAppearance ?? "none"}`,
					`JXA watcher: ${isMacOS() ? (getRunningWatcherPid() !== null ? `running (pid ${getRunningWatcherPid()})` : "not running") : "n/a (not macOS)"}`,
					`JXA state file: ${readStateFile() ?? "missing"}`,
					`Target theme: ${target ?? "none"}`,
					`Current theme: ${ctx.ui.theme.name ?? "unknown"}`,
					`Platform: ${process.platform}`,
					`Ghostty IDE: ${isGhosttyIDE()}`,
					`$COLORFGBG: ${process.env.COLORFGBG ?? "not set"}`,
					`Sync on start: ${settings.sync_on_start}`,
				];
				ctx.ui.notify(lines.join("\n"), "info");
				return;
			}

			// No arg: show selector
			await showThemeSelector(ctx, pi, settings, osc11State, () => {
				updateStatus(ctx, lastTrace, settings);
				if (settings.sync_on_start) {
					void syncTheme(ctx, true);
				}
			});
		},
	});

	// ── Lifecycle ──

	pi.on("session_start", async (_event, ctx) => {
		if (!ctx.hasUI) return;
		if (isGhosttyIDE()) return;

		// macOS: start event-driven watcher
		if (isMacOS()) {
			ensureWatcherRunning();
			startFileWatcher(ctx);
			startReconcileTimer(ctx);
		}

		if (settings.sync_on_start) {
			// Small delay to let pi fully load themes
			setTimeout(() => {
				void syncTheme(ctx, true);
			}, 500);
		}
	});

	pi.on("session_shutdown", () => {
		clearRetryTimer();
		stopReconcileTimer();
		stopFileWatcher();
		// Don't kill the JXA watcher — other sessions may use it
	});
}
