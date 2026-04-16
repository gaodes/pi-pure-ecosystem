/**
 * pure-git — Template variable expansion
 *
 * Replaces {{var}} placeholders in strings with values from context.
 */

import { homedir } from "node:os";

export interface TemplateContext {
	/** Absolute path to the worktree */
	path: string;
	/** Worktree directory name */
	name: string;
	/** Branch name */
	branch: string;
	/** Project name (basename of main worktree) */
	project: string;
	/** Absolute path to the main worktree */
	mainWorktree: string;
	/** Sanitized session ID (for log file names) */
	sessionId?: string;
	/** ISO timestamp (for log file names) */
	timestamp?: string;
}

/**
 * Expand {{var}} placeholders in a template string.
 * Also expands ~/ at the start to the user's home directory.
 */
export function expandTemplate(template: string, ctx: TemplateContext): string {
	return template
		.replace(/\{\{path\}\}/g, ctx.path)
		.replace(/\{\{name\}\}/g, ctx.name)
		.replace(/\{\{branch\}\}/g, ctx.branch)
		.replace(/\{\{project\}\}/g, ctx.project)
		.replace(/\{\{mainWorktree\}\}/g, ctx.mainWorktree)
		.replace(/\{\{sessionId\}\}/g, ctx.sessionId ?? "")
		.replace(/\{\{timestamp\}\}/g, ctx.timestamp ?? "")
		.replace(/^~/, homedir());
}

/**
 * Sanitize a string for use in file paths (log file names etc.).
 */
export function sanitizePathPart(value: string): string {
	return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
