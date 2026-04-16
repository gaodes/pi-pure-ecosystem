/**
 * pure-git — Git tools for Pi extension development
 *
 * Provides /worktrees command and switch_worktree tool for managing Git worktrees.
 */

import type { ExtensionAPI, ToolDefinition } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { registerWorktreesCommand, switchToWorktree } from "./commands/worktrees";
import type { ExecFn } from "./services/git";

// ── Tool parameters ──────────────────────────────────────────────────────────

const SwitchWorktreeParams = Type.Object({
	name: Type.String({ description: "Worktree name (branch name or directory name)" }),
});

// Static<typeof SwitchWorktreeParams> inferred by ToolDefinition

// ── Tool registration ────────────────────────────────────────────────────────

function registerSwitchWorktreeTool(pi: ExtensionAPI, exec: ExecFn): void {
	const tool: ToolDefinition<typeof SwitchWorktreeParams, undefined> = {
		name: "switch_worktree",
		label: "Switch Worktree",
		description:
			"Switch the current Pi session to a worktree. Resolves the worktree by name, runs the onSwitch hook if configured, finds the most recent session for the worktree's directory, and switches to it. Returns an error if no session exists (user needs to start one first with `cd <worktree-path> && pi`).",
		parameters: SwitchWorktreeParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			const result = await switchToWorktree({
				name: params.name,
				ctx,
				exec,
			});

			if (!result.success) {
				throw new Error(result.message);
			}

			return result.message;
		},
	};

	pi.registerTool(tool);
}

// ── Extension entry point ────────────────────────────────────────────────────

export default function pureGit(pi: ExtensionAPI): void {
	registerWorktreesCommand(pi, pi.exec.bind(pi));
	registerSwitchWorktreeTool(pi, pi.exec.bind(pi));
}
