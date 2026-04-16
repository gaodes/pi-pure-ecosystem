/**
 * Summary Formatters
 *
 * Compact text formatters for tool output. Each formatter takes parsed JSON
 * data from a gh CLI call and returns a human-readable summary optimized
 * for minimal token usage.
 *
 * Input shapes correspond to the `--json` field lists requested in each
 * tool module. Fields that aren't requested simply arrive as undefined and
 * the formatters degrade gracefully.
 */

// -- Shared shapes --

interface Actor {
	login?: string;
}

interface Label {
	name?: string;
}

interface BranchRef {
	name?: string;
}

// -- PR shapes --

interface PRListItem {
	number?: number;
	title?: string;
	state?: string;
	author?: Actor | null;
	headRefName?: string;
	baseRefName?: string;
	updatedAt?: string | null;
}

interface PRView extends PRListItem {
	body?: string | null;
	additions?: number;
	deletions?: number;
	files?: unknown[];
	mergedAt?: string | null;
	mergedBy?: Actor | null;
	mergeable?: string | null;
	statusCheckRollup?: Array<{ state?: string; conclusion?: string }>;
}

// -- Issue shapes --

interface IssueListItem {
	number?: number;
	title?: string;
	state?: string;
	labels?: Label[];
	updatedAt?: string | null;
}

interface IssueView {
	number?: number;
	title?: string;
	state?: string;
	author?: Actor | null;
	labels?: Label[];
	assignees?: Actor[];
	comments?: unknown[];
	createdAt?: string | null;
	body?: string | null;
}

// -- Repo shapes --

interface RepoListItem {
	name?: string;
	owner?: Actor | null;
	visibility?: string;
	description?: string | null;
	updatedAt?: string | null;
}

interface RepoView extends RepoListItem {
	stargazerCount?: number;
	forkCount?: number;
	defaultBranchRef?: BranchRef | null;
	createdAt?: string | null;
}

// -- Workflow shapes --

interface WorkflowListItem {
	id?: number | string;
	name?: string;
	path?: string;
}

// -- Helpers --

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	return iso.slice(0, 10);
}

function authorLogin(author: Actor | null | undefined): string {
	return author?.login ?? "unknown";
}

function truncateBody(body: string | null | undefined, max = 200): string | null {
	if (!body) return null;
	const trimmed = body.trim();
	if (!trimmed) return null;
	return trimmed.length > max ? `${trimmed.slice(0, max)}...` : trimmed;
}

// -- PR formatters --

export function formatPRList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No pull requests found.";
	}

	const items = data as PRListItem[];
	const lines = items.map((pr) => {
		const num = `#${pr.number}`;
		const title = pr.title ?? "";
		const state = pr.state ?? "";
		const author = authorLogin(pr.author);
		const branches = `${pr.headRefName ?? ""} -> ${pr.baseRefName ?? ""}`;
		const date = formatDate(pr.updatedAt);
		return `${num}  ${title}  ${state}  ${author}  ${branches}  ${date}`;
	});

	return lines.join("\n");
}

const PASSING_CHECK_STATES = ["SUCCESS", "SKIPPED", "NEUTRAL"];

export function formatPRView(data: unknown): string {
	if (!data || typeof data !== "object") {
		return "No pull request data.";
	}

	const pr = data as PRView;
	const header = `PR #${pr.number}: ${pr.title} [${pr.state}]`;

	const mergeInfo = pr.mergedAt
		? ` merged ${formatDate(pr.mergedAt)} by ${authorLogin(pr.mergedBy)}`
		: ` by ${authorLogin(pr.author)}`;

	const branches = `${pr.headRefName ?? ""} -> ${pr.baseRefName ?? ""}`;
	const changes = `+${pr.additions ?? 0} -${pr.deletions ?? 0}`;
	const fileCount = `${Array.isArray(pr.files) ? pr.files.length : 0} files`;

	const checks =
		Array.isArray(pr.statusCheckRollup) && pr.statusCheckRollup.length > 0
			? pr.statusCheckRollup.every(
					(c) =>
						(c.state && PASSING_CHECK_STATES.includes(c.state)) ||
						(c.conclusion && PASSING_CHECK_STATES.includes(c.conclusion)),
				)
				? "checks: passing"
				: "checks: pending/failing"
			: "";

	const mergeable = pr.mergeable ? `mergeable: ${pr.mergeable.toLowerCase()}` : "";

	const statusParts = [mergeable, checks].filter(Boolean).join(" | ");
	const detailLine = `${branches} | ${changes} | ${fileCount}`;

	const lines = [header + mergeInfo, detailLine];
	if (statusParts) lines.push(statusParts);

	const bodyPreview = truncateBody(pr.body);
	if (bodyPreview) {
		lines.push("", bodyPreview);
	}

	return lines.join("\n");
}

