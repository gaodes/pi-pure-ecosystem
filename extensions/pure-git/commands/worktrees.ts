/**
 * pure-git — /worktrees command handler
 *
 * Subcommands: create <name> [base], list, clean <name>
 */

import {
	DynamicBorder,
	type ExtensionAPI,
	type ExtensionCommandContext,
	SessionManager,
} from "@mariozechner/pi-coding-agent";
import { Container, type SelectItem, SelectList, Text } from "@mariozechner/pi-tui";
import type { ExecFn } from "../services/git";
import {
	type AheadBehind,
	branchExists,
	checkoutBranch,
	createBranch,
	createWorktree,
	deleteBranch,
	ensureWorktreeDirExcluded,
	getAheadBehind,
	getCurrentBranch,
	getMainBranch,
	getMainWorktreePath,
	getWorktreePath,
	isGitRepo,
	isWorktreeDirty,
	listWorktrees,
	mergeBranch,
	pushBranch,
	removeWorktree,
	type WorktreeInfo,
} from "../services/git";

// ── Types ────────────────────────────────────────────────────────────────────

interface CommandContext {
	args: string;
	ctx: ExtensionCommandContext;
	exec: ExecFn;
	pi: ExtensionAPI;
}

// ── Argument Parsing ─────────────────────────────────────────────────────────

function parseArgs(raw: string): { action: string; name: string; extra: string } | null {
	const parts = raw.trim().split(/\s+/);
	if (parts.length === 0 || !parts[0]) return null;

	return {
		action: parts[0],
		name: parts[1] ?? "",
		extra: parts.slice(2).join(" ") ?? "",
	};
}

// ── Validation ───────────────────────────────────────────────────────────────

const VALID_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

function validateWorktreeName(name: string): string | null {
	if (!name) return "Worktree name is required";
	if (!VALID_NAME.test(name))
		return "Name must start with alphanumeric and contain only letters, digits, hyphens, dots, underscores";
	if (name.length > 64) return "Name too long (max 64 characters)";
	return null;
}

// ── Formatting ───────────────────────────────────────────────────────────────

function formatWorktreeEntry(worktree: WorktreeInfo, aheadBehind?: AheadBehind, dirty?: boolean): string {
	const markers: string[] = [];
	if (worktree.isMain) markers.push("main");
	if (worktree.isCurrent) markers.push("current");
	if (dirty) markers.push("dirty");

	const abStr = aheadBehind
		? aheadBehind.ahead > 0 || aheadBehind.behind > 0
			? `${aheadBehind.ahead}↑ ${aheadBehind.behind}↓`
			: ""
		: "";

	const markerStr = markers.length > 0 ? ` (${markers.join(", ")})` : "";
	const abStrFormatted = abStr ? ` ${abStr}` : "";

	return `  ${worktree.isCurrent ? "→" : " "} ${worktree.branch.padEnd(24)} ${worktree.path}${markerStr}${abStrFormatted}`;
}

// ── Subcommand: create ──────────────────────────────────────────────────────

async function handleCreate(c: CommandContext): Promise<void> {
	const { ctx, exec } = c;
	const name = c.args;

	const nameError = validateWorktreeName(name);
	if (nameError) {
		ctx.ui.notify(nameError, "error");
		return;
	}

	if (!(await isGitRepo(exec, ctx.cwd))) {
		ctx.ui.notify("Not in a git repository", "error");
		return;
	}

	// Determine base branch: default to current branch
	const baseBranch = c.extra || (await getCurrentBranch(exec, ctx.cwd));

	// Check if branch already exists
	if (await branchExists(exec, name, ctx.cwd)) {
		ctx.ui.notify(`Branch '${name}' already exists. Use a different name.`, "error");
		return;
	}

	// Check if worktree directory already exists
	const mainPath = await getMainWorktreePath(exec, ctx.cwd);
	const worktreePath = getWorktreePath(mainPath, name);
	const worktrees = await listWorktrees(exec, ctx.cwd);
	const existing = worktrees.find((wt) => wt.path === worktreePath || wt.branch === name);
	if (existing) {
		ctx.ui.notify(`Worktree already exists: ${existing.path} (${existing.branch})`, "error");
		return;
	}

	// Create branch from base
	try {
		await createBranch(exec, name, baseBranch, ctx.cwd);
	} catch (err) {
		ctx.ui.notify(`Failed to create branch: ${(err as Error).message}`, "error");
		return;
	}

	// Create worktree
	try {
		await createWorktree(exec, worktreePath, name, ctx.cwd);
	} catch (err) {
		// Cleanup: delete the branch we just created
		try {
			await deleteBranch(exec, name, ctx.cwd);
		} catch {}
		ctx.ui.notify(`Failed to create worktree: ${(err as Error).message}`, "error");
		return;
	}

	// Ensure .worktrees/ is excluded from git tracking
	await ensureWorktreeDirExcluded(exec, ctx.cwd);

	ctx.ui.notify(
		[
			`✓ Created worktree: ${name}`,
			`  Branch: ${name} (from ${baseBranch})`,
			`  Path:   ${worktreePath}`,
			``,
			`  cd ${worktreePath}`,
		].join("\n"),
		"info",
	);
}

