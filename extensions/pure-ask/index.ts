import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
	wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import { type Static, Type } from "@sinclair/typebox";

type AskUserQuestionType = "single" | "multi" | "text" | "boolean";
type InteractiveMode = "select" | "text" | "other";

interface AskUserOption {
	value: string;
	label: string;
	description?: string;
}

interface AskUserQuestionInput {
	id: string;
	label?: string;
	type: AskUserQuestionType;
	prompt: string;
	description?: string;
	options?: AskUserOption[];
	allowOther?: boolean;
	required?: boolean;
	placeholder?: string;
	default?: string | string[];
	recommended?: string | string[];
}

interface NormalizedAskUserOption {
	value: string;
	label: string;
	description?: string;
	recommended: boolean;
}

interface NormalizedAskUserQuestion {
	id: string;
	label: string;
	type: AskUserQuestionType;
	kind: "single" | "multi" | "text";
	prompt: string;
	description?: string;
	options: NormalizedAskUserOption[];
	allowOther: boolean;
	required: boolean;
	placeholder?: string;
}

interface AskUserAnswer {
	id: string;
	label: string;
	type: AskUserQuestionType;
	values: string[];
	labels: string[];
	wasCustom: boolean;
	asked: boolean;
	comment?: string;
}

interface AskUserDetails {
	title?: string;
	description?: string;
	questions: NormalizedAskUserQuestion[];
	answers: AskUserAnswer[];
	cancelled: boolean;
}

interface AnswerState {
	single: Map<string, { value: string; label: string; wasCustom: boolean }>;
	multi: Map<string, Set<string>>;
	multiOther: Map<string, string>;
	text: Map<string, string>;
}

const OTHER_OPTION_VALUE = "__other__";
const OTHER_OPTION_LABEL = "Type something...";

const optionSchema = Type.Object({
	value: Type.String({ description: "Value returned when selected" }),
	label: Type.String({ description: "Display label" }),
	description: Type.Optional(Type.String({ description: "Optional help text for this option" })),
});

const questionSchema = Type.Object({
	id: Type.String({ description: "Unique identifier for this question" }),
	label: Type.Optional(Type.String({ description: "Short label shown in the tab row" })),
	type: Type.Union([Type.Literal("single"), Type.Literal("multi"), Type.Literal("text"), Type.Literal("boolean")], {
		description: "Question type",
	}),
	prompt: Type.String({ description: "The question text shown to the user" }),
	description: Type.Optional(Type.String({ description: "Optional markdown/plain-text context for this question" })),
	options: Type.Optional(Type.Array(optionSchema, { description: "Options for single/multi questions" })),
	allowOther: Type.Optional(Type.Boolean({ description: "Allow a custom typed answer for single/multi questions" })),
	required: Type.Optional(Type.Boolean({ description: "Require an answer before submit. Defaults to true." })),
	placeholder: Type.Optional(Type.String({ description: "Placeholder for text questions" })),
	default: Type.Optional(
		Type.Union([Type.String(), Type.Array(Type.String())], {
			description: "Default value(s). Use a string for single/text/boolean, array for multi.",
		}),
	),
	recommended: Type.Optional(
		Type.Union([Type.String(), Type.Array(Type.String())], {
			description: "Recommended value(s). Shown visually in the UI.",
		}),
	),
});

const askUserParameters = Type.Object({
	title: Type.Optional(Type.String({ description: "Optional questionnaire title" })),
	description: Type.Optional(Type.String({ description: "Optional questionnaire description/context" })),
	timeout: Type.Optional(Type.Number({ description: "Auto-cancel after N milliseconds" })),
	questions: Type.Array(questionSchema, {
		minItems: 1,
		description: "One or more questions to ask the user",
	}),
});

type AskUserParams = Static<typeof askUserParameters>;

type DialogUI = {
	input: (prompt: string, placeholder?: string, options?: { timeout?: number }) => Promise<string | undefined | null>;
	select: (prompt: string, options: string[], options2?: { timeout?: number }) => Promise<string | undefined | null>;
	notify: (message: string, level: "info" | "success" | "warning" | "error") => void;
	custom: <T>(
		factory: (tui: unknown, theme: any, keybindings: unknown, done: (value: T) => void) => unknown,
	) => Promise<T | undefined>;
};

