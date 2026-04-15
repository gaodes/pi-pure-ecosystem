/**
 * Repository Tools
 *
 * GitHub repository operations: create, clone, fork, list, view, delete, sync
 */

import type { ExecOptions, GHClient } from "./gh-client";

export interface CreateRepoParams {
	name: string;
	visibility?: "public" | "private" | "internal";
	description?: string;
	auto_init?: boolean;
	template?: string;
}

export interface ListReposParams {
	owner?: string;
	limit?: number;
	visibility?: "public" | "private" | "internal";
}

export interface CloneRepoParams {
	owner: string;
	name: string;
	directory?: string;
	branch?: string;
}

export interface ForkRepoParams {
	owner: string;
	name: string;
	default_branch_only?: boolean;
	clone?: boolean;
}

export interface ViewRepoParams {
	owner: string;
	name: string;
}

export interface DeleteRepoParams {
	owner: string;
	name: string;
	confirm: boolean;
}

export interface SyncRepoParams {
	branch?: string;
}

export function createRepoTools(client: GHClient) {
	return {
		async create(params: CreateRepoParams, options?: ExecOptions) {
			// `gh repo create` does NOT support --json. It prints the new repo URL
			// on stdout; callers can follow up with `repo view --json` if they
			// need structured output.
			const args = ["repo", "create", params.name];

			if (params.visibility) {
				args.push(`--${params.visibility}`);
			}
			if (params.description) {
				args.push("--description", params.description);
			}
			if (params.auto_init) {
				args.push("--add-readme");
			}
			if (params.template) {
				args.push("--template", params.template);
			}

			return client.exec(args, options);
		},

		async list(params: ListReposParams = {}, options?: ExecOptions) {
			const args = ["repo", "list"];

			if (params.owner) {
				args.push(params.owner);
			}
			if (params.limit) {
				args.push("--limit", String(params.limit));
			}
			if (params.visibility) {
				args.push("--visibility", params.visibility);
			}

			args.push("--json", "name,description,visibility,updatedAt,owner");

			return client.exec(args, options);
		},

		async clone(params: CloneRepoParams, options?: ExecOptions) {
			const args = ["repo", "clone", `${params.owner}/${params.name}`];

			if (params.directory) {
				args.push(params.directory);
			}
			if (params.branch) {
				args.push("--", "--branch", params.branch);
			}

			return client.exec(args, options);
		},

		async fork(params: ForkRepoParams, options?: ExecOptions) {
			// `gh repo fork` does NOT support --json.
			const args = ["repo", "fork", `${params.owner}/${params.name}`];

			if (params.default_branch_only) {
				args.push("--default-branch-only");
			}
			if (params.clone) {
				args.push("--clone");
			}

			return client.exec(args, options);
		},

		async view(params: ViewRepoParams, options?: ExecOptions) {
			const args = [
				"repo",
				"view",
				`${params.owner}/${params.name}`,
				"--json",
				"name,description,visibility,updatedAt,createdAt,stargazerCount,forkCount,owner,defaultBranchRef",
			];

			return client.exec(args, options);
		},

		async delete(params: DeleteRepoParams, options?: ExecOptions) {
			if (!params.confirm) {
				throw new Error("Repo deletion requires confirm: true");
			}

			const args = [
				"repo",
				"delete",
				`${params.owner}/${params.name}`,
				"--yes",
			];
			return client.exec(args, options);
		},

		async sync(params: SyncRepoParams = {}, options?: ExecOptions) {
			const args = ["repo", "sync"];

			if (params.branch) {
				args.push("--branch", params.branch);
			}

			return client.exec(args, options);
		},
	};
}
