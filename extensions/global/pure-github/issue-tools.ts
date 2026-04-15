/**
 * Issue Tools
 *
 * GitHub issue operations: create, list, view, close, reopen, comment, edit
 */

import type { ExecOptions, GHClient } from "./gh-client";

const MAX_LIMIT = 200;

export interface CreateIssueParams {
	repo: string;
	title: string;
	body?: string;
	labels?: string[];
	assignees?: string[];
	milestone?: string;
	projects?: string[];
}

export interface ListIssuesParams {
	repo: string;
	state?: "open" | "closed" | "all";
	assignee?: string;
	author?: string;
	labels?: string[];
	search?: string;
	limit?: number;
	milestone?: string;
	project?: string;
}

export interface ViewIssueParams {
	repo: string;
	number: number;
}

export interface CloseIssueParams {
	repo: string;
	number: number;
	comment?: string;
	reason?: "completed" | "not planned";
}

export interface ReopenIssueParams {
	repo: string;
	number: number;
}

export interface CommentOnIssueParams {
	repo: string;
	number: number;
	body: string;
}

export interface EditIssueParams {
	repo: string;
	number: number;
	title?: string;
	body?: string;
	add_labels?: string[];
	remove_labels?: string[];
	add_assignees?: string[];
	remove_assignees?: string[];
}

export function createIssueTools(client: GHClient) {
	return {
		async create(params: CreateIssueParams, options?: ExecOptions) {
			// `gh issue create` does NOT support --json. It prints the issue URL
			// on stdout; callers can follow up with `issue view --json` for
			// structured data.
			const args = ["issue", "create", "--repo", params.repo, "--title", params.title];

			if (params.body) {
				args.push("--body", params.body);
			}
			if (params.labels?.length) {
				args.push("--label", params.labels.join(","));
			}
			if (params.assignees?.length) {
				args.push("--assignee", params.assignees.join(","));
			}
			if (params.milestone) {
				args.push("--milestone", params.milestone);
			}
			if (params.projects?.length) {
				args.push("--project", params.projects.join(","));
			}

			return client.exec(args, options);
		},

		async list(params: ListIssuesParams, options?: ExecOptions) {
			const args = ["issue", "list", "--repo", params.repo];

			if (params.state) {
				args.push("--state", params.state);
			}
			if (params.assignee) {
				args.push("--assignee", params.assignee);
			}
			if (params.author) {
				args.push("--author", params.author);
			}
			if (params.labels?.length) {
				args.push("--label", params.labels.join(","));
			}
			if (params.search) {
				args.push("--search", params.search);
			}
			if (params.limit) {
				args.push("--limit", String(Math.min(params.limit, MAX_LIMIT)));
			}
			if (params.milestone) {
				args.push("--milestone", params.milestone);
			}
			if (params.project) {
				args.push("--project", params.project);
			}

			args.push("--json", "number,title,state,author,updatedAt,createdAt,labels");

			return client.exec(args, options);
		},

		async view(params: ViewIssueParams, options?: ExecOptions) {
			const args = [
				"issue",
				"view",
				String(params.number),
				"--repo",
				params.repo,
				"--json",
				"number,title,body,state,author,createdAt,updatedAt,comments,labels,assignees",
			];

			return client.exec(args, options);
		},

		async close(params: CloseIssueParams, options?: ExecOptions) {
			const args = ["issue", "close", String(params.number), "--repo", params.repo];

			if (params.comment) {
				args.push("--comment", params.comment);
			}
			if (params.reason) {
				args.push("--reason", params.reason);
			}

			return client.exec(args, options);
		},

		async reopen(params: ReopenIssueParams, options?: ExecOptions) {
			const args = ["issue", "reopen", String(params.number), "--repo", params.repo];
			return client.exec(args, options);
		},

		async comment(params: CommentOnIssueParams, options?: ExecOptions) {
			const args = ["issue", "comment", String(params.number), "--repo", params.repo, "--body", params.body];
			return client.exec(args, options);
		},

		async edit(params: EditIssueParams, options?: ExecOptions) {
			const args = ["issue", "edit", String(params.number), "--repo", params.repo];

			if (params.title) {
				args.push("--title", params.title);
			}
			if (params.body) {
				args.push("--body", params.body);
			}
			if (params.add_labels?.length) {
				args.push("--add-label", params.add_labels.join(","));
			}
			if (params.remove_labels?.length) {
				args.push("--remove-label", params.remove_labels.join(","));
			}
			if (params.add_assignees?.length) {
				args.push("--add-assignee", params.add_assignees.join(","));
			}
			if (params.remove_assignees?.length) {
				args.push("--remove-assignee", params.remove_assignees.join(","));
			}

			return client.exec(args, options);
		},
	};
}