function createEditorTheme(theme: any): EditorTheme {
	return {
		borderColor: (text: string) => theme.fg("accent", text),
		selectList: {
			selectedPrefix: (text: string) => theme.fg("accent", text),
			selectedText: (text: string) => theme.fg("accent", text),
			description: (text: string) => theme.fg("muted", text),
			scrollInfo: (text: string) => theme.fg("dim", text),
			noMatch: (text: string) => theme.fg("warning", text),
		},
	};
}

function toArray(value: string | string[] | undefined): string[] {
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed ? [trimmed] : [];
	}
	if (!Array.isArray(value)) return [];
	return value.map((item) => item.trim()).filter(Boolean);
}

function normalizeQuestions(input: AskUserQuestionInput[]): NormalizedAskUserQuestion[] {
	return input.map((question, index) => {
		const recommendedValues = new Set(toArray(question.recommended));
		const label = question.label?.trim() || `Q${index + 1}`;
		const id = question.id.trim() || `q${index + 1}`;
		const type = question.type;
		const kind = type === "boolean" ? "single" : type;
		const required = question.required !== false;
		const allowOther = kind !== "text" && question.allowOther !== false;

		const options =
			type === "boolean"
				? [
						{ value: "yes", label: "Yes", recommended: recommendedValues.has("yes") },
						{ value: "no", label: "No", recommended: recommendedValues.has("no") },
					]
				: (question.options ?? []).map((option) => ({
						value: option.value.trim(),
						label: option.label.trim(),
						description: option.description?.trim() || undefined,
						recommended: recommendedValues.has(option.value.trim()),
					}));

		return {
			id,
			label,
			type,
			kind,
			prompt: question.prompt.trim(),
			description: question.description?.trim() || undefined,
			options: options.filter((option) => option.value && option.label),
			allowOther,
			required,
			placeholder: question.placeholder?.trim() || undefined,
		};
	});
}

function validateQuestions(questions: NormalizedAskUserQuestion[]): string | null {
	const ids = new Set<string>();
	for (const question of questions) {
		if (!question.id) return "Every question must have a non-empty id.";
		if (ids.has(question.id)) return `Duplicate question id: ${question.id}`;
		ids.add(question.id);
		if (!question.prompt) return `Question ${question.label} must have a prompt.`;
		if (question.kind !== "text" && question.options.length === 0 && !question.allowOther) {
			return `Question ${question.label} must define options or allow a custom answer.`;
		}
		const optionValues = new Set<string>();
		for (const option of question.options) {
			if (optionValues.has(option.value)) {
				return `Question ${question.label} contains duplicate option value: ${option.value}`;
			}
			optionValues.add(option.value);
		}
	}
	return null;
}

function createInitialState(questions: NormalizedAskUserQuestion[], rawQuestions: AskUserQuestionInput[]): AnswerState {
	const state: AnswerState = {
		single: new Map(),
		multi: new Map(),
		multiOther: new Map(),
		text: new Map(),
	};

	for (const question of questions) {
		const source = rawQuestions.find((candidate) => candidate.id.trim() === question.id);
		const defaults = toArray(source?.default);
		if (question.kind === "text") {
			const first = defaults[0];
			if (first) state.text.set(question.id, first);
			continue;
		}

		if (question.kind === "single") {
			const first = defaults[0];
			if (!first) continue;
			const matching = question.options.find((option) => option.value === first || option.label === first);
			if (matching) {
				state.single.set(question.id, { value: matching.value, label: matching.label, wasCustom: false });
			} else if (question.allowOther) {
				state.single.set(question.id, { value: first, label: first, wasCustom: true });
			}
			continue;
		}

		const selected = new Set<string>();
		const unmatched: string[] = [];
		for (const item of defaults) {
			const matching = question.options.find((option) => option.value === item || option.label === item);
			if (matching) selected.add(matching.value);
			else if (question.allowOther) unmatched.push(item);
		}
		if (selected.size > 0) state.multi.set(question.id, selected);
		if (unmatched.length > 0) state.multiOther.set(question.id, unmatched.join(", "));
	}

	return state;
}

function isAnswered(question: NormalizedAskUserQuestion, state: AnswerState): boolean {
	if (question.kind === "text") {
		return Boolean(state.text.get(question.id)?.trim());
	}
	if (question.kind === "single") {
		const answer = state.single.get(question.id);
		return Boolean(answer?.label.trim());
	}
	return Boolean((state.multi.get(question.id)?.size ?? 0) > 0 || state.multiOther.get(question.id)?.trim());
}

