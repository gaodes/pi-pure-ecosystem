/**
 * Workflow Tools
 *
 * GitHub Actions workflow operations: list, view, run, logs, disable, enable
 */

import type { ExecOptions, GHClient } from "./gh-client";

export interface ListWorkflowsParams {
	repo: string;
	limit?: number;
}

export interface ViewWorkflowParams {
	repo: string;
	workflow: string; // name, ID, or filename
}

export interface RunWorkflowParams {
	repo: string;
	workflow: string;
	branch?: string;
	inputs?: Record<string, string>;
}

export interface WorkflowLogsParams {
	repo: string;
	run_id: string;
	job?: string;
}

export interface DisableWorkflowParams {
	repo: string;
	workflow: string;
}

export interface EnableWorkflowParams {
	repo: string;
	workflow: string;
}

export function createWorkflowTools(client: GHClient) {
	return {
		async list(params: ListWorkflowsParams, options?: ExecOptions) {
			const args = ["workflow", "list", "--repo", params.repo];

			if (params.limit) {
				args.push("--limit", String(params.limit));
			}

			// Only id, name, path are valid --json fields for workflow list.
			args.push("--json", "id,name,path");

			return client.exec(args, options);
		},

		async view(params: ViewWorkflowParams, options?: ExecOptions) {
			const args = [
				"workflow",
				"view",
				params.workflow,
				"--repo",
				params.repo,
				"--yaml",
			];

			return client.exec(args, options);
		},

		async run(params: RunWorkflowParams, options?: ExecOptions) {
			const args = ["workflow", "run", params.workflow, "--repo", params.repo];

			if (params.branch) {
				args.push("--ref", params.branch);
			}

			if (params.inputs) {
				for (const [key, value] of Object.entries(params.inputs)) {
					args.push("--field", `${key}=${value}`);
				}
			}

			return client.exec(args, options);
		},

		async logs(params: WorkflowLogsParams, options?: ExecOptions) {
			const args = [
				"run",
				"view",
				params.run_id,
				"--repo",
				params.repo,
				"--log",
			];

			if (params.job) {
				args.push("--job", params.job);
			}

			return client.exec(args, options);
		},

		async disable(params: DisableWorkflowParams, options?: ExecOptions) {
			const args = [
				"workflow",
				"disable",
				params.workflow,
				"--repo",
				params.repo,
			];
			return client.exec(args, options);
		},

		async enable(params: EnableWorkflowParams, options?: ExecOptions) {
			const args = [
				"workflow",
				"enable",
				params.workflow,
				"--repo",
				params.repo,
			];
			return client.exec(args, options);
		},
	};
}
