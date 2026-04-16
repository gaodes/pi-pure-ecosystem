/**
 * PR Tools
 *
 * GitHub pull request operations: create, list, view, diff, merge, review, close, checkout
 */

import { GHError } from "./error-handler";
import type { ExecOptions, ExecResult, GHClient } from "./gh-client";

// Clamp list results so a runaway `limit` doesn't drag back thousands of
// PRs. gh's default is 30; 200 is a generous ceiling that covers any
// realistic agent workflow without blowing the output budget.
const MAX_LIMIT = 200;

export interface CreatePRParams {
	repo: string;
	title: string;
	body?: string;
	head: string;
	base: string;
	draft?: boolean;
}

export interface ListPRsParams {
	repo: string;
	state?: "open" | "closed" | "merged" | "all";
	head?: string;
	base?: string;
	author?: string;
	search?: string;
	limit?: number;
}

export interface ViewPRParams {
	repo: string;
	number: number;
}

export interface DiffPRParams {
	repo: string;
	number: number;
}

export interface MergePRParams {
	repo: string;
	number: number;
	method?: "merge" | "squash" | "rebase";
	auto?: boolean;
	delete_branch?: boolean;
}

export interface ReviewPRParams {
	repo: string;
	number: number;
	action: "approve" | "request-changes" | "comment";
	body?: string;
}

export interface ClosePRParams {
	repo: string;
	number: number;
	comment?: string;
}

export interface CheckoutPRParams {
	repo: string;
	number: number;
	branch?: string;
}

export interface ChecksParams {
	repo: string;
	number: number;
	/** If true, blocks until all checks complete (uses `gh pr checks --watch`). */
	watch?: boolean;
	/** If true, only consider required checks (uses `--required`). */
	required?: boolean;
}

export function createPRTools(client: GHClient) {
	return {
		async create(params: CreatePRParams, options?: ExecOptions) {
			// `gh pr create` does NOT support --json. It prints the PR URL on
			// stdout; callers can follow up with `pr view --json` for structured
			// data.
			const args = [
				"pr",
				"create",
				"--repo",
				params.repo,
				"--title",
				params.title,
				"--head",
				params.head,
				"--base",
				params.base,
			];

			if (params.body) {
				args.push("--body", params.body);
			}
			if (params.draft) {
				args.push("--draft");
			}

			return client.exec(args, options);
		},

		async list(params: ListPRsParams, options?: ExecOptions) {
			const args = ["pr", "list", "--repo", params.repo];

			if (params.state) {
				args.push("--state", params.state);
			}
			if (params.head) {
				args.push("--head", params.head);
			}
			if (params.base) {
				args.push("--base", params.base);
			}
			if (params.author) {
				args.push("--author", params.author);
			}
			if (params.search) {
				args.push("--search", params.search);
			}
			if (params.limit) {
				args.push("--limit", String(Math.min(params.limit, MAX_LIMIT)));
			}

			args.push("--json", "number,title,state,author,headRefName,baseRefName,updatedAt,createdAt,url");

			return client.exec(args, options);
		},

		async view(params: ViewPRParams, options?: ExecOptions) {
			const args = [
				"pr",
				"view",
				String(params.number),
				"--repo",
				params.repo,
				"--json",
				"number,title,body,state,author,headRefName,baseRefName,additions,deletions,files,mergedAt,mergedBy,mergeable,statusCheckRollup,comments",
			];

			return client.exec(args, options);
		},

		async diff(params: DiffPRParams, options?: ExecOptions) {
			const args = ["pr", "diff", String(params.number), "--repo", params.repo];
			// diff returns plain text
			return client.exec(args, options);
		},

		async merge(params: MergePRParams, options?: ExecOptions) {
			const args = ["pr", "merge", String(params.number), "--repo", params.repo];

			if (params.method) {
				args.push(`--${params.method}`);
			}
			if (params.auto) {
				args.push("--auto");
			}
			if (params.delete_branch) {
				args.push("--delete-branch");
			}

			return client.exec(args, options);
		},

		async review(params: ReviewPRParams, options?: ExecOptions) {
			// `gh pr review --request-changes` and `--comment` require a
			// non-empty body; callers must validate before reaching this point.
			if (params.action !== "approve" && !params.body) {
				throw new Error(`review action '${params.action}' requires a non-empty body`);
			}

			const args = ["pr", "review", String(params.number), "--repo", params.repo];

			switch (params.action) {
				case "approve":
					args.push("--approve");
					break;
				case "request-changes":
					args.push("--request-changes");
					break;
				case "comment":
					args.push("--comment");
					break;
			}

			if (params.body) {
				args.push("--body", params.body);
			}

			return client.exec(args, options);
		},

		async close(params: ClosePRParams, options?: ExecOptions) {
			const args = ["pr", "close", String(params.number), "--repo", params.repo];

			if (params.comment) {
				args.push("--comment", params.comment);
			}

			return client.exec(args, options);
		},

		async checkout(params: CheckoutPRParams, options?: ExecOptions) {
			const args = ["pr", "checkout", String(params.number), "--repo", params.repo];

			if (params.branch) {
				args.push("--branch", params.branch);
			}

			return client.exec(args, options);
		},

		async checks(params: ChecksParams, options?: ExecOptions): Promise<ExecResult> {
			const args = ["pr", "checks", String(params.number), "--repo", params.repo];
			if (params.watch) args.push("--watch");
			if (params.required) args.push("--required");

			// --watch can run for minutes; default to 10 min, caller-provided
			// options.timeout wins via the spread ordering below.
			const effectiveOptions: ExecOptions | undefined = params.watch ? { timeout: 600_000, ...options } : options;

			try {
				return await client.exec(args, effectiveOptions);
			} catch (err) {
				// Surface failing checks as a structured ExecResult so the caller
				// can read which checks failed (gh prints them on stdout). Other
				// error types (auth, rate limit, not found) still propagate.
				if (err instanceof GHError) {
					return {
						code: err.code,
						stdout: err.stdout,
						stderr: err.message,
					};
				}
				throw err;
			}
		},
	};
}