function allRequiredAnswered(questions: NormalizedAskUserQuestion[], state: AnswerState): boolean {
	return questions.every((question) => !question.required || isAnswered(question, state));
}

function buildAnswer(question: NormalizedAskUserQuestion, state: AnswerState): AskUserAnswer {
	if (question.kind === "text") {
		const value = state.text.get(question.id)?.trim() ?? "";
		return {
			id: question.id,
			label: question.label,
			type: question.type,
			values: value ? [value] : [],
			labels: value ? [value] : [],
			wasCustom: Boolean(value),
			asked: Boolean(value),
		};
	}

	if (question.kind === "single") {
		const answer = state.single.get(question.id);
		if (!answer) {
			return {
				id: question.id,
				label: question.label,
				type: question.type,
				values: [],
				labels: [],
				wasCustom: false,
				asked: false,
			};
		}
		return {
			id: question.id,
			label: question.label,
			type: question.type,
			values: [answer.value],
			labels: [answer.label],
			wasCustom: answer.wasCustom,
			asked: true,
		};
	}

	const selected = [...(state.multi.get(question.id) ?? new Set<string>())];
	const labels = selected
		.map((value) => question.options.find((option) => option.value === value)?.label ?? value)
		.filter(Boolean);
	const other = state.multiOther.get(question.id)?.trim();
	if (other) labels.push(other);

	return {
		id: question.id,
		label: question.label,
		type: question.type,
		values: other ? [...selected, other] : selected,
		labels,
		wasCustom: Boolean(other),
		asked: labels.length > 0,
	};
}

function buildDetails(
	title: string | undefined,
	description: string | undefined,
	questions: NormalizedAskUserQuestion[],
	state: AnswerState,
	cancelled: boolean,
): AskUserDetails {
	return {
		title,
		description,
		questions,
		answers: questions.map((question) => buildAnswer(question, state)),
		cancelled,
	};
}

function formatSummary(details: AskUserDetails): string {
	const answered = details.answers.filter((answer) => answer.asked);
	if (answered.length === 0) return "User cancelled the questionnaire.";
	return answered
		.map((answer) => `${answer.label}: ${answer.labels.length > 0 ? answer.labels.join(", ") : "(unanswered)"}`)
		.join("\n");
}

function buildPrompt(
	title: string | undefined,
	description: string | undefined,
	question: NormalizedAskUserQuestion,
): string {
	const lines = [
		title,
		description,
		question.label ? `${question.label}: ${question.prompt}` : question.prompt,
		question.description,
	]
		.map((line) => line?.trim())
		.filter(Boolean);
	return lines.join("\n\n");
}

async function runDialogFallback(
	ui: DialogUI,
	title: string | undefined,
	description: string | undefined,
	questions: NormalizedAskUserQuestion[],
	rawQuestions: AskUserQuestionInput[],
	timeout: number | undefined,
): Promise<AskUserDetails> {
	const state = createInitialState(questions, rawQuestions);
	const options = timeout && timeout > 0 ? { timeout } : undefined;

	for (const question of questions) {
		const prompt = buildPrompt(title, description, question);
		if (question.kind === "text") {
			const value = await ui.input(prompt, question.placeholder ?? "Type your answer...", options);
			if (value === null || value === undefined) {
				return buildDetails(title, description, questions, state, true);
			}
			const trimmed = value.trim();
			if (trimmed) state.text.set(question.id, trimmed);
			else state.text.delete(question.id);
			continue;
		}

		if (question.kind === "single") {
			const labels = question.options.map((option) => option.label);
			if (question.allowOther) labels.push(OTHER_OPTION_LABEL);
			const selected = await ui.select(prompt, labels, options);
			if (selected === null || selected === undefined) {
				return buildDetails(title, description, questions, state, true);
			}
			if (selected === OTHER_OPTION_LABEL) {
				const custom = await ui.input(prompt, "Type your answer...", options);
				if (custom === null || custom === undefined) {
					return buildDetails(title, description, questions, state, true);
				}
				const trimmed = custom.trim();
				if (trimmed) {
					state.single.set(question.id, { value: trimmed, label: trimmed, wasCustom: true });
				}
				continue;
			}
			const option = question.options.find((candidate) => candidate.label === selected);
			if (option) state.single.set(question.id, { value: option.value, label: option.label, wasCustom: false });
			continue;
		}

		const optionLines = question.options.map((option, index) => `${index + 1}. ${option.label}`).join("\n");
		const input = await ui.input(
			`${prompt}\n\nOptions:\n${optionLines}\n\nType one or more labels separated by commas.${question.allowOther ? " You may also type your own answer." : ""}`,
			"Auth, API, Tests",
			options,
		);
		if (input === null || input === undefined) {
			return buildDetails(title, description, questions, state, true);
		}
		const parts = input
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		const selected = new Set<string>();
		const custom: string[] = [];
		for (const part of parts) {
			const match = question.options.find(
				(option) =>
					option.label.toLowerCase() === part.toLowerCase() || option.value.toLowerCase() === part.toLowerCase(),
			);
			if (match) selected.add(match.value);
			else if (question.allowOther) custom.push(part);
		}
		if (selected.size > 0) state.multi.set(question.id, selected);
		if (custom.length > 0) state.multiOther.set(question.id, custom.join(", "));
	}

	return buildDetails(title, description, questions, state, false);
}

