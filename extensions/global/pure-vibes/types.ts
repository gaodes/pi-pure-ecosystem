export type VibeMode = "generate" | "file";

export interface VibeConfig {
	theme: string | null;
	mode: VibeMode;
	model: string;
	fallback: string;
	timeoutMs: number;
	refreshIntervalSeconds: number;
	promptTemplate: string;
	maxLength: number;
}
