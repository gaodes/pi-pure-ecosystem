/**
 * pi-pure-cron — A pi extension for scheduling agent prompts
 *
 * Provides:
 * - A `pure_cron` tool for managing scheduled prompts
 * - A widget displaying all scheduled prompts with status
 * - /cron command for interactive management
 * - Persistence via ~/.pi/agent/pure/config/pure-cron.json
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { DynamicBorder, getAgentDir } from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Spacer, Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";
import { Cron } from "croner";
import { nanoid } from "nanoid";

// ── Path helpers (self-contained, no external deps) ─────────────────────────

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const root = scope === "project" ? path.join(cwd ?? process.cwd(), ".pi", "pure") : path.join(getAgentDir(), "pure");
	const dir = path.join(root, category);
	if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
	return { dir, file: path.join(dir, filename) };
}

function migrateIfNeeded(filename: string, oldGlobalPath: string, newCategory: "config" | "cache"): void {
	if (!fs.existsSync(oldGlobalPath)) return;
	const newPath = getPurePath(filename, newCategory, "global");
	if (fs.existsSync(newPath.file)) {
		try {
			fs.unlinkSync(oldGlobalPath);
		} catch {}
		return;
	}
	if (!fs.existsSync(newPath.dir)) fs.mkdirSync(newPath.dir, { recursive: true });
	try {
		fs.renameSync(oldGlobalPath, newPath.file);
	} catch {
		try {
			const content = fs.readFileSync(oldGlobalPath, "utf-8");
			fs.writeFileSync(newPath.file, content, "utf-8");
			fs.unlinkSync(oldGlobalPath);
		} catch {}
	}
}

const OLD_CRON_PATH = path.join(os.homedir(), ".pi", "agent", "pure-cron.json");

// ─── Types ──────────────────────────────────────────────────────────────────

type CronJobType = "cron" | "once" | "interval";
type JobScope = "project" | "session" | "all";
type CronJobStatus = "success" | "error" | "running";

interface CronJob {
	id: string;
	name: string;
	schedule: string;
	prompt: string;
	enabled: boolean;
	type: CronJobType;
	intervalMs?: number;
	createdAt: string;
	lastRun?: string;
	lastStatus?: CronJobStatus;
	nextRun?: string;
	runCount: number;
	description?: string;
	/** Human-readable session name, set when the job is created */
	sessionName: string | null;
	/** Project path (cwd) when the job was created */
	projectPath: string | null;
}

interface CronStore {
	jobs: CronJob[];
	version: number;
}

interface CronToolDetails {
	action: string;
	jobs: CronJob[];
	error?: string;
	jobId?: string;
	jobName?: string;
}

interface CronChangeEvent {
	type: "add" | "remove" | "update" | "fire" | "error";
	job?: CronJob;
	jobId?: string;
	error?: string;
}