// ── Subcommand: list ────────────────────────────────────────────────────────

async function handleList(c: CommandContext): Promise<void> {
	const { ctx, exec } = c;

	if (!(await isGitRepo(exec, ctx.cwd))) {
		ctx.ui.notify("Not in a git repository", "error");
		return;
	}

	const worktrees = await listWorktrees(exec, ctx.cwd);
	if (worktrees.length === 0) {
		ctx.ui.notify("No worktrees found", "info");
		return;
	}

	const mainBranch = await getMainBranch(exec, ctx.cwd);
	const lines = ["Worktrees:", ""];

	for (const wt of worktrees) {
		const dirty = wt.isCurrent
			? await isWorktreeDirty(exec, wt.path).catch(() => true)
			: await isWorktreeDirty(exec, wt.path).catch(() => undefined);
		let aheadBehind: AheadBehind | undefined;
		if (!wt.isMain && wt.branch !== "HEAD (detached)") {
			aheadBehind = await getAheadBehind(exec, wt.branch, mainBranch, ctx.cwd).catch(() => undefined);
		}
		lines.push(formatWorktreeEntry(wt, aheadBehind, dirty));
	}

	ctx.ui.notify(lines.join("\n"), "info");
}

// ── Subcommand: clean ───────────────────────────────────────────────────────

async function handleClean(c: CommandContext): Promise<void> {
	const { ctx, exec } = c;
	const name = c.args.trim();

	if (!name) {
		ctx.ui.notify("Usage: /worktrees clean <name>", "error");
		return;
	}

	if (!(await isGitRepo(exec, ctx.cwd))) {
		ctx.ui.notify("Not in a git repository", "error");
		return;
	}

	const worktrees = await listWorktrees(exec, ctx.cwd);
	const mainPath = await getMainWorktreePath(exec, ctx.cwd);
	const worktreePath = getWorktreePath(mainPath, name);

	// Find target worktree
	const target = worktrees.find((wt) => wt.branch === name || wt.path === worktreePath || wt.path.endsWith(`/${name}`));

	if (!target) {
		ctx.ui.notify(`Worktree not found: ${name}`, "error");
		return;
	}

	// Safety checks
	if (target.isMain) {
		ctx.ui.notify("Cannot remove the main worktree", "error");
		return;
	}
	if (target.isCurrent) {
		ctx.ui.notify("Cannot remove the current worktree. Switch to another first.", "error");
		return;
	}

	// Choose action
	const choice = await ctx.ui.select(`Clean ${target.branch}`, [
		"Merge and delete (merge into main, then remove worktree + branch)",
		"Merge only (merge into main, keep worktree + branch)",
		"Delete only (remove worktree + branch, no merge)",
	]);
	if (choice === undefined) {
		ctx.ui.notify("Cancelled", "info");
		return;
	}

	const doMerge = choice.startsWith("Merge and delete") || choice.startsWith("Merge only");
	const doDelete = choice.startsWith("Merge and delete") || choice.startsWith("Delete only");

	const mainBranch = await getMainBranch(exec, ctx.cwd);
	const steps: string[] = [];

	// Switch to main (needed for merge and/or clean branch deletion)
	try {
		await checkoutBranch(exec, mainBranch, ctx.cwd);
		steps.push(`✓ Switched to ${mainBranch}`);
	} catch (err) {
		ctx.ui.notify(`Failed to checkout ${mainBranch}: ${(err as Error).message}`, "error");
		return;
	}

	// Merge
	if (doMerge) {
		const mergeResult = await mergeBranch(exec, target.branch, ctx.cwd);
		if (mergeResult.status === "conflict") {
			ctx.ui.notify("Merge conflicts detected. Aborted. Resolve conflicts and try again.", "error");
			return;
		}
		if (!mergeResult.success) {
			ctx.ui.notify(`Merge failed: ${mergeResult.message}`, "error");
			return;
		}
		steps.push(
			mergeResult.status === "already-up-to-date"
				? "✓ Already up-to-date (nothing to merge)"
				: `✓ Merged ${target.branch} into ${mainBranch}`,
		);

		// Push after merge
		const pushResult = await pushBranch(exec, mainBranch, ctx.cwd);
		if (pushResult.success) {
			steps.push(`✓ Pushed ${mainBranch} to origin`);
		} else {
			steps.push(`⚠ Push failed: ${pushResult.message}`);
		}
	}

	// Delete
	if (doDelete) {
		// Remove worktree
		try {
			const dirty = await isWorktreeDirty(exec, target.path).catch(() => true);
			await removeWorktree(exec, target.path, ctx.cwd, dirty);
			steps.push(`✓ Removed worktree: ${target.path}`);
		} catch (err) {
			ctx.ui.notify(`Failed to remove worktree: ${(err as Error).message}`, "error");
			return;
		}

		// Delete branch
		try {
			await deleteBranch(exec, target.branch, ctx.cwd);
			steps.push(`✓ Deleted branch: ${target.branch}`);
		} catch (err) {
			steps.push(`⚠ Could not delete branch: ${(err as Error).message}`);
		}
	}

	ctx.ui.notify(`Cleaned ${name}:\n${steps.map((s) => `  ${s}`).join("\n")}`, "info");
}