async function runInteractiveQuestionnaire(
	ui: DialogUI,
	title: string | undefined,
	description: string | undefined,
	questions: NormalizedAskUserQuestion[],
	rawQuestions: AskUserQuestionInput[],
	timeout: number | undefined,
	signal: AbortSignal | undefined,
): Promise<AskUserDetails | undefined> {
	const customResult = await ui.custom<AskUserDetails>((tui, theme, _keybindings, done) => {
		const state = createInitialState(questions, rawQuestions);
		const editor = new Editor(tui as never, createEditorTheme(theme));
		const hasSubmitTab = questions.length > 1;
		const totalTabs = questions.length + (hasSubmitTab ? 1 : 0);
		let currentTab = 0;
		let cursor = 0;
		let mode: InteractiveMode = questions[0]?.kind === "text" ? "text" : "select";
		let editingQuestionId: string | null = questions[0]?.kind === "text" ? questions[0].id : null;
		let timer: ReturnType<typeof setTimeout> | undefined;

		function currentQuestion() {
			return currentTab < questions.length ? questions[currentTab] : undefined;
		}

		function currentOptions(question: NormalizedAskUserQuestion): NormalizedAskUserOption[] {
			const options = [...question.options];
			if (question.kind !== "text" && question.allowOther) {
				options.push({ value: OTHER_OPTION_VALUE, label: OTHER_OPTION_LABEL, recommended: false });
			}
			return options;
		}

		function clearTimer() {
			if (timer) clearTimeout(timer);
			timer = undefined;
		}

		function finish(cancelled: boolean) {
			saveCurrentEditor();
			clearTimer();
			done(buildDetails(title, description, questions, state, cancelled));
		}

		function saveCurrentEditor() {
			const question = currentQuestion();
			if (!question || !editingQuestionId) return;
			const value = editor.getText().trim();
			if (mode === "text" && question.id === editingQuestionId) {
				if (value) state.text.set(question.id, value);
				else state.text.delete(question.id);
				return;
			}
			if (mode === "other" && question.id === editingQuestionId) {
				if (question.kind === "single") {
					if (value) state.single.set(question.id, { value, label: value, wasCustom: true });
					else state.single.delete(question.id);
					return;
				}
				if (value) state.multiOther.set(question.id, value);
				else state.multiOther.delete(question.id);
			}
		}

		function loadEditorForQuestion(question: NormalizedAskUserQuestion, nextMode: InteractiveMode) {
			editingQuestionId = question.id;
			mode = nextMode;
			if (nextMode === "text") {
				editor.setText(state.text.get(question.id) ?? "");
				return;
			}
			if (question.kind === "single") {
				editor.setText(state.single.get(question.id)?.wasCustom ? (state.single.get(question.id)?.label ?? "") : "");
				return;
			}
			editor.setText(state.multiOther.get(question.id) ?? "");
		}

		function switchTab(nextTab: number) {
			saveCurrentEditor();
			currentTab = ((nextTab % totalTabs) + totalTabs) % totalTabs;
			cursor = 0;
			const question = currentQuestion();
			if (!question) {
				mode = "select";
				editingQuestionId = null;
				return;
			}
			if (question.kind === "text") {
				loadEditorForQuestion(question, "text");
				return;
			}
			mode = "select";
			editingQuestionId = null;
		}

		function advance() {
			if (!hasSubmitTab) {
				finish(false);
				return;
			}
			if (currentTab < questions.length - 1) {
				switchTab(currentTab + 1);
				return;
			}
			switchTab(questions.length);
		}

		if (signal) {
			signal.addEventListener("abort", () => finish(true), { once: true });
		}
		if (timeout && timeout > 0) {
			timer = setTimeout(() => finish(true), timeout);
		}

		editor.onSubmit = () => {
			const question = currentQuestion();
			if (!question) return;
			saveCurrentEditor();
			if (mode === "other") {
				mode = "select";
				editingQuestionId = null;
				advance();
				return;
			}
			advance();
		};

		function renderWrapped(lines: string[], width: number, text: string, indent = "") {
			for (const line of wrapTextWithAnsi(text, Math.max(10, width - indent.length))) {
				lines.push(truncateToWidth(indent + line, width));
			}
		}

		function renderTabs(lines: string[]) {
			const tabs = questions.map((question, index) => {
				const answered = isAnswered(question, state);
				const active = currentTab === index;
				const marker = answered ? "✓" : "○";
				const text = ` ${marker} ${question.label} `;
				if (active) return theme.bg("selectedBg", theme.fg("text", text));
				return theme.fg(answered ? "success" : "muted", text);
			});
			if (hasSubmitTab) {
				const active = currentTab === questions.length;
				const text = ` ${allRequiredAnswered(questions, state) ? "✓" : "→"} Submit `;
				tabs.push(
					active
						? theme.bg("selectedBg", theme.fg("text", text))
						: theme.fg(allRequiredAnswered(questions, state) ? "success" : "dim", text),
				);
			}
			lines.push(` ${tabs.join(theme.fg("dim", "│"))}`);
		}

		return {
			render(width: number) {
				const maxWidth = Math.min(width, 120);
				const lines: string[] = [];
				const hr = theme.fg("accent", "─".repeat(maxWidth));
				lines.push(hr);
				if (title) lines.push(truncateToWidth(` ${theme.fg("accent", theme.bold(title))}`, maxWidth));
				if (description) renderWrapped(lines, maxWidth, theme.fg("muted", description), " ");
				if (title || description) lines.push("");
				if (totalTabs > 1) {
					renderTabs(lines);
					lines.push("");
				}

				if (hasSubmitTab && currentTab === questions.length) {
					lines.push(truncateToWidth(` ${theme.fg("accent", theme.bold("Review & submit"))}`, maxWidth));
					lines.push("");
					for (const question of questions) {
						const answer = buildAnswer(question, state);
						const text = answer.asked ? answer.labels.join(", ") : theme.fg("warning", "(unanswered)");
						lines.push(truncateToWidth(` ${theme.fg("muted", `${question.label}:`)} ${text}`, maxWidth));
					}
					lines.push("");
					if (allRequiredAnswered(questions, state)) {
						lines.push(truncateToWidth(` ${theme.fg("success", "Press Enter to submit")}`, maxWidth));
					} else {
						lines.push(
							truncateToWidth(` ${theme.fg("warning", "Answer all required questions before submitting")}`, maxWidth),
						);
					}
					lines.push("");
					lines.push(truncateToWidth(` ${theme.fg("dim", "Tab/←→ switch • Enter submit • Esc cancel")}`, maxWidth));
					lines.push(hr);
					return lines;
				}

				const question = currentQuestion();
				if (!question) {
					lines.push(hr);
					return lines;
				}

				const typeLabel = question.type === "boolean" ? "[boolean]" : `[${question.type}]`;
				renderWrapped(
					lines,
					maxWidth,
					`${theme.fg("text", theme.bold(question.prompt))} ${theme.fg("dim", typeLabel)}`,
					" ",
				);
				if (question.required) lines.push(truncateToWidth(` ${theme.fg("warning", "*required")}`, maxWidth));
				if (question.description) {
					lines.push("");
					renderWrapped(lines, maxWidth, theme.fg("muted", question.description), " ");
				}
				lines.push("");

				if (question.kind === "text") {
					if (question.placeholder && !editor.getText()) {
						lines.push(truncateToWidth(` ${theme.fg("dim", question.placeholder)}`, maxWidth));
					}
					for (const line of editor.render(Math.max(20, maxWidth - 4))) {
						lines.push(truncateToWidth(`  ${line}`, maxWidth));
					}
					lines.push("");
					lines.push(
						truncateToWidth(
							` ${theme.fg("dim", `${hasSubmitTab ? "Tab/←→ switch • " : ""}Enter save • Esc cancel`)}`,
							maxWidth,
						),
					);
					lines.push(hr);
					return lines;
				}

				const options = currentOptions(question);
				const selectedSingle = state.single.get(question.id);
				const selectedMulti = state.multi.get(question.id) ?? new Set<string>();
				for (let index = 0; index < options.length; index++) {
					const option = options[index]!;
					const active = cursor === index;
					const pointer = active ? theme.fg("accent", "> ") : "  ";
					const isOther = option.value === OTHER_OPTION_VALUE;
					const selected =
						question.kind === "single"
							? isOther
								? selectedSingle?.wasCustom
								: selectedSingle?.value === option.value
							: isOther
								? Boolean(state.multiOther.get(question.id)?.trim())
								: selectedMulti.has(option.value);
					const marker = question.kind === "single" ? (selected ? "◉" : "○") : selected ? "[x]" : "[ ]";
					let label = option.label;
					if (isOther && question.kind === "single" && selectedSingle?.wasCustom)
						label = `Other: ${selectedSingle.label}`;
					if (isOther && question.kind === "multi" && state.multiOther.get(question.id)?.trim())
						label = `Other: ${state.multiOther.get(question.id)}`;
					const recommended = option.recommended ? theme.fg("dim", " (recommended)") : "";
					lines.push(
						truncateToWidth(
							`${pointer}${marker} ${active ? theme.fg("accent", label) : theme.fg("text", label)}${recommended}`,
							maxWidth,
						),
					);
					if (option.description) renderWrapped(lines, maxWidth, theme.fg("dim", option.description), "     ");
				}

				if (mode === "other") {
					lines.push("");
					for (const line of editor.render(Math.max(20, maxWidth - 4))) {
						lines.push(truncateToWidth(`  ${line}`, maxWidth));
					}
					lines.push("");
					lines.push(
						truncateToWidth(
							` ${theme.fg("dim", `${hasSubmitTab ? "Tab/←→ switch • " : ""}Enter save • Esc back`)}`,
							maxWidth,
						),
					);
					lines.push(hr);
					return lines;
				}

				lines.push("");
				if (question.kind === "multi") {
					lines.push(
						truncateToWidth(
							` ${theme.fg("dim", `↑↓ navigate • Space toggle • ${hasSubmitTab ? "Tab/←→ switch • " : ""}Enter next • Esc cancel`)}`,
							maxWidth,
						),
					);
				} else {
					lines.push(
						truncateToWidth(
							` ${theme.fg("dim", `↑↓ navigate • ${hasSubmitTab ? "Tab/←→ switch • " : ""}Enter select • Esc cancel`)}`,
							maxWidth,
						),
					);
				}
				lines.push(hr);
				return lines;
			},
			invalidate() {},
			handleInput(data: string) {
				const question = currentQuestion();

				if (hasSubmitTab && currentTab === questions.length) {
					if ((matchesKey(data, Key.tab) || matchesKey(data, Key.right)) && totalTabs > 1) {
						switchTab(0);
						return;
					}
					if ((matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) && totalTabs > 1) {
						switchTab(currentTab - 1);
						return;
					}
					if (matchesKey(data, Key.enter) && allRequiredAnswered(questions, state)) {
						finish(false);
						return;
					}
					if (matchesKey(data, Key.escape)) {
						finish(true);
					}
					return;
				}

				if (!question) return;

				if (mode === "text") {
					if ((matchesKey(data, Key.tab) || matchesKey(data, Key.right)) && totalTabs > 1) {
						switchTab(currentTab + 1);
						return;
					}
					if ((matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) && totalTabs > 1) {
						switchTab(currentTab - 1);
						return;
					}
					if (matchesKey(data, Key.enter)) {
						saveCurrentEditor();
						advance();
						return;
					}
					if (matchesKey(data, Key.escape)) {
						finish(true);
						return;
					}
					editor.handleInput(data);
					return;
				}

				if (mode === "other") {
					if ((matchesKey(data, Key.tab) || matchesKey(data, Key.right)) && totalTabs > 1) {
						saveCurrentEditor();
						switchTab(currentTab + 1);
						return;
					}
					if ((matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) && totalTabs > 1) {
						saveCurrentEditor();
						switchTab(currentTab - 1);
						return;
					}
					if (matchesKey(data, Key.enter)) {
						saveCurrentEditor();
						mode = "select";
						editingQuestionId = null;
						advance();
						return;
					}
					if (matchesKey(data, Key.escape)) {
						mode = question.kind === "text" ? "text" : "select";
						editingQuestionId = question.kind === "text" ? question.id : null;
						editor.setText("");
						return;
					}
					editor.handleInput(data);
					return;
				}

				if ((matchesKey(data, Key.tab) || matchesKey(data, Key.right)) && totalTabs > 1) {
					switchTab(currentTab + 1);
					return;
				}
				if ((matchesKey(data, Key.shift("tab")) || matchesKey(data, Key.left)) && totalTabs > 1) {
					switchTab(currentTab - 1);
					return;
				}
				if (matchesKey(data, Key.up)) {
					cursor = Math.max(0, cursor - 1);
					return;
				}
				if (matchesKey(data, Key.down)) {
					cursor = Math.min(currentOptions(question).length - 1, cursor + 1);
					return;
				}
				if (matchesKey(data, Key.escape)) {
					finish(true);
					return;
				}

				const option = currentOptions(question)[cursor];
				if (!option) return;

				if (question.kind === "single" && matchesKey(data, Key.enter)) {
					if (option.value === OTHER_OPTION_VALUE) {
						loadEditorForQuestion(question, "other");
						return;
					}
					state.single.set(question.id, { value: option.value, label: option.label, wasCustom: false });
					advance();
					return;
				}

				if (question.kind === "multi") {
					if (matchesKey(data, Key.space)) {
						if (option.value === OTHER_OPTION_VALUE) {
							loadEditorForQuestion(question, "other");
							return;
						}
						const selected = state.multi.get(question.id) ?? new Set<string>();
						if (selected.has(option.value)) selected.delete(option.value);
						else selected.add(option.value);
						state.multi.set(question.id, selected);
						return;
					}
					if (matchesKey(data, Key.enter)) {
						if (option.value === OTHER_OPTION_VALUE) {
							loadEditorForQuestion(question, "other");
							return;
						}
						advance();
					}
				}
			},
		};
	});

	return customResult;
}