// -- Issue formatters --

export function formatIssueList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No issues found.";
	}

	const items = data as IssueListItem[];
	const lines = items.map((issue) => {
		const num = `#${issue.number}`;
		const title = issue.title ?? "";
		const state = issue.state ?? "";
		const labels = issue.labels?.map((l) => l.name ?? "").join(",") ?? "";
		const date = formatDate(issue.updatedAt);
		return `${num}  ${title}  ${state}  ${labels}  ${date}`;
	});

	return lines.join("\n");
}

export function formatIssueView(data: unknown): string {
	if (!data || typeof data !== "object") {
		return "No issue data.";
	}

	const issue = data as IssueView;
	const header = `Issue #${issue.number}: ${issue.title} [${issue.state}]`;

	const labels =
		issue.labels && issue.labels.length > 0 ? `Labels: ${issue.labels.map((l) => l.name ?? "").join(", ")}` : "";

	const assignees =
		issue.assignees && issue.assignees.length > 0
			? `Assignees: ${issue.assignees.map((a) => a.login ?? "").join(", ")}`
			: "";

	const commentCount = Array.isArray(issue.comments) ? `${issue.comments.length} comments` : "";
	const created = `Created: ${formatDate(issue.createdAt)} by ${authorLogin(issue.author)}`;

	const metaParts = [labels, assignees, commentCount].filter(Boolean).join(" | ");
	const lines = [header];
	if (metaParts) lines.push(metaParts);
	lines.push(created);

	const bodyPreview = truncateBody(issue.body);
	if (bodyPreview) {
		lines.push("", bodyPreview);
	}

	return lines.join("\n");
}

// -- Repo formatters --

export function formatRepoList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No repositories found.";
	}

	const items = data as RepoListItem[];
	const lines = items.map((repo) => {
		const fullName = `${authorLogin(repo.owner)}/${repo.name}`;
		const visibility = repo.visibility ?? "";
		const desc = repo.description ?? "";
		const date = formatDate(repo.updatedAt);
		return `${fullName}  ${visibility}  ${desc}  Updated ${date}`;
	});

	return lines.join("\n");
}

export function formatRepoView(data: unknown): string {
	if (!data || typeof data !== "object") {
		return "No repository data.";
	}

	const repo = data as RepoView;
	const fullName = `${authorLogin(repo.owner)}/${repo.name}`;
	const header = `${fullName} [${repo.visibility}]`;

	const desc = repo.description ?? "";

	const stars = `stars: ${repo.stargazerCount ?? 0}`;
	const forks = `forks: ${repo.forkCount ?? 0}`;
	const defaultBranch = repo.defaultBranchRef?.name ? `default branch: ${repo.defaultBranchRef.name}` : "";

	const statsParts = [stars, forks, defaultBranch].filter(Boolean).join(" | ");
	const dates = `Created: ${formatDate(repo.createdAt)} | Updated: ${formatDate(repo.updatedAt)}`;

	const lines = [header];
	if (desc) lines.push(desc);
	lines.push(statsParts, dates);

	return lines.join("\n");
}

// -- Workflow formatters --

export function formatWorkflowList(data: unknown): string {
	if (!Array.isArray(data) || data.length === 0) {
		return "No workflows found.";
	}

	const items = data as WorkflowListItem[];
	const lines = items.map((wf) => {
		const name = wf.name ?? "";
		const file = wf.path ? wf.path.split("/").pop() : "";
		const id = wf.id ?? "";
		return `${name}  ${file}  (id: ${id})`;
	});

	return lines.join("\n");
}
