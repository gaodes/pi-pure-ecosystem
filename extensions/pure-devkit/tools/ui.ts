/**
 * Inlined UI components from @aliou/pi-utils-ui
 *
 * These components are used by the devkit tool render methods.
 * Inlined to avoid the external npm dependency that causes Jiti resolution failures.
 *
 * @see https://github.com/aliou/pi-dev-kit — original source
 */

import type { Theme, ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import type { Component } from "@mariozechner/pi-tui";
import { Text, truncateToWidth } from "@mariozechner/pi-tui";

// ─── ToolCallHeader ──────────────────────────────────────────────────────────

export interface ToolCallHeaderOptionArg {
	label: string;
	value: string;
	tone?: "muted" | "accent" | "success" | "warning" | "error" | "dim";
}

export interface ToolCallHeaderLongArg {
	label?: string;
	value: string;
}

export interface ToolCallHeaderConfig {
	toolName: string;
	action?: string;
	mainArg?: string;
	optionArgs?: ToolCallHeaderOptionArg[];
	longArgs?: ToolCallHeaderLongArg[];
	showColon?: boolean;
}

/**
 * Standard tool call header pattern:
 * [Tool Name]: [Action] [Main arg] [Option args]
 * [Long args]
 */
export class ToolCallHeader implements Component {
	constructor(
		private config: ToolCallHeaderConfig,
		private theme: Theme,
	) {}

	handleInput(_data: string): boolean {
		return false;
	}

	invalidate(): void {}

	update(config: ToolCallHeaderConfig): void {
		this.config = config;
	}

	render(width: number): string[] {
		const th = this.theme;
		const showColon = this.config.showColon ?? Boolean(this.config.action);
		const toolName = showColon ? `${this.config.toolName}:` : this.config.toolName;

		const parts: string[] = [th.fg("toolTitle", th.bold(toolName))];

		if (this.config.action) {
			parts.push(th.fg("accent", this.config.action));
		}

		if (this.config.mainArg) {
			parts.push(th.fg("accent", this.config.mainArg));
		}

		for (const option of this.config.optionArgs ?? []) {
			const tone = option.tone ?? "dim";
			const label = option.label.trim().toLowerCase();
			parts.push(`${th.fg("muted", `${label}=`)}${th.fg(tone, option.value)}`);
		}

		const lines: string[] = [parts.join(" ")];

		for (const longArg of this.config.longArgs ?? []) {
			if (!longArg.value) continue;
			const normalizedLabel = longArg.label?.trim().toLowerCase();
			const label = normalizedLabel ? `${th.fg("muted", `${normalizedLabel}:`)} ` : "";
			lines.push(`${label}${th.fg("dim", longArg.value)}`);
		}

		return new Text(lines.join("\n"), 0, 0).render(width);
	}
}

// ─── ToolBody ────────────────────────────────────────────────────────────────

export type ToolBodyField =
	| { label: string; value: string; showCollapsed?: boolean }
	| (Component & { showCollapsed?: boolean });

export interface ToolBodyConfig {
	fields: ToolBodyField[];
	footer?: Component;
	includeSpacerBeforeFooter?: boolean;
}

export class ToolBody implements Component {
	constructor(
		private config: ToolBodyConfig,
		private options: ToolRenderResultOptions,
		private theme: Theme,
	) {}

	handleInput(_data: string): boolean {
		return false;
	}

	invalidate(): void {}

	update(config: ToolBodyConfig, options: ToolRenderResultOptions): void {
		this.config = config;
		this.options = options;
	}

	render(width: number): string[] {
		const lines: string[] = [];
		const th = this.theme;

		const fieldsToRender = this.options.expanded
			? this.config.fields
			: this.config.fields.filter((field) => "showCollapsed" in field && field.showCollapsed);

		for (const field of fieldsToRender) {
			if (isComponent(field)) {
				lines.push(...field.render(width));
			} else {
				const text = new Text(`${th.fg("muted", `${field.label}: `)}${field.value}`, 0, 0);
				lines.push(...text.render(width));
			}
		}

		if (this.config.footer) {
			if (this.config.includeSpacerBeforeFooter ?? true) {
				lines.push("");
			}
			lines.push(...this.config.footer.render(width));
		}

		return lines;
	}
}

function isComponent(field: ToolBodyField): field is Component {
	return "render" in field && typeof (field as Component).render === "function";
}

// ─── ToolFooter ──────────────────────────────────────────────────────────────

export interface ToolFooterItem {
	label?: string;
	value: string;
	tone?: "muted" | "accent" | "success" | "warning" | "error";
}

export interface ToolFooterConfig {
	items: ToolFooterItem[];
	separator?: " - " | " | ";
	truncate?: boolean;
}

export class ToolFooter implements Component {
	constructor(
		private theme: Theme,
		private config: ToolFooterConfig,
	) {}

	handleInput(_data: string): boolean {
		return false;
	}

	invalidate(): void {}

	update(config: ToolFooterConfig): void {
		this.config = config;
	}

	render(width: number): string[] {
		const th = this.theme;
		const parts = this.config.items
			.filter((item) => Boolean(item.value))
			.map((item) => {
				const tone = item.tone ?? "muted";
				const raw = item.label ? `${item.label}: ${item.value}` : item.value;
				return th.fg(tone, raw);
			});

		const line = parts.join(this.config.separator ?? " - ");

		if (this.config.truncate ?? true) {
			return [truncateToWidth(line, width)];
		}

		return [line];
	}
}