async function executeAskUser(
	params: AskUserParams,
	ctx: { hasUI: boolean; ui: DialogUI },
	signal: AbortSignal | undefined,
	onUpdate?: (update: { content?: Array<{ type: "text"; text: string }>; details?: unknown }) => void,
): Promise<{ content: Array<{ type: "text"; text: string }>; details: AskUserDetails; isError?: boolean }> {
	const normalizedQuestions = normalizeQuestions(params.questions as AskUserQuestionInput[]);
	const validationError = validateQuestions(normalizedQuestions);
	if (validationError) {
		return {
			content: [{ type: "text", text: `Ask User validation error: ${validationError}` }],
			details: {
				title: params.title,
				description: params.description,
				questions: normalizedQuestions,
				answers: [],
				cancelled: true,
			},
			isError: true,
		};
	}

	if (!ctx.hasUI) {
		return {
			content: [{ type: "text", text: "Ask User requires interactive or RPC UI support." }],
			details: {
				title: params.title,
				description: params.description,
				questions: normalizedQuestions,
				answers: [],
				cancelled: true,
			},
			isError: true,
		};
	}

	onUpdate?.({
		content: [{ type: "text", text: "Waiting for user input..." }],
		details: { title: params.title, questions: normalizedQuestions },
	});

	const interactiveResult = await runInteractiveQuestionnaire(
		ctx.ui,
		params.title?.trim() || undefined,
		params.description?.trim() || undefined,
		normalizedQuestions,
		params.questions as AskUserQuestionInput[],
		params.timeout,
		signal,
	);

	const details =
		interactiveResult ??
		(await runDialogFallback(
			ctx.ui,
			params.title?.trim() || undefined,
			params.description?.trim() || undefined,
			normalizedQuestions,
			params.questions as AskUserQuestionInput[],
			params.timeout,
		));

	return {
		content: [{ type: "text", text: formatSummary(details) }],
		details,
	};
}

