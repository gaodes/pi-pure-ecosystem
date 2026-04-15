/**
 * pure-github commands
 *
 * User-triggered TUI commands that complement the LLM tools.
 */

import { DynamicBorder, type ExtensionAPI, type ExtensionContext } from "@mariozechner/pi-coding-agent";
import { Container, Key, matchesKey, Text } from "@mariozechner/pi-tui";
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
		parts.push(`PR URL: ${info.currentPR.url}`);
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

function getCountColor(count: number): "dim" | "accent" | "warning" {
	if (count <= 0) return "dim";
	if (count <= 3) return "accent";
	return "warning";
}

function getCheckTone(checks?: StatusInfo["checks"]): "dim" | "success" | "warning" | "error" | "accent" {
	if (!checks) return "dim";
	const value = (checks.conclusion || checks.status || "").toLowerCase();
	if (["success", "completed"].includes(value)) return "success";
	if (["failure", "failed", "cancelled", "timed_out", "action_required"].includes(value)) return "error";
	if (["queued", "waiting", "requested", "in_progress", "pending", "startup_failure", "stale"].includes(value)) {
		return "warning";
	}
	return "accent";
}

async function showStatusDialog(
	ctx: ExtensionContext,
	repo: string,
	branch: string | null,
	info: StatusInfo,
): Promise<void> {
	await ctx.ui.custom<string | null>((_tui, theme, _kb, done) => ({
		render(width: number) {
			const container = new Container();
			const line = (text: string) => new Text(text, 1, 0);
			const blank = () => new Text("", 0, 0);
			const divider = theme.fg("dim", " • ");
			const currentPrText = info.currentPR
				? `${theme.fg("accent", `#${info.currentPR.number}`)} ${theme.fg("muted", `[${info.currentPR.state}]`)}`
				: branch
					? theme.fg("dim", "none")
					: theme.fg("dim", "n/a");
			const ciText = info.checks
				? theme.fg(getCheckTone(info.checks), info.checks.conclusion || info.checks.status)
				: branch
					? theme.fg("dim", "no recent runs")
					: theme.fg("dim", "n/a");

			container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));
			container.addChild(line(theme.fg("accent", theme.bold("GitHub Status"))));
			container.addChild(
				line(branch ? `${theme.fg("muted", repo)}${divider}${theme.fg("muted", branch)}` : theme.fg("muted", repo)),
			);
			container.addChild(blank());
			container.addChild(
				line(
					`${theme.fg("text", "Open issues")}: ${theme.fg(getCountColor(info.openIssues), String(info.openIssues))}`,
				),
			);
			container.addChild(
				line(`${theme.fg("text", "My PRs")}: ${theme.fg(getCountColor(info.myPRs), String(info.myPRs))}`),
			);
			container.addChild(
				line(
					`${theme.fg("text", "Review requested")}: ${theme.fg(getCountColor(info.reviewRequested), String(info.reviewRequested))}`,
				),
			);
			container.addChild(line(`${theme.fg("text", "Current PR")}: ${currentPrText}`));
			if (info.currentPR?.url) {
				container.addChild(line(`${theme.fg("dim", "URL")}: ${theme.fg("muted", info.currentPR.url)}`));
			}
			container.addChild(line(`${theme.fg("text", "CI")}: ${ciText}`));
			container.addChild(blank());
			container.addChild(line(theme.fg("dim", "enter/esc/q close")));
			container.addChild(new DynamicBorder((str: string) => theme.fg("accent", str)));
			return container.render(width);
		},
		invalidate() {},
		handleInput(data: string) {
			if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape) || data === "q" || data === "Q") {
				done(null);
			}
		},
	}));
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
			if (!ctx.hasUI) {
				ctx.ui.notify(formatStatus(status, repo, branch), "info");
				return;
			}

			await showStatusDialog(ctx, repo, branch, status);
		},
	};
}