// ── Worktree Browser (TUI) ───────────────────────────────────────────────

interface WorktreeItem {
	worktree: WorktreeInfo;
	dirty?: boolean;
	aheadBehind?: AheadBehind;
}

type BrowserAction = "switch" | "create" | "delete" | "merge" | "merge_delete" | "cancel";

type BrowserResult = { action: BrowserAction; index?: number };

async function browseWorktrees(c: CommandContext): Promise<void> {
	const { ctx, exec, pi } = c;

	if (!(await isGitRepo(exec, ctx.cwd))) {
		ctx.ui.notify("Not in a git repository", "error");
		return;
	}

	let worktrees = await listWorktrees(exec, ctx.cwd);
	if (worktrees.length === 0) {
		ctx.ui.notify("No worktrees found. Press 'c' to create one.", "info");
	}

	// Main browser loop — refreshes after each action
	while (true) {
		// Gather status for each worktree
		const mainBranch = await getMainBranch(exec, ctx.cwd);
		const items: WorktreeItem[] = [];
		for (const wt of worktrees) {
			const dirty = await isWorktreeDirty(exec, wt.path).catch(() => undefined);
			let aheadBehind: AheadBehind | undefined;
			if (!wt.isMain && wt.branch !== "HEAD (detached)") {
				aheadBehind = await getAheadBehind(exec, wt.branch, mainBranch, ctx.cwd).catch(() => undefined);
			}
			items.push({ worktree: wt, dirty, aheadBehind });
		}

		// Build SelectList items
		const selectItems: SelectItem[] = items.map((item, i) => {
			const wt = item.worktree;
			const markers: string[] = [];
			if (wt.isMain) markers.push("main");
			if (item.dirty) markers.push("dirty");
			const abParts: string[] = [];
			if (item.aheadBehind) {
				if (item.aheadBehind.ahead > 0) abParts.push(`${item.aheadBehind.ahead}↑`);
				if (item.aheadBehind.behind > 0) abParts.push(`${item.aheadBehind.behind}↓`);
			}
			if (abParts.length > 0) markers.push(abParts.join(" "));

			const desc = markers.length > 0 ? markers.join(", ") : "clean";
			return {
				value: String(i),
				label: wt.branch,
				description: desc,
			};
		});

		const result = await ctx.ui.custom<BrowserResult>((tui, theme, _kb, done) => {
			const container = new Container();

			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));
			container.addChild(
				new Text(
					theme.fg("accent", theme.bold("Worktrees")) +
						theme.fg("dim", ` — ${items.length} worktree${items.length !== 1 ? "s" : ""}`),
				),
			);

			const selectList = new SelectList(selectItems, Math.min(selectItems.length, 10), {
				selectedPrefix: (t: string) => theme.fg("accent", t),
				selectedText: (t: string) => theme.fg("accent", t),
				description: (t: string) => theme.fg("muted", t),
				scrollInfo: (t: string) => theme.fg("dim", t),
				noMatch: (t: string) => theme.fg("warning", t),
			});

			selectList.onSelect = (item) => done({ action: "switch", index: Number(item.value) });
			selectList.onCancel = () => done({ action: "cancel" });

			container.addChild(selectList);
			container.addChild(
				new Text(
					theme.fg("dim", "↑↓ navigate · ⏎ switch · c create · d delete · m merge · x merge+delete · Esc cancel"),
				),
			);
			container.addChild(new DynamicBorder((s: string) => theme.fg("accent", s)));

			return {
				render(width: number) {
					return container.render(width);
				},
				invalidate() {
					container.invalidate();
				},
				handleInput(data: string) {
					if (data === "c") {
						done({ action: "create" });
						return;
					}
					if (data === "d") {
						const sel = selectList.getSelectedItem();
						if (sel) done({ action: "delete", index: Number(sel.value) });
						return;
					}
					if (data === "m") {
						const sel = selectList.getSelectedItem();
						if (sel) done({ action: "merge", index: Number(sel.value) });
						return;
					}
					if (data === "x") {
						const sel = selectList.getSelectedItem();
						if (sel) done({ action: "merge_delete", index: Number(sel.value) });
						return;
					}
					selectList.handleInput(data);
					tui.requestRender();
				},
			};
		});

		if (!result || result.action === "cancel") return;

		// ── Switch ─────────────────────────────────────────────────────
		if (result.action === "switch") {
			const target = items[result.index!];
			if (!target) continue;
			if (target.worktree.isCurrent) {
				ctx.ui.notify("Already in this worktree.", "info");
				continue;
			}

			const wtPath = target.worktree.path;
			const wtBranch = target.worktree.branch;

			// Find most recent session for this worktree's cwd
			const sessions = await SessionManager.list(wtPath);
			const session = sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime())[0];

			if (session) {
				const res = await ctx.switchSession(session.path);
				if (!res.cancelled) {
					ctx.ui.notify(`Switched to ${wtBranch} — resumed session`, "info");
					return;
				}
			} else {
				const dirty = target.dirty ? " (dirty)" : "";
				const abParts: string[] = [];
				if (target.aheadBehind) {
					if (target.aheadBehind.ahead > 0) abParts.push(`${target.aheadBehind.ahead}↑`);
					if (target.aheadBehind.behind > 0) abParts.push(`${target.aheadBehind.behind}↓`);
				}
				const ab = abParts.length > 0 ? `, ${abParts.join(" ")}` : "";
				ctx.ui.notify(
					[
						`📂 ${wtBranch}${dirty}${ab}`,
						`   Path: ${wtPath}`,
						"",
						"No session found for this worktree.",
						"Start a new Pi session there to create one.",
					].join("\n"),
					"info",
				);
			}
			continue;
		}

		// ── Create ────────────────────────────────────────────────────
		if (result.action === "create") {
			const name = await ctx.ui.input("Worktree name:");
			if (!name?.trim()) continue;
			const base = await ctx.ui.input("Base branch (empty = current):");
			await handleCreate({ args: base?.trim() ? `${name.trim()} ${base.trim()}` : name.trim(), ctx, exec, pi });
			worktrees = await listWorktrees(exec, ctx.cwd);
			continue;
		}

		// ── Actions on selected worktree ─────────────────────────────
		const target = items[result.index!];
		if (!target) continue;

		if (target.worktree.isMain) {
			ctx.ui.notify("Cannot perform this action on the main worktree.", "error");
			continue;
		}
		if (target.worktree.isCurrent) {
			ctx.ui.notify("Cannot perform this action on the current worktree. Switch first.", "error");
			continue;
		}

		const mainBranch2 = await getMainBranch(exec, ctx.cwd);

		// ── Delete only ─────────────────────────────────────────────
		if (result.action === "delete") {
			const confirmed = await ctx.ui.confirm(
				`Delete ${target.worktree.branch}?`,
				`This will remove the worktree and delete the branch.\nNo merge will be performed.\n\nContinue?`,
			);
			if (!confirmed) continue;

			const steps: string[] = [];
			try {
				const dirty = await isWorktreeDirty(exec, target.worktree.path).catch(() => true);
				await removeWorktree(exec, target.worktree.path, ctx.cwd, dirty);
				steps.push(`✓ Removed worktree: ${target.worktree.path}`);
			} catch (err) {
				ctx.ui.notify(`Failed to remove worktree: ${(err as Error).message}`, "error");
				continue;
			}
			try {
				await deleteBranch(exec, target.worktree.branch, ctx.cwd);
				steps.push(`✓ Deleted branch: ${target.worktree.branch}`);
			} catch (err) {
				steps.push(`⚠ Could not delete branch: ${(err as Error).message}`);
			}
			ctx.ui.notify(steps.map((s) => `  ${s}`).join("\n"), "info");
			worktrees = await listWorktrees(exec, ctx.cwd);
			continue;
		}

		// ── Merge only ──────────────────────────────────────────────
		if (result.action === "merge") {
			const steps: string[] = [];
			try {
				await checkoutBranch(exec, mainBranch2, ctx.cwd);
				steps.push(`✓ Switched to ${mainBranch2}`);
			} catch (err) {
				ctx.ui.notify(`Failed to checkout ${mainBranch2}: ${(err as Error).message}`, "error");
				continue;
			}
			const mergeResult = await mergeBranch(exec, target.worktree.branch, ctx.cwd);
			if (mergeResult.status === "conflict") {
				ctx.ui.notify("Merge conflicts detected. Aborted.", "error");
				continue;
			}
			if (!mergeResult.success) {
				ctx.ui.notify(`Merge failed: ${mergeResult.message}`, "error");
				continue;
			}
			steps.push(
				mergeResult.status === "already-up-to-date"
					? "✓ Already up-to-date"
					: `✓ Merged ${target.worktree.branch} into ${mainBranch2}`,
			);
			const pushResult = await pushBranch(exec, mainBranch2, ctx.cwd);
			steps.push(pushResult.success ? `✓ Pushed ${mainBranch2}` : `⚠ Push failed: ${pushResult.message}`);
			ctx.ui.notify(steps.map((s) => `  ${s}`).join("\n"), "info");
			worktrees = await listWorktrees(exec, ctx.cwd);
			continue;
		}

		// ── Merge + Delete ───────────────────────────────────────────
		if (result.action === "merge_delete") {
			const confirmed = await ctx.ui.confirm(
				`Merge and delete ${target.worktree.branch}?`,
				`This will merge into ${mainBranch2}, then remove the worktree and branch.\n\nContinue?`,
			);
			if (!confirmed) continue;

			const steps: string[] = [];
			try {
				await checkoutBranch(exec, mainBranch2, ctx.cwd);
				steps.push(`✓ Switched to ${mainBranch2}`);
			} catch (err) {
				ctx.ui.notify(`Failed to checkout ${mainBranch2}: ${(err as Error).message}`, "error");
				continue;
			}
			const mergeResult = await mergeBranch(exec, target.worktree.branch, ctx.cwd);
			if (mergeResult.status === "conflict") {
				ctx.ui.notify("Merge conflicts detected. Aborted.", "error");
				continue;
			}
			if (!mergeResult.success) {
				ctx.ui.notify(`Merge failed: ${mergeResult.message}`, "error");
				continue;
			}
			steps.push(
				mergeResult.status === "already-up-to-date"
					? "✓ Already up-to-date"
					: `✓ Merged ${target.worktree.branch} into ${mainBranch2}`,
			);
			const pushResult = await pushBranch(exec, mainBranch2, ctx.cwd);
			steps.push(pushResult.success ? `✓ Pushed ${mainBranch2}` : `⚠ Push failed: ${pushResult.message}`);
			try {
				const dirty = await isWorktreeDirty(exec, target.worktree.path).catch(() => true);
				await removeWorktree(exec, target.worktree.path, ctx.cwd, dirty);
				steps.push(`✓ Removed worktree`);
			} catch (err) {
				ctx.ui.notify(`Failed to remove worktree: ${(err as Error).message}`, "error");
				continue;
			}
			try {
				await deleteBranch(exec, target.worktree.branch, ctx.cwd);
				steps.push(`✓ Deleted branch: ${target.worktree.branch}`);
			} catch (err) {
				steps.push(`⚠ Could not delete branch: ${(err as Error).message}`);
			}
			ctx.ui.notify(steps.map((s) => `  ${s}`).join("\n"), "info");
			worktrees = await listWorktrees(exec, ctx.cwd);
		}
	}
}

// ── Command Registry ─────────────────────────────────────────────────────────

export function registerWorktreesCommand(pi: ExtensionAPI, exec: ExecFn): void {
	pi.registerCommand("worktrees", {
		description: "Manage Git worktrees (browse/create/list/clean)",
		handler: async (args, ctx) => {
			const parsed = parseArgs(args);

			if (!parsed?.action) {
				// Default: open interactive worktree browser
				await browseWorktrees({ args: "", ctx, exec, pi });
				return;
			}

			const subArgs = [parsed.name, parsed.extra].filter(Boolean).join(" ");

			switch (parsed.action) {
				case "create":
					await handleCreate({ args: subArgs, ctx, exec, pi });
					break;
				case "list":
				case "ls":
					await handleList({ args: "", ctx, exec, pi });
					break;
				case "clean":
				case "remove":
				case "rm":
					await handleClean({ args: subArgs, ctx, exec, pi });
					break;
				default:
					ctx.ui.notify(`Unknown action: ${parsed.action}\nUsage: /worktrees [create|list|clean] [name]`, "error");
			}
		},
	});
}
