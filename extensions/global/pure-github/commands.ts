/**
 * pure-github commands
 *
 * User-triggered TUI commands that complement the LLM tools.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { PiExecFn } from "./gh-client";
import { ghJson } from "./gh-helpers";

interface StatusInfo {
	myPRs: number;
	reviewRequested: number;
	openIssues: number;
	currentPR?: {
		number: number;
		state: string;
		url: string;
	};
	checks?: {
		status: string;
		conclusion?: string;
	};
}

async function getCurrentRepo(exec: PiExecFn, binaryPath: string): Promise<string | null> {
	const result = await ghJson<{ owner: { login: string }; name: string }>(
		exec,
		binaryPath,
		["repo", "view", "--json", "owner,name"],
		{ timeout: 10000 },
	);
	if (result.code !== 0 || !result.data) return null;
	return `${result.data.owner.login}/${result.data.name}`;
}

async function fetchRepoStatus(
	exec: PiExecFn,
	binaryPath: string,
	repo: string,
	branch: string | null,
): Promise<StatusInfo> {
	const [myPRsRes, reviewRes, issuesRes, currentPRRes, checksRes] = await Promise.all([
		ghJson<{ number: number }[]>(
			exec,
			binaryPath,
			["pr", "list", "--repo", repo, "--author", "@me", "--json", "number"],
			{ timeout: 10000 },
		),
		ghJson<{ number: number }[]>(
			exec,
			binaryPath,
			["pr", "list", "--repo", repo, "--search", "review-requested:@me", "--json", "number"],
			{ timeout: 10000 },
		),
		ghJson<{ number: number }[]>(exec, binaryPath, ["issue", "list", "--repo", repo, "--json", "number"], {
			timeout: 10000,
		}),
		branch
			? ghJson<{ number: number; state: string; url: string }>(
					exec,
					binaryPath,
					["pr", "view", branch, "--repo", repo, "--json", "number,state,url"],
					{ timeout: 10000 },
				)
			: Promise.resolve({ code: 1, stdout: "", stderr: "", data: undefined }),
		branch
			? ghJson<{ status: string; conclusion: string }[]>(
					exec,
					binaryPath,
					["run", "list", "--repo", repo, "--branch", branch, "--limit", "1", "--json", "status,conclusion"],
					{ timeout: 10000 },
				)
			: Promise.resolve({ code: 1, stdout: "", stderr: "", data: undefined }),
	]);

	const currentPR = currentPRRes.code === 0 && currentPRRes.data ? currentPRRes.data : undefined;

	const checks =
		checksRes.code === 0 && Array.isArray(checksRes.data) && checksRes.data.length > 0 ? checksRes.data[0] : undefined;

	return {
		myPRs: Array.isArray(myPRsRes.data) ? myPRsRes.data.length : 0,
		reviewRequested: Array.isArray(reviewRes.data) ? reviewRes.data.length : 0,
		openIssues: Array.isArray(issuesRes.data) ? issuesRes.data.length : 0,
		currentPR,
		checks,
	};
}

function formatStatus(info: StatusInfo, repo: string, branch: string | null): string {
	const parts: string[] = [];
	parts.push(`Repo: ${repo}`);
	if (branch) parts.push(`Branch: ${branch}`);
	parts.push(`Open issues: ${info.openIssues}`);
	parts.push(`My PRs: ${info.myPRs} | Review requested: ${info.reviewRequested}`);

	if (info.currentPR) {
		parts.push(`Current PR: #${info.currentPR.number} [${info.currentPR.state}]`);
	} else if (branch) {
		parts.push("Current PR: none");
	}

	if (info.checks) {
		const conclusion = info.checks.conclusion || info.checks.status;
		parts.push(`CI: ${conclusion}`);
	} else if (branch) {
		parts.push("CI: no recent runs");
	}

	return parts.join("\n");
}

export function createGhStatusCommand(
	exec: PiExecFn,
	binaryPath: string,
	getCwd: () => string,
): Parameters<ExtensionAPI["registerCommand"]>[1] {
	return {
		description: "Show repo dashboard: open PRs, issues, current branch PR, CI status",
		handler: async (_args, ctx) => {
			const repo = await getCurrentRepo(exec, binaryPath);
			if (!repo) {
				ctx.ui.notify("Could not determine GitHub repo for current directory.", "warning");
				return;
			}

			const branchResult = await exec("git", ["branch", "--show-current"], {
				timeout: 5000,
				cwd: getCwd(),
			});
			const branch = branchResult.code === 0 ? branchResult.stdout.trim() : null;

			const status = await fetchRepoStatus(exec, binaryPath, repo, branch);
			ctx.ui.notify(formatStatus(status, repo, branch), "info");
		},
	};
}
