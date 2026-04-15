/**
 * pure-github — GitHub integration for Pi
 *
 * Wraps the `gh` CLI to provide GitHub operations as Pi tools.
 * Forked from @the-forge-flow/gh-pi (https://github.com/MonsieurBarti/GH-PI)
 */

import { StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { defineTool, truncateHead } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { GHNotFoundError, getInstallInstructions } from "./error-handler";
import {
	formatIssueList,
	formatIssueView,
	formatPRList,
	formatPRView,
	formatRepoList,
	formatRepoView,
	formatWorkflowList,
} from "./format";
import { type ExecResult, GHClient } from "./gh-client";
import { createIssueTools } from "./issue-tools";
import { createPRTools } from "./pr-tools";
import { createRepoTools } from "./repo-tools";
import { createWorkflowTools } from "./workflow-tools";

export { GHAuthError, GHError, GHNotFoundError, GHRateLimitError } from "./error-handler";
export type { ExecOptions, ExecResult, PiExecFn } from "./gh-client";
/**
 * Library surface — named exports for consumers who want to use gh-pi's
 * tool factories outside of a PI host (e.g., another PI extension wrapping
 * GitHub operations). The default export below keeps the PI extension
 * behavior unchanged.
 */
export { createGHClient, GHClient } from "./gh-client";
export type {
	CloseIssueParams,
	CommentOnIssueParams,
	CreateIssueParams,
	EditIssueParams,
	ListIssuesParams,
	ReopenIssueParams,
	ViewIssueParams,
} from "./issue-tools";

export { createIssueTools } from "./issue-tools";
export type {
	CheckoutPRParams,
	ChecksParams,
	ClosePRParams,
	CreatePRParams,
	DiffPRParams,
	ListPRsParams,
	MergePRParams,
	ReviewPRParams,
	ViewPRParams,
} from "./pr-tools";
export { createPRTools } from "./pr-tools";
export type {
	CloneRepoParams,
	CreateRepoParams,
	DeleteRepoParams,
	ForkRepoParams,
	ListReposParams,
	SyncRepoParams,
	ViewRepoParams,
} from "./repo-tools";
export { createRepoTools } from "./repo-tools";
export type {
	DisableWorkflowParams,
	EnableWorkflowParams,
	ListWorkflowsParams,
	RunWorkflowParams,
	ViewWorkflowParams,
	WorkflowLogsParams,
} from "./workflow-tools";
export { createWorkflowTools } from "./workflow-tools";

/**
 * Main extension export
 */
export default function pureGithub(pi: ExtensionAPI): void {
	// Per-extension state — scoped to this invocation of the factory so that
	// PI's `/reload` gives us a fresh slate instead of leaking into old
	// handler closures. The `gh` binary path is taken from GH_CLI_PATH when
	// set, so users with a non-standard install can point us at it.
	const binaryPath = process.env.GH_CLI_PATH ?? "gh";
	const state = {
		client: new GHClient({ exec: pi.exec.bind(pi), binaryPath }),
		detectionStatus: "unchecked" as "unchecked" | "missing" | "unauthenticated" | "ready",
	};

	/**
	 * Probe the gh binary (and optionally auth). Caches the result on state.
	 * Never throws — returns the outcome so callers can decide what to do.
	 *
	 * Uses the same binary path as the GHClient so GH_CLI_PATH is honored
	 * end-to-end (probe and tool calls hit the same binary).
	 */
	async function probeBinary(): Promise<typeof state.detectionStatus> {
		const bin = state.client.binaryPath;
		try {
			const versionResult = await pi.exec(bin, ["--version"], { timeout: 5000 });
			if (versionResult.code !== 0) {
				state.detectionStatus = "missing";
				return state.detectionStatus;
			}
		} catch {
			state.detectionStatus = "missing";
			return state.detectionStatus;
		}

		try {
			const authResult = await pi.exec(bin, ["auth", "status"], { timeout: 5000 });
			state.detectionStatus = authResult.code === 0 ? "ready" : "unauthenticated";
		} catch {
			state.detectionStatus = "unauthenticated";
		}

		return state.detectionStatus;
	}

	/**
	 * Guard used by every tool: ensures `gh` is installed and authenticated
	 * before running anything, auto-detecting on first call.
	 */
	async function ensureReady(): Promise<void> {
		if (state.detectionStatus === "unchecked") {
			await probeBinary();
		}
		if (state.detectionStatus === "missing") {
			throw new GHNotFoundError();
		}
		if (state.detectionStatus === "unauthenticated") {
			throw new Error("gh CLI is installed but not authenticated. Run: gh auth login");
		}
	}

	// Session lifecycle — probe on start so we can surface a nice notification,
	// and reset detection on shutdown so a future reload re-probes.
	pi.on("session_start", async (_event, ctx) => {
		const status = await probeBinary();

		if (!ctx.hasUI) return;

		switch (status) {
			case "ready":
				ctx.ui.notify("GitHub CLI ready (authenticated)", "info");
				break;
			case "missing":
				ctx.ui.notify(getInstallInstructions(), "warning");
				break;
			case "unauthenticated":
				ctx.ui.notify("gh CLI is installed but not authenticated. Run: gh auth login", "warning");
				break;
		}

		// Update checks handled by pure-updater extension
	});

	pi.on("session_shutdown", () => {
		state.detectionStatus = "unchecked";
	});

	/**
	 * Render a tool result's stdout/data as a truncated text block.
	 *
	 * PI's extension contract requires outputs to fit in ~50KB/2000 lines;
	 * large gh outputs (pr diff, run logs, json listings) are truncated here
	 * with a trailing notice. Cancelled runs (exit 2) are surfaced explicitly
	 * instead of masquerading as "Success".
	 */
	function formatOutput(
		result: ExecResult,
		options?: { detail?: "summary" | "full"; summaryFormatter?: (data: unknown) => string },
	): string {
		if (result.code === 2) {
			const cancelDetail = result.stderr.trim() || result.stdout.trim();
			return cancelDetail ? `gh command cancelled: ${cancelDetail}` : "gh command cancelled";
		}

		// Summary mode: use the formatter if we have parsed data and a formatter
		if (options?.detail !== "full" && options?.summaryFormatter && result.data != null) {
			return options.summaryFormatter(result.data);
		}

		const raw = result.data ? JSON.stringify(result.data, null, 2) : result.stdout || "Success";

		const truncation = truncateHead(raw);
		if (!truncation.truncated) {
			return raw;
		}

		const reason =
			truncation.truncatedBy === "lines"
				? `${truncation.outputLines} of ${truncation.totalLines} lines`
				: `${truncation.outputBytes} of ${truncation.totalBytes} bytes`;
		return `${truncation.content}\n\n[truncated: showing ${reason}]`;
	}

	// ---------------------------------------------------------------------
	// github_repo
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			// Tool names use github_* prefix for clarity and to coexist
			// other extensions.
			// id is the only thing that changes; the display label stays
			// readable.
			name: "github_repo",
			label: "GitHub Repository",
			description: `Manage GitHub repositories. Actions: create, clone, fork, list, view, delete, sync.

Common patterns:
- List your repos: action "list" (no owner needed)
- List an org's repos: action "list" with owner "org-name"
- View repo details: action "view" with owner and name
- Create from template: action "create" with name and template "owner/template-repo"

Output: returns compact summaries by default. Set detail "full" for raw JSON.
For delete action, confirm: true is required — the tool will reject without it.`,
			promptSnippet: "Work with GitHub repositories",
			promptGuidelines: [
				"github_repo: 'list' and 'view' are read-only (parallel-safe). 'create', 'clone', 'fork', 'delete', 'sync' have side effects — run serially",
				"github_repo: repo names use owner/name format for view, clone, fork, delete. Just the name for create",
			],
			parameters: Type.Object({
				action: StringEnum(["create", "clone", "fork", "list", "view", "delete", "sync"] as const, {
					description: "Repository action to perform",
				}),
				name: Type.Optional(
					Type.String({
						description:
							"Repository name. For create: just the name. For view/delete: the repo name (also requires owner).",
					}),
				),
				owner: Type.Optional(
					Type.String({
						description:
							"Repository owner (username or org). Required for clone, fork, view, delete. Optional for list (filters to that owner's repos).",
					}),
				),
				visibility: Type.Optional(
					StringEnum(["public", "private", "internal"] as const, {
						description: "Repo visibility. For create: sets visibility. For list: filters by visibility.",
					}),
				),
				description: Type.Optional(Type.String({ description: "Repository description" })),
				template: Type.Optional(Type.String({ description: "Template repository to use (owner/repo)" })),
				auto_init: Type.Optional(Type.Boolean({ description: "Initialize with README" })),
				directory: Type.Optional(Type.String({ description: "Clone directory" })),
				branch: Type.Optional(Type.String({ description: "Branch to clone or sync" })),
				default_branch_only: Type.Optional(Type.Boolean({ description: "Fork only default branch" })),
				confirm: Type.Optional(Type.Boolean({ description: "Required for delete. Must be true to confirm deletion." })),
				limit: Type.Optional(Type.Number({ description: "Max results for list. Defaults to 30." })),
				detail: Type.Optional(
					StringEnum(["summary", "full"] as const, {
						description: "Output detail level. 'summary' (default) returns compact text. 'full' returns raw JSON.",
					}),
				),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createRepoTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.name) throw new Error("name is required for create");
						result = await tools.create(
							{
								name: params.name,
								visibility: params.visibility,
								description: params.description,
								auto_init: params.auto_init,
								template: params.template,
							},
							{ signal },
						);
						break;

					case "clone":
						if (!params.owner || !params.name) throw new Error("owner and name are required for clone");
						result = await tools.clone(
							{
								owner: params.owner,
								name: params.name,
								directory: params.directory,
								branch: params.branch,
							},
							{ signal },
						);
						break;

					case "fork":
						if (!params.owner || !params.name) throw new Error("owner and name are required for fork");
						result = await tools.fork(
							{
								owner: params.owner,
								name: params.name,
								default_branch_only: params.default_branch_only,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								owner: params.owner,
								limit: params.limit,
								visibility: params.visibility,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.owner || !params.name) throw new Error("owner and name are required for view");
						result = await tools.view({ owner: params.owner, name: params.name }, { signal });
						break;

					case "delete":
						if (!params.owner || !params.name) throw new Error("owner and name are required for delete");
						result = await tools.delete(
							{
								owner: params.owner,
								name: params.name,
								confirm: params.confirm ?? false,
							},
							{ signal },
						);
						break;

					case "sync":
						result = await tools.sync({ branch: params.branch }, { signal });
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				const summaryFormatters: Record<string, (data: unknown) => string> = {
					list: formatRepoList,
					view: formatRepoView,
				};

				return {
					content: [
						{
							type: "text",
							text: formatOutput(result, {
								detail: params.detail,
								summaryFormatter: summaryFormatters[params.action],
							}),
						},
					],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// github_issue
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "github_issue",
			label: "GitHub Issue",
			description: `Manage GitHub issues. Actions: create, list, view, close, reopen, comment, edit.

Common patterns:
- List open issues: action "list" with repo (defaults to open state)
- Search issues by keyword: action "list" with search "query in:title,body"
- Filter by label: action "list" with labels ["bug"]
- Close as completed: action "close" with number and reason "completed"
- Add labels to existing issue: action "edit" with number and add_labels

Output: returns compact summaries by default. Set detail "full" for raw JSON.
Issue numbers are required for view, close, reopen, comment, edit.`,
			promptSnippet: "Work with GitHub issues",
			promptGuidelines: [
				"github_issue: use 'search' for keyword queries, 'labels' for label filtering, 'state' for state filtering (open/closed/all)",
				"github_issue: 'list' and 'view' are read-only (parallel-safe). 'create', 'close', 'reopen', 'comment', 'edit' have side effects — run serially",
				"github_issue: prefer a single 'list' with search/filters over multiple calls. Do not view each issue individually unless you need full detail",
			],
			parameters: Type.Object({
				action: StringEnum(["create", "list", "view", "close", "reopen", "comment", "edit"] as const, {
					description: "Issue action to perform",
				}),
				repo: Type.String({ description: "Repository in owner/name format" }),
				title: Type.Optional(Type.String({ description: "Issue title (for create)" })),
				body: Type.Optional(Type.String({ description: "Issue body (markdown supported)" })),
				number: Type.Optional(Type.Number({ description: "Issue number (for view, close, etc.)" })),
				state: Type.Optional(
					StringEnum(["open", "closed", "all"] as const, {
						description: "Filter by issue state. Defaults to 'open'.",
					}),
				),
				assignee: Type.Optional(Type.String({ description: "Filter by assignee (list)" })),
				assignees: Type.Optional(Type.Array(Type.String(), { description: "Assignees (create)" })),
				author: Type.Optional(Type.String({ description: "Filter by author" })),
				labels: Type.Optional(Type.Array(Type.String(), { description: "Label names" })),
				search: Type.Optional(
					Type.String({
						description:
							"Search query using GitHub search syntax. E.g., 'login bug in:title', 'label:bug is:open'. Maps to gh --search flag.",
					}),
				),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
				milestone: Type.Optional(Type.String({ description: "Milestone name (create or list filter)" })),
				projects: Type.Optional(Type.Array(Type.String(), { description: "Project names (create)" })),
				comment_text: Type.Optional(Type.String({ description: "Comment text" })),
				reason: Type.Optional(StringEnum(["completed", "not_planned"] as const)),
				add_labels: Type.Optional(Type.Array(Type.String())),
				remove_labels: Type.Optional(Type.Array(Type.String())),
				add_assignees: Type.Optional(Type.Array(Type.String())),
				remove_assignees: Type.Optional(Type.Array(Type.String())),
				detail: Type.Optional(
					StringEnum(["summary", "full"] as const, {
						description: "Output detail level. 'summary' (default) returns compact text. 'full' returns raw JSON.",
					}),
				),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createIssueTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.title) throw new Error("title is required for create");
						result = await tools.create(
							{
								repo: params.repo,
								title: params.title,
								body: params.body,
								labels: params.labels,
								assignees: params.assignees,
								milestone: params.milestone,
								projects: params.projects,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								repo: params.repo,
								state: params.state,
								assignee: params.assignee,
								author: params.author,
								labels: params.labels,
								search: params.search,
								limit: params.limit,
								milestone: params.milestone,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.number) throw new Error("number is required for view");
						result = await tools.view({ repo: params.repo, number: params.number }, { signal });
						break;

					case "close":
						if (!params.number) throw new Error("number is required for close");
						result = await tools.close(
							{
								repo: params.repo,
								number: params.number,
								comment: params.comment_text,
								reason: params.reason,
							},
							{ signal },
						);
						break;

					case "reopen":
						if (!params.number) throw new Error("number is required for reopen");
						result = await tools.reopen({ repo: params.repo, number: params.number }, { signal });
						break;

					case "comment":
						if (!params.number) throw new Error("number is required for comment");
						if (!params.comment_text) throw new Error("comment_text is required for comment");
						result = await tools.comment(
							{
								repo: params.repo,
								number: params.number,
								body: params.comment_text,
							},
							{ signal },
						);
						break;

					case "edit":
						if (!params.number) throw new Error("number is required for edit");
						result = await tools.edit(
							{
								repo: params.repo,
								number: params.number,
								title: params.title,
								body: params.body,
								add_labels: params.add_labels,
								remove_labels: params.remove_labels,
								add_assignees: params.add_assignees,
								remove_assignees: params.remove_assignees,
							},
							{ signal },
						);
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				const summaryFormatters: Record<string, (data: unknown) => string> = {
					list: formatIssueList,
					view: formatIssueView,
				};

				return {
					content: [
						{
							type: "text",
							text: formatOutput(result, {
								detail: params.detail,
								summaryFormatter: summaryFormatters[params.action],
							}),
						},
					],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// github_pr
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "github_pr",
			label: "GitHub Pull Request",
			description: `Manage GitHub pull requests. Actions: create, list, view, diff, merge, review, close, checkout.

Common patterns:
- Find merged PRs: action "list" with state "merged"
- Find PRs by branch: action "list" with head "branch-name"
- Search PRs by keyword: action "list" with search "auth in:title,body"
- Review a PR: first "view" to read it, then "diff" for changes, then "review"
- Create a PR: requires title, head (source branch), and base (target branch)

Output: returns compact summaries by default. Set detail "full" for raw JSON when you need specific field values.
Do NOT chain list then view for every item. Use search/filters to narrow results first.`,
			promptSnippet: "Work with GitHub pull requests",
			promptGuidelines: [
				"github_pr: use 'state' param to filter PRs (open/closed/merged/all), use 'search' for keyword queries",
				"github_pr: 'list', 'view', 'diff' are read-only (parallel-safe). 'create', 'merge', 'review', 'close', 'checkout' have side effects — run serially",
				"github_pr: prefer a single 'list' with search/filters over multiple calls. Do not view each PR individually unless you need full detail",
			],
			parameters: Type.Object({
				action: StringEnum(["create", "list", "view", "diff", "merge", "review", "close", "checkout"] as const, {
					description: "PR action to perform",
				}),
				repo: Type.String({ description: "Repository in owner/name format" }),
				title: Type.Optional(Type.String({ description: "PR title (for create)" })),
				body: Type.Optional(Type.String({ description: "PR body or review body" })),
				head: Type.Optional(
					Type.String({
						description: "Head (source) branch. For create: required. For list: filters by head branch name.",
					}),
				),
				base: Type.Optional(
					Type.String({
						description: "Base (target) branch. For create: required. For list: filters by base branch name.",
					}),
				),
				author: Type.Optional(Type.String({ description: "Filter by author (list)" })),
				search: Type.Optional(
					Type.String({
						description:
							"Search query using GitHub search syntax. E.g., 'auth in:title', 'label:bug sort:updated-desc'. Maps to gh --search flag.",
					}),
				),
				number: Type.Optional(Type.Number({ description: "PR number" })),
				state: Type.Optional(
					StringEnum(["open", "closed", "merged", "all"] as const, {
						description: "Filter by PR state. Use 'merged' to find merged PRs. Defaults to 'open'.",
					}),
				),
				draft: Type.Optional(Type.Boolean()),
				method: Type.Optional(
					StringEnum(["merge", "squash", "rebase"] as const, {
						description: "Merge method. Defaults to the repo's configured default.",
					}),
				),
				auto: Type.Optional(Type.Boolean({ description: "Enable auto-merge" })),
				delete_branch: Type.Optional(Type.Boolean()),
				review_action: Type.Optional(
					StringEnum(["approve", "request-changes", "comment"] as const, {
						description: "Review action. 'request-changes' and 'comment' require a non-empty body.",
					}),
				),
				comment_text: Type.Optional(Type.String({ description: "Comment for close" })),
				branch: Type.Optional(Type.String({ description: "Checkout branch name" })),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
				detail: Type.Optional(
					StringEnum(["summary", "full"] as const, {
						description: "Output detail level. 'summary' (default) returns compact text. 'full' returns raw JSON.",
					}),
				),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createPRTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "create":
						if (!params.title) throw new Error("title is required for create");
						if (!params.head) throw new Error("head is required for create");
						if (!params.base) throw new Error("base is required for create");
						result = await tools.create(
							{
								repo: params.repo,
								title: params.title,
								body: params.body,
								head: params.head,
								base: params.base,
								draft: params.draft,
							},
							{ signal },
						);
						break;

					case "list":
						result = await tools.list(
							{
								repo: params.repo,
								state: params.state,
								head: params.head,
								base: params.base,
								author: params.author,
								search: params.search,
								limit: params.limit,
							},
							{ signal },
						);
						break;

					case "view":
						if (!params.number) throw new Error("number is required for view");
						result = await tools.view({ repo: params.repo, number: params.number }, { signal });
						break;

					case "diff":
						if (!params.number) throw new Error("number is required for diff");
						result = await tools.diff({ repo: params.repo, number: params.number }, { signal });
						break;

					case "merge":
						if (!params.number) throw new Error("number is required for merge");
						result = await tools.merge(
							{
								repo: params.repo,
								number: params.number,
								method: params.method,
								auto: params.auto,
								delete_branch: params.delete_branch,
							},
							{ signal },
						);
						break;

					case "review": {
						if (!params.number) throw new Error("number is required for review");
						if (!params.review_action) throw new Error("review_action is required for review");
						if (params.review_action !== "approve" && !params.body) {
							throw new Error(`review_action '${params.review_action}' requires a non-empty body`);
						}
						result = await tools.review(
							{
								repo: params.repo,
								number: params.number,
								action: params.review_action,
								body: params.body,
							},
							{ signal },
						);
						break;
					}

					case "close":
						if (!params.number) throw new Error("number is required for close");
						result = await tools.close(
							{
								repo: params.repo,
								number: params.number,
								comment: params.comment_text,
							},
							{ signal },
						);
						break;

					case "checkout":
						if (!params.number) throw new Error("number is required for checkout");
						result = await tools.checkout(
							{
								repo: params.repo,
								number: params.number,
								branch: params.branch,
							},
							{ signal },
						);
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				const summaryFormatters: Record<string, (data: unknown) => string> = {
					list: formatPRList,
					view: formatPRView,
				};

				return {
					content: [
						{
							type: "text",
							text: formatOutput(result, {
								detail: params.detail,
								summaryFormatter: summaryFormatters[params.action],
							}),
						},
					],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);

	// ---------------------------------------------------------------------
	// github_workflow
	// ---------------------------------------------------------------------
	pi.registerTool(
		defineTool({
			name: "github_workflow",
			label: "GitHub Workflow",
			description: `Manage GitHub Actions workflows. Actions: list, view, run, logs, disable, enable.

Common patterns:
- List workflows: action "list" with repo
- View workflow YAML: action "view" with workflow name or filename
- Trigger a run: action "run" with workflow name and optional branch/inputs
- Get run logs: action "logs" with run_id (get run_id from GitHub or PR checks)

Output: returns compact summaries by default for list. view and logs return raw text.
Workflow can be referenced by name, numeric ID, or filename (e.g., "ci.yml").`,
			promptSnippet: "Work with GitHub Actions workflows",
			promptGuidelines: [
				"github_workflow: 'list', 'view', 'logs' are read-only (parallel-safe). 'run', 'disable', 'enable' have side effects — run serially",
				"github_workflow: workflow param accepts name, numeric ID, or filename (e.g., 'ci.yml'). run_id is required for logs",
			],
			parameters: Type.Object({
				action: StringEnum(["list", "view", "run", "logs", "disable", "enable"] as const, {
					description: "Workflow action to perform",
				}),
				repo: Type.String({ description: "Repository in owner/name format" }),
				workflow: Type.Optional(
					Type.String({
						description:
							"Workflow name, numeric ID, or filename (e.g., 'ci.yml'). Required for view, run, disable, enable.",
					}),
				),
				branch: Type.Optional(Type.String({ description: "Branch for workflow run" })),
				inputs: Type.Optional(Type.Record(Type.String(), Type.String(), { description: "Workflow inputs" })),
				run_id: Type.Optional(
					Type.String({
						description: "Workflow run ID. Required for logs. Get this from GitHub UI or PR status checks.",
					}),
				),
				limit: Type.Optional(Type.Number({ description: "Max results for list" })),
				detail: Type.Optional(
					StringEnum(["summary", "full"] as const, {
						description: "Output detail level. 'summary' (default) returns compact text. 'full' returns raw JSON.",
					}),
				),
			}),

			async execute(_toolCallId, params, signal) {
				await ensureReady();

				const tools = createWorkflowTools(state.client);
				let result: ExecResult;

				switch (params.action) {
					case "list":
						result = await tools.list({ repo: params.repo, limit: params.limit }, { signal });
						break;

					case "view":
						if (!params.workflow) throw new Error("workflow is required for view");
						result = await tools.view({ repo: params.repo, workflow: params.workflow }, { signal });
						break;

					case "run":
						if (!params.workflow) throw new Error("workflow is required for run");
						result = await tools.run(
							{
								repo: params.repo,
								workflow: params.workflow,
								branch: params.branch,
								inputs: params.inputs,
							},
							{ signal },
						);
						break;

					case "logs":
						if (!params.run_id) throw new Error("run_id is required for logs");
						result = await tools.logs({ repo: params.repo, run_id: params.run_id }, { signal });
						break;

					case "disable":
						if (!params.workflow) throw new Error("workflow is required for disable");
						result = await tools.disable({ repo: params.repo, workflow: params.workflow }, { signal });
						break;

					case "enable":
						if (!params.workflow) throw new Error("workflow is required for enable");
						result = await tools.enable({ repo: params.repo, workflow: params.workflow }, { signal });
						break;

					default:
						throw new Error(`Unknown action: ${params.action}`);
				}

				const summaryFormatters: Record<string, (data: unknown) => string> = {
					list: formatWorkflowList,
				};

				return {
					content: [
						{
							type: "text",
							text: formatOutput(result, {
								detail: params.detail,
								summaryFormatter: summaryFormatters[params.action],
							}),
						},
					],
					details: { action: params.action, code: result.code },
				};
			},
		}),
	);
}
