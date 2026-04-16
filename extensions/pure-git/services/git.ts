/**
 * pure-git — Git operations using pi.exec()
 *
 * All git commands go through the provided exec function (pi.exec.bind(pi))
 * for Pi-idiomatic process management. No child_process.execSync.
 */

import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

// ── Types ────────────────────────────────────────────────────────────────────

export interface WorktreeInfo {
	path: string;
	branch: string;
	head: string;
	isMain: boolean;
	isCurrent: boolean;
}

export interface MergeResult {
	success: boolean;
	/** "merged" | "already-up-to-date" | "conflict" | "error" */
	status: string;
	message: string;
}

export interface AheadBehind {
	ahead: number;
	behind: number;
}

/** Generic exec function — bound to pi.exec */
export type ExecFn = (
	command: string,
	args: string[],
	options?: { cwd?: string; timeout?: number },
) => Promise<{ code: number; stdout: string; stderr: string }>;

// ── Helpers ──────────────────────────────────────────────────────────────────

const WORKTREES_DIR = ".worktrees";

/**
 * Run a git command via the provided exec function.
 * Returns trimmed stdout on success, throws on non-zero exit.
 */
async function git(exec: ExecFn, args: string[], cwd?: string): Promise<string> {
	const result = await exec("git", args, { cwd, timeout: 30_000 });
	if (result.code !== 0) {
		throw new Error(
			`git ${args.join(" ")} failed (exit ${result.code}): ${result.stderr.trim() || result.stdout.trim()}`,
		);
	}
	return result.stdout.trim();
}

/**
 * Run a git command and return the raw result (no throw on non-zero).
 */
async function gitRaw(
	exec: ExecFn,
	args: string[],
	cwd?: string,
): Promise<{ code: number; stdout: string; stderr: string }> {
	return exec("git", args, { cwd, timeout: 30_000 });
}

// ── Core Git Operations ─────────────────────────────────────────────────────

export async function isGitRepo(exec: ExecFn, cwd: string): Promise<boolean> {
	const result = await gitRaw(exec, ["rev-parse", "--git-dir"], cwd);
	return result.code === 0;
}

