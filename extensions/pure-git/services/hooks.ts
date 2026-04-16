/**
 * pure-git — Lifecycle hooks and branch name generator
 *
 * Hooks (onCreate, onSwitch, onBeforeRemove) run commands via pi.exec().
 * Branch name generator spawns a `pi` subprocess to create a session.
 */

import { spawn } from "node:child_process";
import type { ExecFn } from "./git";
import type { TemplateContext } from "./templates";
import { expandTemplate } from "./templates";

// ── Types ────────────────────────────────────────────────────────────────────

export interface HookResult {
	success: boolean;
	executed: string[];
	failed?: {
		command: string;
		code: number;
		error: string;
	};
}

export type BranchGeneratorErrorCode =
	| "missing-config"
	| "timeout"
	| "non-zero-exit"
	| "empty-output"
	| "invalid-output"
	| "spawn-error";

export interface BranchGeneratorSuccess {
	ok: true;
	branchName: string;
}

export interface BranchGeneratorFailure {
	ok: false;
	code: BranchGeneratorErrorCode;
	message: string;
}

export type BranchGeneratorResult = BranchGeneratorSuccess | BranchGeneratorFailure;

// ── Hook runner ──────────────────────────────────────────────────────────────

/**
 * Run lifecycle hook commands sequentially.
 * Commands are expanded via template context before execution.
 * Stops at first failure and returns the failing command.
 */
export async function runHook(
	ctx: TemplateContext,
	commands: string | string[] | undefined,
	exec: ExecFn,
	notify: (msg: string, type: "info" | "error" | "warning") => void,
	hookName: string,
): Promise<HookResult> {
	if (!commands) return { success: true, executed: [] };

	const commandList = Array.isArray(commands) ? commands : [commands];
	if (commandList.length === 0) return { success: true, executed: [] };

	// Expand templates
	const expanded = commandList.map((cmd) => expandTemplate(cmd, ctx));
	const executed: string[] = [];

	notify(`${hookName} steps:`, "info");

	for (const command of expanded) {
		notify(`  ⏳ ${command}`, "info");

		const result = await exec("sh", ["-c", command], {
			cwd: ctx.path,
			timeout: 120_000, // 2 min per command
		});

		executed.push(command);

		if (result.code !== 0) {
			const stderr = result.stderr.trim().slice(0, 200);
			notify(`  ✗ ${command} — exit ${result.code}${stderr ? `: ${stderr}` : ""}`, "error");
			return {
				success: false,
				executed,
				failed: { command, code: result.code, error: stderr },
			};
		}

		// Show last few lines of output
		const lines = result.stdout.trim().split("\n").filter(Boolean);
		const tail = lines.slice(-3);
		for (const line of tail) {
			notify(`    › ${line}`, "info");
		}
		notify(`  ✓ ${command}`, "info");
	}

	return { success: true, executed };
}

// ── Branch name generator ────────────────────────────────────────────────────

const BRANCH_NAME_TIMEOUT_MS = 10_000;

function shellQuote(value: string): string {
	return `'${value.replace(/'/g, "'\\''")}'`;
}

function renderCommand(template: string, input: string): string {
	const quotedInput = shellQuote(input);
	return template.replace(/\{\{prompt\}\}|\{prompt\}/g, quotedInput);
}

async function validateBranchName(branchName: string, cwd: string): Promise<boolean> {
	const checker = spawn("git", ["check-ref-format", "--branch", branchName], {
		cwd,
		shell: false,
		stdio: "ignore",
	});

	return new Promise<boolean>((resolve) => {
		checker.on("close", (code) => resolve(code === 0));
		checker.on("error", () => resolve(false));
	});
}

/**
 * Generate a branch name by spawning a `pi` subprocess.
 * This creates an actual session in the worktree directory,
 * allowing the user to switch to it from the browser.
 */
export async function generateBranchName(params: {
	commandTemplate: string;
	input: string;
	cwd: string;
	timeoutMs?: number;
}): Promise<BranchGeneratorResult> {
	const timeoutMs = params.timeoutMs ?? BRANCH_NAME_TIMEOUT_MS;

	if (!params.commandTemplate.trim()) {
		return {
			ok: false,
			code: "missing-config",
			message: "No branchNameGenerator configured. Set it in pure-git.json or use /worktrees create <branch> directly.",
		};
	}

	const command = renderCommand(params.commandTemplate, params.input);

	const result = await new Promise<
		| { kind: "success"; stdout: string; stderr: string; code: number }
		| { kind: "spawn-error"; error: string }
		| { kind: "timeout" }
	>((resolve) => {
		const child = spawn(command, {
			cwd: params.cwd,
			shell: true,
			stdio: ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				PI_WORKTREE_PROMPT: params.input,
			},
		});

		let stdout = "";
		let stderr = "";
		let done = false;

		const timer = setTimeout(() => {
			if (done) return;
			done = true;
			child.kill("SIGKILL");
			resolve({ kind: "timeout" });
		}, timeoutMs);

		child.stdout?.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
		});

		child.stderr?.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});

		child.on("error", (error) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			resolve({ kind: "spawn-error", error: error.message });
		});

		child.on("close", (code) => {
			if (done) return;
			done = true;
			clearTimeout(timer);
			resolve({ kind: "success", stdout, stderr, code: code ?? 1 });
		});
	});

	if (result.kind === "timeout") {
		return {
			ok: false,
			code: "timeout",
			message: `branchNameGenerator timed out after ${timeoutMs}ms. Use /worktrees create <branch> manually.`,
		};
	}

	if (result.kind === "spawn-error") {
		return {
			ok: false,
			code: "spawn-error",
			message: `Failed to run branchNameGenerator: ${result.error}`,
		};
	}

	if (result.code !== 0) {
		const stderr = result.stderr.trim();
		return {
			ok: false,
			code: "non-zero-exit",
			message: `branchNameGenerator exited with code ${result.code}.${stderr ? ` stderr: ${stderr}` : ""}`,
		};
	}

	const branchName = result.stdout.trim();
	if (!branchName) {
		return {
			ok: false,
			code: "empty-output",
			message: "branchNameGenerator produced empty output. Ensure the command prints one branch name.",
		};
	}

	const valid = await validateBranchName(branchName, params.cwd);
	if (!valid) {
		return {
			ok: false,
			code: "invalid-output",
			message: `branchNameGenerator output is not a valid branch name: '${branchName}'.`,
		};
	}

	return { ok: true, branchName };
}
