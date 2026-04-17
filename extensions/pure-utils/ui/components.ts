import type { Component, Theme, ToolRenderResultOptions } from "@mariozechner/pi-coding-agent";
import { Text, truncateToWidth } from "@mariozechner/pi-tui";

export interface ToolCallHeaderConfig {
	toolName: string;
	action?: string;
	mainArg?: string;
	showColon?: boolean;
}

export class ToolCallHeader implements Component {
	constructor(
		private config: ToolCallHeaderConfig,
		private theme: Theme,
	) {}

	handleInput(): boolean {
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
		if (this.config.action) parts.push(th.fg("accent", this.config.action));
		if (this.config.mainArg) parts.push(th.fg("accent", this.config.mainArg));
		return new Text(parts.join(" "), 0, 0).render(width);
	}
}

export interface ToolFooterItem {
	label?: string;
	value: string;
	tone?: "muted" | "accent" | "success" | "warning" | "error";
}

export class ToolFooter implements Component {
	constructor(
		private theme: Theme,
		private config: { items: ToolFooterItem[] },
	) {}

	handleInput(): boolean {
		return false;
	}
	invalidate(): void {}
	update(config: { items: ToolFooterItem[] }): void {
		this.config = config;
	}

	render(width: number): string[] {
		const parts = this.config.items
			.filter((item) => Boolean(item.value))
			.map((item) => {
				const tone = item.tone ?? "muted";
				const raw = item.label ? `${item.label}: ${item.value}` : item.value;
				return this.theme.fg(tone, raw);
			});
		return [truncateToWidth(parts.join(" - "), width)];
	}
}

export type ToolBodyField =
	| { label: string; value: string; showCollapsed?: boolean }
	| (Component & { showCollapsed?: boolean });

export class ToolBody implements Component {
	constructor(
		private config: { fields: ToolBodyField[]; footer?: Component },
		private options: ToolRenderResultOptions,
		private theme: Theme,
	) {}

	handleInput(): boolean {
		return false;
	}
	invalidate(): void {}
	update(config: { fields: ToolBodyField[]; footer?: Component }): void {
		this.config = config;
	}

	render(width: number): string[] {
		const lines: string[] = [];
		const fieldsToRender = this.options.expanded
			? this.config.fields
			: this.config.fields.filter((field) => "showCollapsed" in field && field.showCollapsed);
		for (const field of fieldsToRender) {
			if ("render" in field && typeof (field as Component).render === "function") {
				lines.push(...(field as Component).render(width));
			} else {
				const f = field as { label: string; value: string };
				lines.push(...new Text(`${this.theme.fg("muted", `${f.label}: `)}${f.value}`, 0, 0).render(width));
			}
		}
		if (this.config.footer) {
			lines.push("", ...this.config.footer.render(width));
		}
		return lines;
	}
}