function buildDemoParams(): AskUserParams {
	return {
		title: "Ask User Demo",
		description: "A small native Pi questionnaire showing the initial pure-ask flow.",
		questions: [
			{
				id: "database",
				label: "Database",
				type: "single",
				prompt: "Which database should we use?",
				description: "Pick the default datastore for this project.",
				options: [
					{ value: "postgres", label: "PostgreSQL", description: "General-purpose default" },
					{ value: "sqlite", label: "SQLite", description: "Simple local-first option" },
					{ value: "mysql", label: "MySQL", description: "If compatibility matters" },
				],
				recommended: "postgres",
			},
			{
				id: "features",
				label: "Features",
				type: "multi",
				prompt: "Which features should be included?",
				options: [
					{ value: "auth", label: "Authentication" },
					{ value: "api", label: "API" },
					{ value: "tests", label: "Tests" },
					{ value: "docs", label: "Docs" },
				],
				required: true,
			},
			{
				id: "notes",
				label: "Notes",
				type: "text",
				prompt: "Anything else the agent should know before proceeding?",
				placeholder: "Add any constraints, preferences, or context...",
				required: false,
			},
		],
	};
}

export default function pureAsk(pi: ExtensionAPI) {
	pi.registerTool({
		name: "ask_user",
		label: "Ask User",
		description:
			"Ask the user one or more structured questions in native Pi UI. Use this when the agent needs explicit user input, preferences, confirmations, or clarifications before proceeding.",
		promptSnippet:
			"Ask the user one or more structured questions with native Pi UI. Prefer this when explicit user input is needed before proceeding.",
		promptGuidelines: [
			"Use ask_user when explicit user input is required before proceeding.",
			"Group related clarifications into a single questionnaire instead of asking many fragmented follow-up questions.",
			"Prefer single for one choice, multi for select-many, text for open-ended input, and boolean for yes/no decisions.",
			"Use allowOther when the listed options may not be exhaustive.",
		],
		parameters: askUserParameters,
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			return executeAskUser(params as AskUserParams, ctx as { hasUI: boolean; ui: DialogUI }, signal, onUpdate);
		},
		renderCall(args, theme) {
			const title = typeof args.title === "string" && args.title.trim() ? `${args.title.trim()} — ` : "";
			const count = Array.isArray(args.questions) ? args.questions.length : 0;
			return new Text(
				theme.fg("toolTitle", theme.bold("ask_user ")) +
					theme.fg("muted", `${title}${count} question${count === 1 ? "" : "s"}`),
				0,
				0,
			);
		},
		renderResult(result, options, theme) {
			const details = result.details as AskUserDetails | undefined;
			if (!details) {
				const text = result.content.find((part) => part.type === "text")?.text ?? "";
				return new Text(text, 0, 0);
			}
			if (options.isPartial) {
				return new Text(theme.fg("muted", "Waiting for user input..."), 0, 0);
			}
			if (details.cancelled) {
				return new Text(theme.fg("warning", "Cancelled"), 0, 0);
			}
			const answered = details.answers.filter((answer) => answer.asked);
			const summary = answered.length
				? answered.map((answer) => `${answer.label}: ${answer.labels.join(", ")}`).join("\n")
				: "No answers captured.";
			if (!options.expanded) {
				return new Text(theme.fg("success", `✓ ${answered.length} answered`), 0, 0);
			}
			return new Text(`${theme.fg("success", `✓ Completed`)}\n${summary}`, 0, 0);
		},
	});

	pi.registerCommand("ask", {
		description:
			"Run Ask User manually. With no args, opens a demo questionnaire. With args, asks a single text question.",
		handler: async (args, ctx) => {
			const trimmed = args.trim();
			const params = trimmed
				? {
						questions: [
							{
								id: "q1",
								label: "Q1",
								type: "text" as const,
								prompt: trimmed,
								placeholder: "Type your answer...",
							},
						],
					}
				: buildDemoParams();
			const result = await executeAskUser(params, ctx as { hasUI: boolean; ui: DialogUI }, undefined);
			if (result.details.cancelled) {
				ctx.ui.notify("Ask User cancelled.", "warning");
				return;
			}
			ctx.ui.notify(formatSummary(result.details), "success");
		},
	});

	pi.registerCommand("ask-demo", {
		description: "Open the Ask User demo questionnaire.",
		handler: async (_args, ctx) => {
			const result = await executeAskUser(buildDemoParams(), ctx as { hasUI: boolean; ui: DialogUI }, undefined);
			if (result.details.cancelled) {
				ctx.ui.notify("Ask User demo cancelled.", "warning");
				return;
			}
			ctx.ui.notify("Ask User demo completed.", "success");
		},
	});
}
