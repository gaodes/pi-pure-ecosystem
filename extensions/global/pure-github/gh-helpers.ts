/**
 * Higher-level gh CLI helpers for commands.
 *
 * Built on top of GHClient / pi.exec.
 */

import type { ExecOptions, PiExecFn } from "./gh-client";

export interface JsonResult<T> {
	code: number;
	stdout: string;
	stderr: string;
	data: T;
}

/**
 * Run `gh` with the given args and parse JSON from stdout.
 * Expects the caller to have ensured --json is present when needed.
 */
export async function ghJson<T = unknown>(
	exec: PiExecFn,
	binaryPath: string,
	args: string[],
	options?: ExecOptions,
): Promise<JsonResult<T>> {
	const result = await exec(binaryPath, args, options);
	let data: T = undefined as T;
	if (result.stdout) {
		try {
			data = JSON.parse(result.stdout) as T;
		} catch {
			// leave as undefined if unparseable
		}
	}
	return {
		code: result.code,
		stdout: result.stdout,
		stderr: result.stderr,
		data,
	};
}

/**
 * Run a GitHub GraphQL query via `gh api graphql`.
 */
export async function ghGraphql<T = unknown>(
	exec: PiExecFn,
	binaryPath: string,
	query: string,
	variables?: Record<string, unknown>,
	options?: ExecOptions,
): Promise<JsonResult<T>> {
	const args = ["api", "graphql", "-f", `query=${query}`];
	if (variables) {
		for (const [key, value] of Object.entries(variables)) {
			const val = typeof value === "string" ? value : JSON.stringify(value);
			args.push("-f", `${key}=${val}`);
		}
	}
	return ghJson<T>(exec, binaryPath, args, options);
}

/**
 * Get the current git branch name.
 * Returns `null` if not inside a git repo.
 */
export async function getCurrentBranch(exec: PiExecFn, binaryPath = "git", _cwd?: string): Promise<string | null> {
	try {
		const result = await exec(binaryPath, ["branch", "--show-current"], {
			timeout: 5000,
		});
		if (result.code === 0) {
			const branch = result.stdout.trim();
			return branch || null;
		}
	} catch {
		// ignore
	}
	return null;
}
