/**
 * pure-git — Git tools for Pi extension development
 *
 * Provides /worktrees command for managing Git worktrees.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerWorktreesCommand } from "./commands/worktrees";

export default function pureGit(pi: ExtensionAPI): void {
	registerWorktreesCommand(pi, pi.exec.bind(pi));
}