const CronToolParams = Type.Object({
	action: StringEnum(["add", "remove", "list", "enable", "disable", "update", "cleanup"], {
		description: "Action to perform",
	}),
	name: Type.Optional(Type.String({ description: "Job name, auto-generated if omitted" })),
	schedule: Type.Optional(
		Type.String({
			description: "Required for add. Cron expression, ISO timestamp, relative time (+10s, +5m), or interval string",
		}),
	),
	prompt: Type.Optional(Type.String({ description: "Required for add. The prompt text to execute" })),
	jobId: Type.Optional(Type.String({ description: "Job ID for remove, enable, disable, or update actions" })),
	type: Type.Optional(
		StringEnum(["cron", "once", "interval"], {
			description: "Job type. Use 'once' for relative times like '+10s'. Default is cron",
		}),
	),
	description: Type.Optional(Type.String({ description: "Optional job description" })),
	scope: Type.Optional(
		StringEnum(["project", "session", "all"], {
			description:
				"Scope for listing jobs. 'project' = current project, 'session' = current session, 'all' = everything. Default: all",
		}),
	),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatLocalTime(iso: string): string {
	const d = new Date(iso);
	const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
	const month = months[d.getMonth()];
	const day = d.getDate();
	const h = d.getHours().toString().padStart(2, "0");
	const m = d.getMinutes().toString().padStart(2, "0");
	const s = d.getSeconds().toString().padStart(2, "0");
	return `${month} ${day} ${h}:${m}:${s}`;
}

function formatSchedule(job: { type: string; schedule: string }): string {
	if (job.type === "once" && job.schedule.includes("T")) {
		return formatLocalTime(job.schedule);
	}
	return job.schedule;
}

function formatRelativeTime(date: Date | string): string {
	const now = Date.now();
	const target = typeof date === "string" ? new Date(date).getTime() : date.getTime();
	const diff = target - now;
	const absDiff = Math.abs(diff);

	const seconds = Math.floor(absDiff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	let timeStr: string;
	if (days > 0) timeStr = `${days}d`;
	else if (hours > 0) timeStr = `${hours}h`;
	else if (minutes > 0) timeStr = `${minutes}m`;
	else timeStr = `${seconds}s`;

	return diff > 0 ? `in ${timeStr}` : `${timeStr} ago`;
}

function humanizeCron(expression: string): string {
	const patterns: Record<string, string> = {
		"* * * * * *": "every second",
		"0 * * * * *": "every minute",
		"0 */5 * * * *": "every 5 min",
		"0 */10 * * * *": "every 10 min",
		"0 */15 * * * *": "every 15 min",
		"0 */30 * * * *": "every 30 min",
		"0 0 * * * *": "every hour",
		"0 0 */2 * * *": "every 2 hours",
		"0 0 */3 * * *": "every 3 hours",
		"0 0 */6 * * *": "every 6 hours",
		"0 0 0 * * *": "daily",
		"0 0 0 * * 0": "weekly",
		"0 0 0 1 * *": "monthly",
		"0 0 9 * * 1-5": "9am weekdays",
		"0 0 0 * * 1-5": "weekdays",
		"0 0 0 * * 0,6": "weekends",
	};

	const normalized = expression.trim();
	if (patterns[normalized]) return patterns[normalized];

	const match = normalized.match(/^0 \*\/(\d+) \* \* \* \*$/);
	if (match) return `every ${match[1]} min`;

	const hourMatch = normalized.match(/^0 0 \*\/(\d+) \* \* \*$/);
	if (hourMatch) return `every ${hourMatch[1]}h`;

	const timeMatch = normalized.match(/^0 0 (\d+) \* \* \*$/);
	if (timeMatch) {
		const hour = parseInt(timeMatch[1], 10);
		return `daily at ${hour}:00`;
	}

	return normalized.length > 15 ? `${normalized.substring(0, 12)}...` : normalized;
}

function formatISOShort(iso: string): string {
	try {
		const date = new Date(iso);
		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = months[date.getMonth()];
		const day = date.getDate();
		const hours = date.getHours().toString().padStart(2, "0");
		const minutes = date.getMinutes().toString().padStart(2, "0");
		return `${month} ${day} ${hours}:${minutes}`;
	} catch {
		return iso.length > 18 ? `${iso.substring(0, 15)}...` : iso;
	}
}

function validateCronExpression(expression: string): { valid: boolean; error?: string } {
	const fields = expression.trim().split(/\s+/);
	if (fields.length !== 6) {
		return {
			valid: false,
			error: `Cron expression must have 6 fields (second minute hour dom month dow), got ${fields.length}. Example: "0 * * * * *" for every minute`,
		};
	}
	try {
		new Cron(expression, () => {});
		return { valid: true };
	} catch (error) {
		return {
			valid: false,
			error: error instanceof Error ? error.message : "Invalid cron expression",
		};
	}
}

function parseRelativeTime(delta: string): string | null {
	const match = delta.match(/^\+(\d+)(s|m|h|d)$/);
	if (!match) return null;
	const value = parseInt(match[1], 10);
	const unit = match[2];
	const msMap: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
	return new Date(Date.now() + value * msMap[unit]).toISOString();
}

function parseInterval(interval: string): number | null {
	const match = interval.match(/^(\d+)(s|m|h|d)$/);
	if (!match) return null;
	const value = parseInt(match[1], 10);
	const unit = match[2];
	const multipliers: Record<string, number> = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
	return value * multipliers[unit];
}

// ─── Storage ────────────────────────────────────────────────────────────────

class CronStorage {
	private readonly storePath = getPurePath("pure-cron.json", "config", "global").file;
	private cache: CronStore | null = null;

	load(): CronStore {
		if (this.cache) return this.cache;
		try {
			if (fs.existsSync(this.storePath)) {
				const raw = fs.readFileSync(this.storePath, "utf-8").trim();
				this.cache = JSON.parse(raw) as CronStore;
				return this.cache;
			}
		} catch (error) {
			console.error("Failed to load scheduled prompts:", error);
		}
		this.cache = { jobs: [], version: 1 };
		return this.cache;
	}

	invalidateCache(): void {
		this.cache = null;
	}

	save(store: CronStore): void {
		try {
			const dir = path.dirname(this.storePath);
			if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
			const tempPath = `${this.storePath}.${Date.now()}.${process.pid}.tmp`;
			fs.writeFileSync(tempPath, JSON.stringify(store, null, 2), "utf-8");
			fs.renameSync(tempPath, this.storePath);
			this.cache = null; // invalidate after write
		} catch (error) {
			console.error("Failed to save scheduled prompts:", error);
			throw error;
		}
	}

	hasJobWithName(name: string): boolean {
		return this.load().jobs.some((j) => j.name === name);
	}

	addJob(job: CronJob): void {
		const store = this.load();
		store.jobs.push(job);
		this.save(store);
	}

	removeJob(id: string): boolean {
		const store = this.load();
		const initialLength = store.jobs.length;
		store.jobs = store.jobs.filter((j) => j.id !== id);
		if (store.jobs.length < initialLength) {
			this.save(store);
			return true;
		}
		return false;
	}

	updateJob(id: string, partial: Partial<CronJob>): boolean {
		const store = this.load();
		const job = store.jobs.find((j) => j.id === id);
		if (job) {
			Object.assign(job, partial);
			this.save(store);
			return true;
		}
		return false;
	}

	getJob(id: string): CronJob | undefined {
		return this.load().jobs.find((j) => j.id === id);
	}

	getAllJobs(): CronJob[] {
		return this.load().jobs;
	}

	/**
	 * Get jobs filtered by scope.
	 * - "project": matches jobs whose projectPath equals the current one
	 * - "session": matches jobs whose sessionName equals the current one
	 * - "all": all jobs
	 */
	getJobsByScope(scope: JobScope, sessionName: string, projectPath: string): CronJob[] {
		const jobs = this.getAllJobs();
		switch (scope) {
			case "project":
				return jobs.filter((j) => j.projectPath === projectPath);
			case "session":
				return jobs.filter((j) => j.sessionName === sessionName);
			default:
				return jobs;
		}
	}

	/**
	 * Get jobs relevant to the current session — matches EITHER session name OR project path.
	 */
	getRelevantJobs(sessionName: string, projectPath: string): CronJob[] {
		return this.getAllJobs().filter((j) => j.sessionName === sessionName || j.projectPath === projectPath);
	}
}

// ─── Scheduler ──────────────────────────────────────────────────────────────

class CronScheduler {
	private jobs = new Map<string, Cron>();
	private intervals = new Map<string, NodeJS.Timeout>();

	constructor(
		private storage: CronStorage,
		private pi: ExtensionAPI,
	) {}

	addJob(job: CronJob): void {
		if (job.enabled) this.scheduleJob(job);
	}

	removeJob(id: string): void {
		this.unscheduleJob(id);
	}

	updateJob(id: string, updated: CronJob): void {
		this.unscheduleJob(id);
		if (updated.enabled) this.scheduleJob(updated);
	}

	getNextRun(jobId: string): Date | null {
		const cron = this.jobs.get(jobId);
		if (cron) return cron.nextRun();
		// For once/interval jobs, compute from stored schedule
		const job = this.storage.getJob(jobId);
		if (job?.enabled && job.type === "once") {
			const target = new Date(job.schedule);
			if (target.getTime() > Date.now()) return target;
		}
		return null;
	}

	stop(): void {
		for (const cron of this.jobs.values()) cron.stop();
		this.jobs.clear();
		for (const interval of this.intervals.values()) clearInterval(interval);
		this.intervals.clear();
	}

	private scheduleJob(job: CronJob): void {
		try {
			if (job.type === "interval" && job.intervalMs) {
				const interval = setInterval(() => {
					this.executeJob(job);
				}, job.intervalMs);
				this.intervals.set(job.id, interval);
			} else if (job.type === "once") {
				const targetDate = new Date(job.schedule);
				const delay = targetDate.getTime() - Date.now();
				if (delay > 0) {
					const timeout = setTimeout(() => {
						this.executeJob(job);
						this.storage.updateJob(job.id, { enabled: false });
					}, delay);
					this.intervals.set(job.id, timeout as any);
				} else {
					console.warn(`Job ${job.id} (${job.name}) scheduled for past time: ${job.schedule}`);
					this.storage.updateJob(job.id, { enabled: false, lastStatus: "error" });
				}
			} else {
				const cron = new Cron(job.schedule, () => {
					this.executeJob(job);
				});
				this.jobs.set(job.id, cron);
			}
		} catch (error) {
			console.error(`Failed to schedule job ${job.id}:`, error);
		}
	}

	private unscheduleJob(id: string): void {
		const cron = this.jobs.get(id);
		if (cron) {
			cron.stop();
			this.jobs.delete(id);
		}
		const interval = this.intervals.get(id);
		if (interval) {
			clearInterval(interval);
			this.intervals.delete(id);
		}
	}

	private async executeJob(job: CronJob): Promise<void> {
		console.log(`Executing scheduled prompt: ${job.name} (${job.id})`);
		try {
			this.storage.updateJob(job.id, { lastStatus: "running" });
			this.pi.events.emit("cron:change", { type: "fire", job } as CronChangeEvent);

			this.pi.sendMessage({
				customType: "pure_cron",
				content: [{ type: "text", text: job.prompt }],
				display: true,
				details: { jobId: job.id, jobName: job.name, prompt: job.prompt },
			});
			this.pi.sendUserMessage(job.prompt, { deliverAs: "followUp" });

			const nextRun = this.getNextRun(job.id);
			this.storage.updateJob(job.id, {
				lastRun: new Date().toISOString(),
				lastStatus: "success",
				runCount: job.runCount + 1,
				nextRun: nextRun?.toISOString(),
			});
			this.pi.events.emit("cron:change", { type: "fire", job } as CronChangeEvent);
		} catch (error) {
			console.error(`Failed to execute job ${job.id}:`, error);
			this.storage.updateJob(job.id, {
				lastRun: new Date().toISOString(),
				lastStatus: "error",
			});
			this.pi.events.emit("cron:change", {
				type: "error",
				jobId: job.id,
				error: error instanceof Error ? error.message : String(error),
			} as CronChangeEvent);
		}
	}
}

// ─── Tool ───────────────────────────────────────────────────────────────────

function createCronTool(
	getStorage: () => CronStorage,
	getScheduler: () => CronScheduler,
	getSessionInfo: () => { sessionName: string; projectPath: string },
): ToolDefinition<typeof CronToolParams, CronToolDetails> {
	return {
		name: "pure_cron",
		label: "Pure Cron",
		description:
			"IMPORTANT: For action='add', you MUST provide both 'schedule' parameter AND 'prompt' parameter. Schedule prompts at times/intervals. Schedule formats: 6-field cron (with seconds: '0 * * * * *' = every minute), ISO timestamp, relative time (+10s, +5m, +1h), or interval (5m, 1h). Type defaults to 'cron', use 'once' for relative/ISO times. Actions: add (needs schedule+prompt), list, remove/enable/disable/update (need jobId), cleanup.",
		parameters: CronToolParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const storage = getStorage();
			const scheduler = getScheduler();

			// Prevent recursive scheduling from within scheduled prompts
			if (params.action === "add") {
				const entries = ctx.sessionManager.getEntries();
				const recentEntries = entries.slice(-10);
				const hasScheduledPrompt = recentEntries.some(
					(entry: any) => entry.type === "custom" && entry.customType === "pure_cron",
				);
				if (hasScheduledPrompt) {
					throw new Error(
						"Cannot create scheduled prompts from within a scheduled prompt execution. This prevents infinite loops.",
					);
				}
			}

			const action = params.action;
			const details: CronToolDetails = { action, jobs: [] };

			try {
				switch (action) {
					case "add": {
						if (!params.schedule || !params.prompt) {
							const missing = [];
							if (!params.schedule) missing.push("'schedule'");
							if (!params.prompt) missing.push("'prompt'");
							throw new Error(`Missing required parameters for add action: ${missing.join(" and ")}.`);
						}

						const jobName = params.name || `job-${nanoid(6)}`;
						if (storage.hasJobWithName(jobName)) {
							throw new Error(`A job named "${jobName}" already exists.`);
						}

						const type = (params.type || "cron") as CronJobType;
						let intervalMs: number | undefined;
						let schedule = params.schedule;

						if (type === "interval") {
							const parsed = parseInterval(params.schedule);
							intervalMs = parsed ?? undefined;
							if (!intervalMs)
								throw new Error(`Invalid interval format: ${params.schedule}. Use format like '5m', '1h', '30s'`);
						} else if (type === "once") {
							const relativeTime = parseRelativeTime(params.schedule);
							if (relativeTime) {
								schedule = relativeTime;
							} else {
								const date = new Date(params.schedule);
								if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${params.schedule}`);
								schedule = date.toISOString();
								const delay = date.getTime() - Date.now();
								if (delay < 0) throw new Error(`Timestamp is in the past: ${formatLocalTime(schedule)}`);
								if (delay < 5000)
									throw new Error(
										`Timestamp is too soon (${Math.round(delay / 1000)}s). Schedule at least 5s in the future.`,
									);
							}
						} else {
							const validation = validateCronExpression(params.schedule);
							if (!validation.valid) throw new Error(`Invalid cron expression: ${validation.error}`);
						}

						const job: CronJob = {
							id: nanoid(10),
							name: jobName,
							schedule,
							prompt: params.prompt,
							enabled: true,
							type,
							intervalMs,
							createdAt: new Date().toISOString(),
							runCount: 0,
							description: params.description,
							...getSessionInfo(),
						};

						storage.addJob(job);
						scheduler.addJob(job);
						details.jobs = [job];
						details.jobId = job.id;
						details.jobName = job.name;

						return {
							content: [
								{
									type: "text",
									text: `✓ Created cron job "${job.name}" (${job.id})\nType: ${job.type}\nSchedule: ${formatSchedule(job)}\nPrompt: ${job.prompt}`,
								},
							],
							details,
						};
					}

					case "remove": {
						if (!params.jobId) throw new Error("jobId is required for remove action");
						const job = storage.getJob(params.jobId);
						if (!job) throw new Error(`Job not found: ${params.jobId}`);
						storage.removeJob(params.jobId);
						scheduler.removeJob(params.jobId);
						details.jobId = params.jobId;
						details.jobName = job.name;
						return {
							content: [{ type: "text", text: `✓ Removed cron job "${job.name}" (${params.jobId})` }],
							details,
						};
					}

					case "enable":
					case "disable": {
						if (!params.jobId) throw new Error(`jobId is required for ${action} action`);
						const job = storage.getJob(params.jobId);
						if (!job) throw new Error(`Job not found: ${params.jobId}`);
						const enabled = action === "enable";
						storage.updateJob(params.jobId, { enabled });
						const updated = { ...job, enabled };
						scheduler.updateJob(params.jobId, updated);
						details.jobs = [updated];
						details.jobId = params.jobId;
						details.jobName = job.name;
						return {
							content: [
								{
									type: "text",
									text: `✓ ${enabled ? "Enabled" : "Disabled"} cron job "${job.name}" (${params.jobId})`,
								},
							],
							details,
						};
					}

					case "cleanup": {
						const allJobs = storage.getAllJobs();
						const disabledJobs = allJobs.filter((j) => !j.enabled);
						if (disabledJobs.length === 0) {
							details.jobs = [];
							return { content: [{ type: "text", text: "No disabled jobs to clean up" }], details };
						}
						for (const job of disabledJobs) {
							storage.removeJob(job.id);
							scheduler.removeJob(job.id);
						}
						details.jobs = disabledJobs;
						return {
							content: [
								{
									type: "text",
									text: `✓ Removed ${disabledJobs.length} disabled job(s):\n${disabledJobs.map((j) => `  - ${j.name} (${j.id})`).join("\n")}`,
								},
							],
							details,
						};
					}

					case "update": {
						if (!params.jobId) throw new Error("jobId is required for update action");
						const job = storage.getJob(params.jobId);
						if (!job) throw new Error(`Job not found: ${params.jobId}`);

						const updates: Partial<CronJob> = {};
						if (params.name) updates.name = params.name;
						if (params.prompt) updates.prompt = params.prompt;
						if (params.description !== undefined) updates.description = params.description;

						if (params.schedule) {
							if (job.type === "interval") {
								const parsed = parseInterval(params.schedule);
								if (!parsed) throw new Error(`Invalid interval format: ${params.schedule}`);
								updates.schedule = params.schedule;
								updates.intervalMs = parsed;
							} else if (job.type === "once") {
								const date = new Date(params.schedule);
								if (Number.isNaN(date.getTime())) throw new Error(`Invalid timestamp: ${params.schedule}`);
								updates.schedule = date.toISOString();
							} else {
								const validation = validateCronExpression(params.schedule);
								if (!validation.valid) throw new Error(`Invalid cron expression: ${validation.error}`);
								updates.schedule = params.schedule;
							}
						}

						storage.updateJob(params.jobId, updates);
						const updated = { ...job, ...updates };
						scheduler.updateJob(params.jobId, updated);
						details.jobs = [updated];
						details.jobId = params.jobId;
						details.jobName = updated.name;
						return {
							content: [{ type: "text", text: `✓ Updated cron job "${updated.name}" (${params.jobId})` }],
							details,
						};
					}

					case "list": {
						const scope = (params.scope || "all") as JobScope;
						const { sessionName, projectPath } = getSessionInfo();
						const jobs = storage.getJobsByScope(scope, sessionName, projectPath);
						details.jobs = jobs;

						if (jobs.length === 0) {
							return { content: [{ type: "text", text: "No cron jobs configured." }], details };
						}

						const lines = ["Configured cron jobs:", ""];
						for (const job of jobs) {
							const status = job.enabled ? "✓" : "✗";
							const nextRun = scheduler.getNextRun(job.id);
							const nextStr = nextRun ? `Next: ${formatLocalTime(nextRun.toISOString())}` : "";
							const lastStr = job.lastRun ? `Last: ${formatLocalTime(job.lastRun)}` : "Never run";
							lines.push(`${status} ${job.name} (${job.id})`);
							lines.push(`  Type: ${job.type} | Schedule: ${formatSchedule(job)}`);
							lines.push(`  Prompt: ${job.prompt}`);
							lines.push(`  ${lastStr} ${nextStr ? `| ${nextStr}` : ""}`);
							lines.push(`  Runs: ${job.runCount} | Status: ${job.lastStatus || "pending"}`);
							if (job.description) lines.push(`  Description: ${job.description}`);
							lines.push("");
						}

						return { content: [{ type: "text", text: lines.join("\n") }], details };
					}

					default:
						throw new Error(`Unknown action: ${action}`);
				}
			} catch (error) {
				details.error = error instanceof Error ? error.message : String(error);
				return {
					content: [{ type: "text", text: `✗ Error: ${details.error}` }],
					details,
				};
			}
		},

		renderCall(params, theme) {
			const action = params.action;
			const name = params.name || params.jobId || "";
			const actionText = theme.fg("accent", action);
			const nameText = theme.fg("text", name);

			let text: string;
			switch (action) {
				case "add":
					text = `Adding cron job: ${nameText}`;
					break;
				case "remove":
					text = `Removing cron job: ${nameText}`;
					break;
				case "enable":
				case "disable":
					text = `${actionText.charAt(0).toUpperCase() + actionText.slice(1)} job: ${nameText}`;
					break;
				case "update":
					text = `Updating cron job: ${nameText}`;
					break;
				case "list":
					text = `Listing all cron jobs`;
					break;
				default:
					text = `${actionText} cron job`;
			}
			return new Text(text, 0, 0);
		},

		renderResult(result, _options, theme) {
			if (!result.details) {
				const text = result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n");
				return new Text(text, 0, 0);
			}

			const details = result.details;
			const lines: string[] = [];

			if (details.error) {
				lines.push(theme.fg("error", `✗ Error: ${details.error}`));
			} else {
				const jobName = details.jobName || details.jobId || "";
				lines.push(theme.fg("success", `✓ ${details.action} ${jobName}`));
			}

			if (details.action === "list" && details.jobs.length > 0) {
				lines.push("");
				lines.push(theme.bold("Cron Jobs:"));
				for (const job of details.jobs) {
					const status = job.enabled ? theme.fg("success", "✓") : theme.fg("muted", "✗");
					lines.push(`${status} ${theme.fg("text", job.name)} ${theme.fg("dim", `(${job.id})`)}`);
					lines.push(`  ${theme.fg("dim", "Type:")} ${job.type} ${theme.fg("dim", "| Schedule:")} ${job.schedule}`);
					lines.push(`  ${theme.fg("dim", "Prompt:")} ${job.prompt}`);
					if (job.lastRun) lines.push(`  ${theme.fg("dim", "Last run:")} ${job.lastRun}`);
					lines.push(`  ${theme.fg("dim", "Runs:")} ${job.runCount}`);
				}
			}

			return new Text(lines.join("\n"), 0, 0);
		},
	};
}

// ─── Widget ─────────────────────────────────────────────────────────────────

const WIDGET_ID = "pure-cron";

class CronWidget {
	private refreshInterval?: NodeJS.Timeout;
	private invalidateFn?: () => void;

	constructor(
		private storage: CronStorage,
		private scheduler: CronScheduler,
		private pi: ExtensionAPI,
		private isVisible: () => boolean,
		private getSessionInfo: () => { sessionName: string; projectPath: string },
	) {
		this.pi.events.on("cron:change", () => {
			this.refresh();
		});
	}

	show(ctx: any): void {
		if (!this.isVisible()) {
			this.hide(ctx);
			return;
		}

		const { sessionName, projectPath } = this.getSessionInfo();
		const jobs = this.storage.getRelevantJobs(sessionName, projectPath);
		if (jobs.length === 0) {
			this.hide(ctx);
			return;
		}

		ctx.ui.setWidget(
			WIDGET_ID,
			(_tui: any, theme: any) => {
				const component = {
					render: (width: number) => this.renderWidget(width, theme),
					invalidate: () => {
						this.invalidateFn = () => {
							if (ctx.ui) this.show(ctx);
						};
					},
				};

				if (this.refreshInterval) clearInterval(this.refreshInterval);
				this.refreshInterval = setInterval(() => {
					if (this.invalidateFn) this.invalidateFn();
				}, 30000);

				return component;
			},
			{ placement: "belowEditor" },
		);
	}

	hide(ctx: any): void {
		ctx.ui.setWidget(WIDGET_ID, undefined);
		if (this.refreshInterval) {
			clearInterval(this.refreshInterval);
			this.refreshInterval = undefined;
		}
	}

	private refresh(): void {
		if (this.invalidateFn) this.invalidateFn();
	}

	private renderWidget(width: number, theme: any): string[] {
		const { sessionName, projectPath } = this.getSessionInfo();
		const jobs = this.storage.getRelevantJobs(sessionName, projectPath);
		const uniqueJobs = Array.from(new Map(jobs.map((job) => [job.id, job])).values());

		const container = new Container();
		const borderColor = (s: string) => theme.fg("accent", s);

		container.addChild(new DynamicBorder(borderColor));
		container.addChild(
			new Text(
				theme.fg("accent", theme.bold("Scheduled Prompts")) + theme.fg("dim", ` (${uniqueJobs.length} jobs)`),
				1,
				0,
			),
		);
		container.addChild(new Spacer(1));

		const lines: string[] = [];
		for (const job of uniqueJobs) {
			let statusIcon: string;
			if (!job.enabled) statusIcon = theme.fg("muted", "✗");
			else if (job.lastStatus === "running") statusIcon = theme.fg("warning", "⟳");
			else if (job.lastStatus === "error") statusIcon = theme.fg("error", "!");
			else statusIcon = theme.fg("success", "✓");

			const nameRaw = job.name.length > 20 ? `${job.name.substring(0, 17)}...` : job.name;
			const namePadded = nameRaw.padEnd(20);
			const nameText = job.enabled ? theme.fg("text", namePadded) : theme.fg("muted", namePadded);

			const cwdRaw = job.projectPath ? path.basename(job.projectPath) : "-";
			const cwdPadded = cwdRaw.padEnd(15);
			const cwdText = theme.fg("dim", cwdPadded);

			let scheduleRaw: string;
			if (job.type === "cron") scheduleRaw = humanizeCron(job.schedule);
			else if (job.type === "once" && job.schedule.includes("T")) scheduleRaw = formatISOShort(job.schedule);
			else scheduleRaw = job.schedule.length > 15 ? `${job.schedule.substring(0, 12)}...` : job.schedule;
			const schedulePadded = scheduleRaw.padEnd(15);
			const scheduleText = theme.fg("dim", schedulePadded);

			const nextRun = this.scheduler.getNextRun(job.id);
			const nextRaw = nextRun ? `⏱ ${formatRelativeTime(nextRun)}` : "-";
			const nextPadded = nextRaw.padEnd(14);
			const nextText = nextRun ? theme.fg("accent", nextPadded) : theme.fg("dim", nextPadded);

			const lastRaw = job.lastRun ? formatRelativeTime(job.lastRun) : "never";
			const lastPadded = lastRaw.padEnd(10);
			const lastText = job.lastRun ? lastPadded : theme.fg("dim", lastPadded);

			const countText = theme.fg("accent", job.runCount.toString().padEnd(3));

			lines.push(` ${statusIcon} ${nameText} ${cwdText} ${scheduleText} ${nextText} ${lastText} ${countText}`);
		}

		container.addChild(new Text(lines.join("\n"), 1, 0));
		container.addChild(new DynamicBorder(borderColor));

		return container.render(width);
	}

	destroy(): void {
		if (this.refreshInterval) clearInterval(this.refreshInterval);
	}
}

// ─── Settings ───────────────────────────────────────────────────────────────

function loadSettings(): { widget_show_default: boolean } {
	try {
		const settingsPath = path.join(getAgentDir(), "settings.json");
		if (fs.existsSync(settingsPath)) {
			const raw = fs.readFileSync(settingsPath, "utf-8");
			const settings = JSON.parse(raw);
			return { widget_show_default: settings?.pure?.cron?.widget_show_default ?? true };
		}
	} catch (e) {
		console.error("Failed to load pure_cron settings:", e);
	}
	return { widget_show_default: true };
}

// ─── Extension Entry Point ──────────────────────────────────────────────────

export default async function (pi: ExtensionAPI) {
	// Migrate old ~/.pi/agent/pure-cron.json → ~/.pi/agent/pure/config/pure-cron.json
	migrateIfNeeded("pure-cron.json", OLD_CRON_PATH, "config");

	let storage: CronStorage;
	let scheduler: CronScheduler;
	let widget: CronWidget;
	const settings = loadSettings();
	let widgetVisible = settings.widget_show_default;

	let currentSessionName = "";
	let currentProjectPath = "";

	const getSessionInfo = () => ({
		sessionName: currentSessionName,
		projectPath: currentProjectPath,
	});

	// Register custom message renderer for scheduled prompts
	pi.registerMessageRenderer("pure_cron", (message, _options, theme) => {
		const details = message.details as { jobId: string; jobName: string; prompt: string } | undefined;
		const jobName = details?.jobName || "Unknown";
		const prompt = details?.prompt || "";
		return new Text(
			theme.fg("accent", `🕐 Scheduled: ${jobName}`) + (prompt ? theme.fg("dim", ` → "${prompt}"`) : ""),
			0,
			0,
		);
	});

	// Register the tool
	const tool = createCronTool(
		() => storage,
		() => scheduler,
		getSessionInfo,
	);
	pi.registerTool(tool);

	const initializeSession = (ctx: any) => {
		// Read session name from the session file (latest session_info entry)
		currentSessionName = ctx.sessionManager.getSessionName() ?? null;
		// Sentinel when session has no name
		if (!currentSessionName) currentSessionName = "__unowned__";
		currentProjectPath = ctx.cwd ?? null;

		storage = new CronStorage();
		scheduler = new CronScheduler(storage, pi);
		widget = new CronWidget(storage, scheduler, pi, () => widgetVisible, getSessionInfo);

		const relevantJobs = storage.getRelevantJobs(currentSessionName, currentProjectPath!);
		for (const job of relevantJobs) {
			if (job.enabled) scheduler.addJob(job);
		}

		if (widgetVisible) widget.show(ctx);
	};

	const cleanupSession = (ctx: any) => {
		if (scheduler) scheduler.stop();
		if (widget) {
			widget.hide(ctx);
			widget.destroy();
		}
	};

	const autoCleanupDisabledJobs = () => {
		if (storage) {
			const disabledJobs = storage.getAllJobs().filter((j) => !j.enabled);
			if (disabledJobs.length > 0) {
				console.log(`Auto-cleanup: removing ${disabledJobs.length} disabled job(s)`);
				for (const job of disabledJobs) storage.removeJob(job.id);
			}
		}
	};

	pi.on("session_start", async (event, ctx) => {
		// On resume/fork, clean up the previous session's scheduler and disabled jobs
		if (event.reason === "resume" || event.reason === "fork") {
			autoCleanupDisabledJobs();
			cleanupSession(ctx);
		}
		initializeSession(ctx);
	});
	pi.on("session_shutdown", async (_event, ctx) => {
		autoCleanupDisabledJobs();
		cleanupSession(ctx);
	});

	// Register /cron command
	pi.registerCommand("cron", {
		description: "Schedule and manage recurring or one-shot agent prompts",
		handler: async (_args, ctx) => {
			// Helper: cyclic select using SelectList (wraps around on up/down)
			const cyclicSelect = async (title: string, options: string[]): Promise<string | null> => {
				return await ctx.ui.custom<string | null>((tui, theme, _kb, done) => {
					const items: SelectItem[] = options.map((o) => ({ value: o, label: o }));
					const container = new Container();
					container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
					container.addChild(new Text(theme.fg("accent", theme.bold(title)), 1, 0));
					const selectList = new SelectList(items, Math.min(options.length, 10), {
						selectedPrefix: (t) => theme.fg("accent", t),
						selectedText: (t) => theme.fg("accent", t),
						description: (t) => theme.fg("muted", t),
						scrollInfo: (t) => theme.fg("dim", t),
						noMatch: (t) => theme.fg("warning", t),
					});
					selectList.onSelect = (item) => done(item.value);
					selectList.onCancel = () => done(null);
					container.addChild(selectList);
					container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
					return {
						render: (w) => container.render(w),
						invalidate: () => container.invalidate(),
						handleInput: (data) => {
							selectList.handleInput(data);
							tui.requestRender();
						},
					};
				});
			};

			const action = await cyclicSelect("Pure Cron", [
				"View All Jobs",
				"View Project Jobs",
				"View Session Jobs",
				"Add New Job",
				"Toggle Job (Enable/Disable)",
				"Remove Job",
				"Cleanup Disabled Jobs",
				"Toggle Widget Visibility",
			]);

			if (!action) return;

			const actionMap: Record<string, string> = {
				"View All Jobs": "list-all",
				"View Project Jobs": "list-project",
				"View Session Jobs": "list-session",
				"Add New Job": "add",
				"Toggle Job (Enable/Disable)": "toggle",
				"Remove Job": "remove",
				"Cleanup Disabled Jobs": "cleanup",
				"Toggle Widget Visibility": "toggleWidget",
			};
			const actionKey = actionMap[action];

			const getJobsForScope = (scope: JobScope) => {
				return storage.getJobsByScope(scope, currentSessionName, currentProjectPath!);
			};

			switch (actionKey) {
				case "list-all":
				case "list-project":
				case "list-session": {
					const scopeMap: Record<string, JobScope> = {
						"list-all": "all",
						"list-project": "project",
						"list-session": "session",
					};
					const scope = scopeMap[actionKey];
					const jobs = getJobsForScope(scope);
					if (jobs.length === 0) {
						ctx.ui.notify(`No scheduled prompts for scope: ${scope}`, "info");
						return;
					}

					const scopeLabel = scope === "all" ? "All" : scope === "project" ? "Project" : "Session";
					const lines = [`${scopeLabel} scheduled prompts:`, ""];
					for (const job of jobs) {
						const status = job.enabled ? "✓" : "✗";
						const nextRun = scheduler.getNextRun(job.id);
						const isBoth = job.sessionName === currentSessionName && job.projectPath === currentProjectPath;
						const isSession = job.sessionName === currentSessionName;
						const isProject = job.projectPath === currentProjectPath;
						const isUnowned = job.sessionName === "__unowned__";
						const scopeTag = isBoth
							? "[session+project]"
							: isSession && !isUnowned
								? "[session]"
								: isProject
									? "[project]"
									: "[other]";
						lines.push(`${status} ${job.name} (${job.id}) ${scopeTag}`);
						lines.push(`  Schedule: ${job.schedule} | Type: ${job.type}`);
						lines.push(`  Prompt: ${job.prompt}`);
						if (nextRun) lines.push(`  Next run: ${nextRun.toISOString()}`);
						lines.push(`  Runs: ${job.runCount}`);
						lines.push("");
					}
					ctx.ui.notify(lines.join("\n"), "info");
					break;
				}

				case "add": {
					const name = await ctx.ui.input("Job Name", "Enter a name for this scheduled prompt");
					if (!name) return;

					const typeChoice = await cyclicSelect("Job Type", [
						"Cron (recurring)",
						"Once (one-shot)",
						"Interval (periodic)",
					]);
					if (!typeChoice) return;

					const typeMap: Record<string, string> = {
						"Cron (recurring)": "cron",
						"Once (one-shot)": "once",
						"Interval (periodic)": "interval",
					};
					const jobType = typeMap[typeChoice];

					let schedulePrompt: string;
					if (jobType === "cron") schedulePrompt = "Enter cron expression (6-field: sec min hour dom month dow):";
					else if (jobType === "once") schedulePrompt = "Enter ISO timestamp (e.g., 2026-02-13T10:30:00Z)";
					else schedulePrompt = "Enter interval (e.g., 5m, 1h, 30s)";

					const schedule = await ctx.ui.input("Schedule", schedulePrompt);
					if (!schedule) return;

					const prompt = await ctx.ui.input("Prompt", "Enter the prompt to execute");
					if (!prompt) return;

					try {
						let intervalMs: number | undefined;
						let validatedSchedule = schedule;

						if (jobType === "interval") {
							const parsed = parseInterval(schedule);
							intervalMs = parsed ?? undefined;
							if (!intervalMs) {
								ctx.ui.notify("Invalid interval format", "error");
								return;
							}
						} else if (jobType === "once") {
							const date = new Date(schedule);
							if (Number.isNaN(date.getTime())) {
								ctx.ui.notify("Invalid timestamp format", "error");
								return;
							}
							validatedSchedule = date.toISOString();
						} else {
							const validation = validateCronExpression(schedule);
							if (!validation.valid) {
								ctx.ui.notify(`Invalid cron expression: ${validation.error}`, "error");
								return;
							}
						}

						const job: CronJob = {
							id: nanoid(10),
							name,
							schedule: validatedSchedule,
							prompt,
							enabled: true,
							type: jobType as CronJobType,
							intervalMs,
							createdAt: new Date().toISOString(),
							runCount: 0,
							...getSessionInfo(),
						};

						storage.addJob(job);
						scheduler.addJob(job);
						ctx.ui.notify(`Created scheduled prompt: ${name}`, "info");
					} catch (error: any) {
						ctx.ui.notify(`Error: ${error.message}`, "error");
					}
					break;
				}

				case "toggle": {
					const jobs = storage.getRelevantJobs(currentSessionName, currentProjectPath!);
					if (jobs.length === 0) {
						ctx.ui.notify("No scheduled prompts configured", "info");
						return;
					}

					const jobId = await cyclicSelect(
						"Select Job to Toggle",
						jobs.map((j) => `${j.enabled ? "✓" : "✗"} ${j.name}`),
					);
					if (!jobId) return;

					const selectedIndex = jobs.findIndex((j) => `${j.enabled ? "✓" : "✗"} ${j.name}` === jobId);
					const job = selectedIndex >= 0 ? jobs[selectedIndex] : undefined;
					if (job) {
						const newEnabled = !job.enabled;
						storage.updateJob(job.id, { enabled: newEnabled });
						scheduler.updateJob(job.id, { ...job, enabled: newEnabled });
						ctx.ui.notify(`${newEnabled ? "Enabled" : "Disabled"} job: ${job.name}`, "info");
					}
					break;
				}

				case "remove": {
					const jobs = storage.getRelevantJobs(currentSessionName, currentProjectPath!);
					if (jobs.length === 0) {
						ctx.ui.notify("No scheduled prompts configured", "info");
						return;
					}

					const jobId = await cyclicSelect(
						"Select Job to Remove",
						jobs.map((j) => j.name),
					);
					if (!jobId) return;

					const job = jobs.find((j) => j.name === jobId);
					if (job) {
						const confirmed = await ctx.ui.confirm("Confirm Removal", `Remove scheduled prompt "${job.name}"?`);
						if (confirmed) {
							storage.removeJob(job.id);
							scheduler.removeJob(job.id);
							ctx.ui.notify(`Removed job: ${job.name}`, "info");
						}
					}
					break;
				}

				case "cleanup": {
					const disabledJobs = storage.getAllJobs().filter((j) => !j.enabled);
					if (disabledJobs.length === 0) {
						ctx.ui.notify("No disabled jobs to clean up", "info");
						return;
					}

					const confirmed = await ctx.ui.confirm("Confirm Cleanup", `Remove ${disabledJobs.length} disabled job(s)?`);
					if (confirmed) {
						for (const job of disabledJobs) {
							storage.removeJob(job.id);
							scheduler.removeJob(job.id);
						}
						ctx.ui.notify(`Removed ${disabledJobs.length} disabled job(s)`, "info");
					}
					break;
				}

				case "toggleWidget": {
					widgetVisible = !widgetVisible;
					if (widgetVisible) {
						widget.show(ctx);
						ctx.ui.notify("Widget enabled (shows when jobs exist)", "info");
					} else {
						widget.hide(ctx);
						ctx.ui.notify("Widget disabled (hidden)", "info");
					}
					break;
				}
			}
		},
	});
}
