import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

import { clearConfigCache, ensureConfigExists } from "./config.js";
import {
	generateVibesBatch,
	getVibeFileCount,
	getVibeMode,
	getVibeModel,
	getVibeTheme,
	hasVibeFile,
	initVibeManager,
	onThinkingEnd,
	onThinkingStart,
	onVibeAgentEnd,
	onVibeAgentStart,
	onVibeBeforeAgentStart,
	onVibeToolCall,
	onToolExecutionEnd as onVibeToolExecutionEnd,
	onToolExecutionStart as onVibeToolExecutionStart,
	refreshVibeConfig,
	setVibeMode,
	setVibeModel,
	setVibeTheme,
} from "./working-vibes.js";

// ═══════════════════════════════════════════════════════════════════════════
// Extension
// ═══════════════════════════════════════════════════════════════════════════

export default function pureVibes(pi: ExtensionAPI) {
	// Track tool executions for working-line
	pi.on("tool_execution_start", async (event) => {
		onVibeToolExecutionStart(event.toolName, (event as any).toolCallId);
	});

	pi.on("tool_execution_end", async (event) => {
		onVibeToolExecutionEnd((event as any).toolCallId);
	});

	// Session start — initialize vibe manager
	pi.on("session_start", async (_event, ctx) => {
		ensureConfigExists();
		clearConfigCache();
		initVibeManager(ctx);
	});

	// Before agent starts — set themed working message
	pi.on("before_agent_start", async (event: { prompt: string }, ctx) => {
		if (ctx.hasUI) {
			onVibeBeforeAgentStart(event.prompt, ctx.ui.setWorkingMessage);
		}
	});

	// Agent started — mark as streaming
	pi.on("agent_start", async (_event, _ctx) => {
		onVibeAgentStart();
	});

	// Tool call during agent execution — refresh vibe
	pi.on("tool_call", async (event: { toolName: string; input: Record<string, unknown> }, ctx) => {
		if (ctx.hasUI) {
			const agentContext = getRecentAgentContext(ctx);
			onVibeToolCall(event.toolName, event.input, agentContext);
		}
	});

	// Agent ended — reset working message
	pi.on("agent_end", async (_event, ctx) => {
		if (ctx.hasUI) {
			onVibeAgentEnd(ctx.ui.setWorkingMessage);
		}
	});

	// Message update — track thinking state for working line
	pi.on("message_update", async (event: any) => {
		const assistantEvent = event.assistantMessageEvent;
		if (!assistantEvent) return;
		if (assistantEvent.type === "thinking_start") onThinkingStart();
		else if (assistantEvent.type === "thinking_end") onThinkingEnd();
	});

	// ═══════════════════════════════════════════════════════════════════════════
	// /vibe Command
	// ═══════════════════════════════════════════════════════════════════════════

	pi.registerCommand("vibe", {
		description: "Configure working vibes (theme, mode, model, generate)",
		handler: async (args, ctx) => {
			// Refresh config before handling command
			refreshVibeConfig();

			const trimmedArgs = args?.trim() || "";
			const parts = trimmedArgs.split(/\s+/);
			const command = parts[0]?.toLowerCase() || "";
			const arg1 = parts[1]?.toLowerCase() || "";

			// No args - show current vibe status
			if (!command) {
				const theme = getVibeTheme();
				const mode = getVibeMode();
				const model = getVibeModel();

				if (theme) {
					const hasFile = hasVibeFile(theme);
					const fileCount = hasFile ? getVibeFileCount(theme) : 0;
					ctx.ui.notify(
						`Theme: ${theme} | Mode: ${mode} | Model: ${model}${hasFile ? ` (${fileCount} vibes)` : ""}`,
						"info",
					);
				} else {
					ctx.ui.notify("Vibes disabled. Use /vibe <theme> to enable (e.g., /vibe star trek)", "info");
				}
				return;
			}

			// /vibe off - disable vibes
			if (command === "off") {
				setVibeTheme(null);
				ctx.ui.notify("Vibes disabled", "info");
				return;
			}

			// /vibe model - show or set model
			if (command === "model") {
				if (!arg1) {
					ctx.ui.notify(`Current vibe model: ${getVibeModel()}`, "info");
					return;
				}
				// Reconstruct model spec from remaining args
				const newModel = parts.slice(1).join("/");
				setVibeModel(newModel);
				ctx.ui.notify(`Vibe model set to: ${newModel}`, "info");
				return;
			}

			// /vibe mode - show or set mode
			if (command === "mode") {
				if (!arg1) {
					ctx.ui.notify(`Current vibe mode: ${getVibeMode()}`, "info");
					return;
				}
				if (arg1 === "generate" || arg1 === "file") {
					setVibeMode(arg1);
					ctx.ui.notify(`Vibe mode set to: ${arg1}`, "info");
					return;
				}
				ctx.ui.notify("Usage: /vibe mode [generate|file]", "info");
				return;
			}

			// /vibe generate <theme> [count] - generate vibes file
			if (command === "generate") {
				const maybeCount = parseInt(parts[parts.length - 1] ?? "", 10);
				const hasExplicitCount = Number.isFinite(maybeCount) && maybeCount > 0;
				const theme = hasExplicitCount ? parts.slice(1, -1).join(" ") : parts.slice(1).join(" ") || getVibeTheme();
				const count = hasExplicitCount ? maybeCount : 100;

				if (!theme) {
					ctx.ui.notify("No theme set. Use /vibe <theme> first or /vibe generate <theme>", "info");
					return;
				}

				ctx.ui.notify(`Generating ${count} vibes for "${theme}"...`, "info");

				try {
					const result = await generateVibesBatch(theme, count);
					if (result.success) {
						ctx.ui.notify(`Generated ${result.count} vibes saved to ${result.filePath}`, "info");
					} else {
						ctx.ui.notify(`Failed: ${result.error}`, "error");
					}
				} catch (e) {
					ctx.ui.notify(`Error: ${e}`, "error");
				}
				return;
			}

			// /vibe <theme> - set theme
			const theme = trimmedArgs;
			setVibeTheme(theme);

			const hasFile = hasVibeFile(theme);
			const currentMode = getVibeMode();

			if (hasFile) {
				const count = getVibeFileCount(theme);
				ctx.ui.notify(`Theme: ${theme} (${count} vibes, mode: ${currentMode})`, "info");
			} else if (currentMode === "file") {
				ctx.ui.notify(`Theme: ${theme} (no vibes file - run /vibe generate ${theme})`, "warning");
			} else {
				ctx.ui.notify(`Theme: ${theme} (AI generation mode)`, "info");
			}
		},
	});
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function getRecentAgentContext(ctx: any): string | undefined {
	const sessionEvents = ctx.sessionManager?.getBranch?.() ?? [];

	for (let i = sessionEvents.length - 1; i >= 0; i--) {
		const event = sessionEvents[i];
		if (event.type !== "message" || event.message?.role !== "assistant") {
			continue;
		}

		const content = event.message.content;
		if (!Array.isArray(content)) {
			continue;
		}

		for (const block of content) {
			if (block.type === "text" && typeof block.text === "string") {
				const text = block.text.trim();
				if (text.length > 0) {
					return text.slice(0, 200);
				}
			}
		}
	}

	return undefined;
}