export async function getMainWorktreePath(exec: ExecFn, cwd: string): Promise<string> {
	const gitCommonDir = await git(exec, ["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd);
	return dirname(gitCommonDir);
}

export async function getProjectName(exec: ExecFn, cwd: string): Promise<string> {
	const mainPath = await getMainWorktreePath(exec, cwd);
	return basename(mainPath);
}

export async function getCurrentBranch(exec: ExecFn, cwd: string): Promise<string> {
	try {
		return await git(exec, ["branch", "--show-current"], cwd);
	} catch {
		return "HEAD (detached)";
	}
}

export async function getMainBranch(exec: ExecFn, cwd: string): Promise<string> {
	// Try common main branch names
	for (const candidate of ["main", "master"]) {
		const result = await gitRaw(exec, ["rev-parse", "--verify", candidate], cwd);
		if (result.code === 0) return candidate;
	}
	// Fall back to HEAD's default remote branch
	try {
		return await git(exec, ["symbolic-ref", "refs/remotes/origin/HEAD", "--short"], cwd).then((s) =>
			s.replace(/^origin\//, ""),
		);
	} catch {
		return "main";
	}
}

// ── Branch Operations ───────────────────────────────────────────────────────

export async function branchExists(exec: ExecFn, branch: string, cwd: string): Promise<boolean> {
	const result = await gitRaw(exec, ["rev-parse", "--verify", branch], cwd);
	return result.code === 0;
}

export async function createBranch(exec: ExecFn, name: string, base: string, cwd: string): Promise<void> {
	await git(exec, ["branch", name, base], cwd);
}

export async function deleteBranch(exec: ExecFn, name: string, cwd: string): Promise<void> {
	await git(exec, ["branch", "-d", name], cwd);
}

export async function checkoutBranch(exec: ExecFn, branch: string, cwd: string): Promise<void> {
	await git(exec, ["checkout", branch], cwd);
}

// ── Worktree Operations ─────────────────────────────────────────────────────

export function getWorktreePath(projectRoot: string, name: string): string {
	return join(projectRoot, WORKTREES_DIR, name);
}

export async function listWorktrees(exec: ExecFn, cwd: string): Promise<WorktreeInfo[]> {
	const output = await git(exec, ["worktree", "list", "--porcelain"], cwd);
	const worktrees: WorktreeInfo[] = [];
	const currentPath = resolve(cwd);
	const mainPath = await getMainWorktreePath(exec, cwd);

	let current: Partial<WorktreeInfo> = {};

	for (const line of output.split("\n")) {
		if (line.startsWith("worktree ")) {
			current.path = line.slice(9);
		} else if (line.startsWith("HEAD ")) {
			current.head = line.slice(5);
		} else if (line.startsWith("branch ")) {
			current.branch = line.slice(7).replace("refs/heads/", "");
		} else if (line === "detached") {
			current.branch = "HEAD (detached)";
		} else if (line === "") {
			if (current.path) {
				worktrees.push({
					path: current.path,
					branch: current.branch || "unknown",
					head: current.head || "unknown",
					isMain: current.path === mainPath,
					isCurrent: current.path === currentPath,
				});
			}
			current = {};
		}
	}

	// Handle last entry (no trailing newline)
	if (current.path) {
		worktrees.push({
			path: current.path,
			branch: current.branch || "unknown",
			head: current.head || "unknown",
			isMain: current.path === mainPath,
			isCurrent: current.path === currentPath,
		});
	}

	return worktrees;
}

export async function createWorktree(exec: ExecFn, worktreePath: string, branch: string, cwd: string): Promise<void> {
	await git(exec, ["worktree", "add", worktreePath, branch], cwd);
}

export async function removeWorktree(exec: ExecFn, worktreePath: string, cwd: string, force = false): Promise<void> {
	const args = ["worktree", "remove", worktreePath];
	if (force) args.push("--force");
	await git(exec, args, cwd);
}

// ── Merge Operations ────────────────────────────────────────────────────────

export async function mergeBranch(exec: ExecFn, branch: string, cwd: string): Promise<MergeResult> {
	const result = await gitRaw(exec, ["merge", branch], cwd);
	const output = result.stdout.trim();
	const errOutput = result.stderr.trim();

	if (result.code === 0) {
		if (output.includes("Already up to date") || output.includes("Already up-to-date")) {
			return { success: true, status: "already-up-to-date", message: output };
		}
		return { success: true, status: "merged", message: output || `Merged ${branch}` };
	}

	// Conflict
	if (output.includes("CONFLICT") || errOutput.includes("CONFLICT")) {
		// Abort the merge to leave the repo clean
		await gitRaw(exec, ["merge", "--abort"], cwd);
		return { success: false, status: "conflict", message: "Merge conflicts detected. Aborted." };
	}

	return { success: false, status: "error", message: errOutput || output };
}

// ── Status Operations ───────────────────────────────────────────────────────

export async function isWorktreeDirty(exec: ExecFn, worktreePath: string): Promise<boolean> {
	const result = await gitRaw(exec, ["status", "--porcelain"], worktreePath);
	if (result.code !== 0) return true; // Assume dirty on error
	return result.stdout.trim().length > 0;
}

export async function getAheadBehind(exec: ExecFn, branch: string, base: string, cwd: string): Promise<AheadBehind> {
	const result = await gitRaw(exec, ["rev-list", "--left-right", "--count", `${base}...${branch}`], cwd);
	if (result.code !== 0) return { ahead: 0, behind: 0 };
	const parts = result.stdout.trim().split(/\s+/);
	return {
		ahead: Number.parseInt(parts[0], 10) || 0,
		behind: Number.parseInt(parts[1], 10) || 0,
	};
}

export async function pushBranch(
	exec: ExecFn,
	branch: string,
	cwd: string,
): Promise<{ success: boolean; message: string }> {
	const result = await gitRaw(exec, ["push", "origin", branch], cwd);
	if (result.code === 0) {
		return { success: true, message: result.stdout.trim() || `Pushed ${branch}` };
	}
	return { success: false, message: result.stderr.trim() || result.stdout.trim() };
}

// ── Git Exclude ─────────────────────────────────────────────────────────────

/**
 * Ensure the worktree directory is excluded from git tracking
 * by adding it to .git/info/exclude (not .gitignore — avoids committing).
 */
export async function ensureWorktreeDirExcluded(exec: ExecFn, cwd: string): Promise<void> {
	const mainPath = await getMainWorktreePath(exec, cwd);
	const excludePath = join(mainPath, ".git", "info", "exclude");
	const relPath = `/${WORKTREES_DIR}/`;

	try {
		let content = "";
		if (existsSync(excludePath)) {
			content = readFileSync(excludePath, "utf-8");
		}

		if (content.includes(relPath) || content.includes(WORKTREES_DIR)) {
			return;
		}

		const newEntry = `\n# Worktree directory (added by pure-git)\n${relPath}\n`;
		appendFileSync(excludePath, newEntry);
	} catch {
		// Non-fatal — git tracking exclusion is best-effort
	}
}

// ── Stash Operations ────────────────────────────────────────────────────────

export async function stash(exec: ExecFn, cwd: string): Promise<boolean> {
	const result = await gitRaw(exec, ["stash", "--include-untracked"], cwd);
	return result.code === 0;
}
