/**
 * github_browse — remote GitHub repo browsing for Pi
 *
 * Adapted from maria-rcks/pi-github to fit pure-github's structure and
 * gh-cli-first approach.
 */

import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { StringEnum } from "@mariozechner/pi-ai";
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { type Static, Type } from "@sinclair/typebox";
import type { ExecOptions, PiExecFn } from "./gh-client";

export type BrowseAction =
	| "format"
	| "list_images"
	| "download_image"
	| "list_changes"
	| "get_change"
	| "list_issues"
	| "list_prs"
	| "pr_overview"
	| "list_pr_commits"
	| "get_pr_commit"
	| "list_review_comments"
	| "list_pr_checks"
	| "list_participants"
	| "read_file"
	| "list_directory"
	| "search_code"
	| "glob_files"
	| "search_commits";

export type BrowseEntity = "issue" | "pr" | "discussion";

export const BrowseParamsSchema = Type.Object({
	action: Type.Optional(
		StringEnum(
			[
				"format",
				"list_images",
				"download_image",
				"list_changes",
				"get_change",
				"list_issues",
				"list_prs",
				"pr_overview",
				"list_pr_commits",
				"get_pr_commit",
				"list_review_comments",
				"list_pr_checks",
				"list_participants",
				"read_file",
				"list_directory",
				"search_code",
				"glob_files",
				"search_commits",
			] as const,
			{
				description:
					"Action: browse files/dirs/code/commits, render issue/PR/discussion threads, inspect PR files/checks/commits, or extract/download images.",
			},
		),
	),
	id: Type.Optional(Type.Integer({ minimum: 1, description: "GitHub thread ID (issue/PR/discussion number)" })),
	entity: Type.Optional(
		StringEnum(["issue", "pr", "discussion"] as const, {
			description: "Entity type. Omit to auto-detect for thread/PR actions.",
		}),
	),
	owner: Type.Optional(
		Type.String({ description: "GitHub repository owner/org (optional; auto-detected from git origin when possible)" }),
	),
	repo: Type.Optional(Type.String({ description: "GitHub repository name (or owner/name shorthand)" })),
	number: Type.Optional(Type.Integer({ minimum: 1, description: "Deprecated alias for id" })),
	page: Type.Optional(Type.Integer({ minimum: 1, description: "Pagination page (default 1)" })),
	perPage: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, description: "Items per page (default 20)" })),
	imageId: Type.Optional(Type.Integer({ minimum: 1, description: "Image ID (for action=download_image)" })),
	changeId: Type.Optional(Type.Integer({ minimum: 1, description: "Change ID (for action=get_change)" })),
	patchId: Type.Optional(Type.Integer({ minimum: 1, description: "Alias for changeId" })),
	codeId: Type.Optional(Type.Integer({ minimum: 1, description: "Alias for changeId" })),
	tmpDir: Type.Optional(Type.String({ description: "Download directory for images (default /tmp)" })),
	path: Type.Optional(Type.String({ description: "File path filter or file path for file-focused actions" })),
	ref: Type.Optional(Type.String({ description: "Git ref (branch/tag/SHA) for ref-aware actions" })),
	startLine: Type.Optional(Type.Integer({ minimum: 1, description: "Start line for file output (1-indexed)" })),
	endLine: Type.Optional(Type.Integer({ minimum: 1, description: "End line for file output (1-indexed, inclusive)" })),
	commitSha: Type.Optional(Type.String({ description: "PR commit SHA for action=get_pr_commit" })),
	includeFiles: Type.Optional(
		Type.Boolean({ description: "Include changed files in action=pr_overview (default true)" }),
	),
	includeReviews: Type.Optional(
		Type.Boolean({ description: "Include review summary in action=pr_overview (default true)" }),
	),
	includeChecks: Type.Optional(
		Type.Boolean({ description: "Include checks summary in action=pr_overview (default true)" }),
	),
	author: Type.Optional(Type.String({ description: "Filter by author login" })),
	kind: Type.Optional(Type.String({ description: "Filter thread entries by kind" })),
	since: Type.Optional(Type.String({ description: "ISO date/time lower bound filter" })),
	until: Type.Optional(Type.String({ description: "ISO date/time upper bound filter" })),
	contains: Type.Optional(Type.String({ description: "Case-insensitive body substring filter" })),
	query: Type.Optional(Type.String({ description: "Search query for action=search_code/search_commits" })),
	filePattern: Type.Optional(Type.String({ description: "Glob pattern for action=glob_files" })),
	limit: Type.Optional(Type.Integer({ minimum: 1, description: "Maximum results for list/search actions" })),
	offset: Type.Optional(Type.Integer({ minimum: 0, description: "Offset for paginated glob results" })),
});

export type BrowseParams = Static<typeof BrowseParamsSchema>;

interface RepoCoordinates {
	owner: string;
	repo: string;
}

interface ThreadItem {
	kind: string;
	author: string;
	createdAt: string;
	url?: string;
	body: string;
}

interface ImageRef {
	id: number;
	url: string;
	alt?: string;
}

interface ChangeRef {
	id: number;
	filename: string;
	status: string;
	additions: number;
	deletions: number;
	changes: number;
	patch?: string;
	blobUrl?: string;
	rawUrl?: string;
	previousFilename?: string;
}

interface PrCommitRef {
	sha: string;
	author: string;
	date: string;
	message: string;
	url?: string;
}

interface PrCheckRef {
	name: string;
	status: string;
	conclusion?: string;
	startedAt?: string;
	completedAt?: string;
	url?: string;
}

interface PrCommitDetail {
	sha: string;
	author: string;
	date: string;
	message: string;
	url?: string;
	changes: Array<{
		filename: string;
		status: string;
		additions: number;
		deletions: number;
		changes: number;
		patch?: string;
	}>;
}

interface ReviewCommentRef {
	id: number;
	author: string;
	body: string;
	createdAt: string;
	url?: string;
	path?: string;
	line?: number;
}

interface ParticipantRef {
	login: string;
	roles: Array<"author" | "reviewer" | "commenter">;
	count: number;
}

interface PrOverview {
	number: number;
	title: string;
	state: string;
	draft: boolean;
	author: string;
	baseRef?: string;
	headRef?: string;
	headSha: string;
	url?: string;
	reviewCounts?: Record<string, number>;
	checks?: PrCheckRef[];
	changes?: ChangeRef[];
}

interface ThreadCacheEntry {
	items: ThreadItem[];
	cachedAt: number;
}

interface BrowseClient {
	ghJson: <T = unknown>(args: string[], options?: ExecOptions) => Promise<T>;
	ghText: (args: string[], options?: ExecOptions) => Promise<string>;
	fetchAllRestPages: (path: string) => Promise<any[]>;
	fetchRestPage: (path: string, page: number, perPage: number) => Promise<any[]>;
}

const REMOTE_PATTERNS = [
	/^git@github\.com:([^/]+)\/([^\s]+?)(?:\.git)?$/i,
	/^https?:\/\/github\.com\/([^/]+)\/([^\s/]+?)(?:\.git)?\/?$/i,
	/^ssh:\/\/git@github\.com\/([^/]+)\/([^\s/]+?)(?:\.git)?\/?$/i,
];

const CACHE_VERSION = "v1";
const MAX_CACHE_ENTRIES = 300;

class ThreadCache {
	private readonly memory = new Map<string, ThreadCacheEntry>();
	private readonly cacheDir = join(getAgentDir(), "pure", "cache", "pure-github-threads");

	async get(
		entity: BrowseEntity,
		owner: string,
		repo: string,
		number: number,
		fetcher: () => Promise<ThreadItem[]>,
	): Promise<ThreadItem[]> {
		const key = `${CACHE_VERSION}:${entity}:${owner}/${repo}#${number}`;
		const memoryCached = this.memory.get(key);
		if (memoryCached) return memoryCached.items;

		const diskCached = await this.readDisk(key);
		if (diskCached) {
			this.memory.set(key, diskCached);
			this.pruneMemory();
			return diskCached.items;
		}

		const entry: ThreadCacheEntry = {
			items: await fetcher(),
			cachedAt: Date.now(),
		};
		this.memory.set(key, entry);
		this.pruneMemory();
		await this.writeDisk(key, entry);
		return entry.items;
	}

	private fileForKey(key: string): string {
		return join(this.cacheDir, `${encodeURIComponent(key)}.json`);
	}

	private async readDisk(key: string): Promise<ThreadCacheEntry | null> {
		try {
			const raw = await readFile(this.fileForKey(key), "utf8");
			const parsed = JSON.parse(raw) as Partial<ThreadCacheEntry>;
			if (!Array.isArray(parsed.items)) return null;
			return {
				items: parsed.items,
				cachedAt: typeof parsed.cachedAt === "number" ? parsed.cachedAt : 0,
			};
		} catch {
			return null;
		}
	}

	private async writeDisk(key: string, entry: ThreadCacheEntry): Promise<void> {
		try {
			await mkdir(this.cacheDir, { recursive: true });
			await writeFile(this.fileForKey(key), JSON.stringify(entry));
			await this.pruneDisk();
		} catch {
			// ignore cache failures
		}
	}

	private async pruneDisk(): Promise<void> {
		try {
			const names = await readdir(this.cacheDir);
			if (names.length <= MAX_CACHE_ENTRIES) return;
			const files = await Promise.all(
				names.map(async (name) => {
					const file = join(this.cacheDir, name);
					const info = await stat(file);
					return { file, mtimeMs: info.mtimeMs };
				}),
			);
			files.sort((a, b) => b.mtimeMs - a.mtimeMs);
			for (const file of files.slice(MAX_CACHE_ENTRIES)) {
				await rm(file.file, { force: true });
			}
		} catch {
			// ignore cache failures
		}
	}

	private pruneMemory(): void {
		if (this.memory.size <= MAX_CACHE_ENTRIES) return;
		const entries = [...this.memory.entries()].sort((a, b) => (b[1].cachedAt ?? 0) - (a[1].cachedAt ?? 0));
		this.memory.clear();
		for (const [key, value] of entries.slice(0, MAX_CACHE_ENTRIES)) {
			this.memory.set(key, value);
		}
	}
}

function createBrowseClient(exec: PiExecFn, binaryPath: string, signal?: AbortSignal): BrowseClient {
	async function ghJson<T = unknown>(args: string[], options?: ExecOptions): Promise<T> {
		const result = await exec(binaryPath, args, {
			timeout: options?.timeout ?? 30000,
			signal: options?.signal ?? signal,
			cwd: options?.cwd,
		});
		if (result.code !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || `gh exited with code ${result.code}`);
		}
		try {
			return JSON.parse(result.stdout) as T;
		} catch {
			throw new Error(`Failed to parse JSON from gh output for args: ${args.join(" ")}`);
		}
	}

	async function ghText(args: string[], options?: ExecOptions): Promise<string> {
		const result = await exec(binaryPath, args, {
			timeout: options?.timeout ?? 30000,
			signal: options?.signal ?? signal,
			cwd: options?.cwd,
		});
		if (result.code !== 0) {
			throw new Error(result.stderr.trim() || result.stdout.trim() || `gh exited with code ${result.code}`);
		}
		return result.stdout;
	}

	async function fetchAllRestPages(path: string): Promise<any[]> {
		const out: any[] = [];
		let page = 1;

		while (true) {
			const separator = path.includes("?") ? "&" : "?";
			const url = `${path}${separator}per_page=100&page=${page}`;
			const data = await ghJson<any[]>(["api", url]);
			if (!Array.isArray(data)) {
				throw new Error(`GitHub API error for ${url}: non-array response`);
			}
			if (data.length === 0) break;
			out.push(...data);
			if (data.length < 100) break;
			page += 1;
		}

		return out;
	}

	async function fetchRestPage(path: string, page: number, perPage: number): Promise<any[]> {
		const separator = path.includes("?") ? "&" : "?";
		const url = `${path}${separator}per_page=${perPage}&page=${page}`;
		const data = await ghJson<any[]>(["api", url]);
		if (!Array.isArray(data)) {
			throw new Error(`GitHub API error for ${url}: non-array response`);
		}
		return data;
	}

	return {
		ghJson,
		ghText,
		fetchAllRestPages,
		fetchRestPage,
	};
}

function parseGitHubRemote(remoteUrl: string): RepoCoordinates | null {
	const url = remoteUrl.trim();
	for (const pattern of REMOTE_PATTERNS) {
		const match = url.match(pattern);
		if (match) {
			return { owner: match[1], repo: match[2] };
		}
	}
	return null;
}

async function resolveRepoCoordinates(
	exec: PiExecFn,
	getCwd: () => string,
	defaultOwner: string | undefined,
	rawOwner?: string,
	rawRepo?: string,
): Promise<RepoCoordinates> {
	const owner = rawOwner?.trim() ?? "";
	const repo = rawRepo?.trim() ?? "";

	if (owner && repo) {
		return { owner, repo };
	}

	if (!owner && repo.includes("/")) {
		const [parsedOwner, parsedRepo] = repo.split("/", 2);
		if (parsedOwner && parsedRepo) {
			return { owner: parsedOwner, repo: parsedRepo };
		}
	}

	if (!owner && repo && defaultOwner) {
		return { owner: defaultOwner, repo };
	}

	const remoteResult = await exec("git", ["remote", "get-url", "origin"], {
		timeout: 5000,
		cwd: getCwd(),
	});
	if (remoteResult.code !== 0) {
		throw new Error("Could not detect GitHub repo from git origin. Pass owner/repo explicitly.");
	}
	const parsed = parseGitHubRemote(remoteResult.stdout.trim());
	if (!parsed) {
		throw new Error(`Could not parse GitHub origin URL: ${remoteResult.stdout.trim()}`);
	}
	return parsed;
}

async function inferEntity(client: BrowseClient, owner: string, repo: string, id: number): Promise<BrowseEntity> {
	try {
		const issueLike = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/issues/${id}`]);
		return issueLike?.pull_request ? "pr" : "issue";
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		const notFound = message.includes("Not Found") || message.includes("HTTP 404") || message.includes(": 404");
		if (!notFound) throw error;
	}

	const query = `
query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      id
    }
  }
}
`;

	const payload = await client.ghJson<any>([
		"api",
		"graphql",
		"-f",
		`query=${query}`,
		"-F",
		`owner=${owner}`,
		"-F",
		`repo=${repo}`,
		"-F",
		`number=${id}`,
	]);

	if (payload?.data?.repository?.discussion?.id) return "discussion";
	throw new Error(`No issue, PR, or discussion found for id ${id} in ${owner}/${repo}`);
}

async function fetchIssueThread(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
): Promise<ThreadItem[]> {
	const issue = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/issues/${number}`]);
	const comments = await client.fetchAllRestPages(`/repos/${owner}/${repo}/issues/${number}/comments`);
	const items: ThreadItem[] = [
		{
			kind: "issue",
			author: issue.user?.login ?? "unknown",
			createdAt: safeIso(issue.created_at),
			url: issue.html_url,
			body: trimBody(issue.body),
		},
	];

	for (const comment of comments) {
		items.push({
			kind: "issue_comment",
			author: comment.user?.login ?? "unknown",
			createdAt: safeIso(comment.created_at),
			url: comment.html_url,
			body: trimBody(comment.body),
		});
	}

	items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return items;
}

async function fetchPrThread(client: BrowseClient, owner: string, repo: string, number: number): Promise<ThreadItem[]> {
	const pr = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/pulls/${number}`]);
	const issueComments = await client.fetchAllRestPages(`/repos/${owner}/${repo}/issues/${number}/comments`);
	const reviews = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/reviews`);
	const reviewComments = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/comments`);

	const items: ThreadItem[] = [
		{
			kind: "pull_request",
			author: pr.user?.login ?? "unknown",
			createdAt: safeIso(pr.created_at),
			url: pr.html_url,
			body: trimBody(pr.body),
		},
	];

	for (const comment of issueComments) {
		items.push({
			kind: "issue_comment",
			author: comment.user?.login ?? "unknown",
			createdAt: safeIso(comment.created_at),
			url: comment.html_url,
			body: trimBody(comment.body),
		});
	}

	for (const review of reviews) {
		items.push({
			kind: `review_${String(review.state ?? "commented").toLowerCase()}`,
			author: review.user?.login ?? "unknown",
			createdAt: safeIso(review.submitted_at ?? review.created_at),
			url: review.html_url,
			body: trimBody(review.body),
		});
	}

	for (const reviewComment of reviewComments) {
		const path = reviewComment.path
			? `\n\n_File: ${reviewComment.path}${typeof reviewComment.line === "number" ? `:${reviewComment.line}` : ""}_`
			: "";
		items.push({
			kind: "review_comment",
			author: reviewComment.user?.login ?? "unknown",
			createdAt: safeIso(reviewComment.created_at),
			url: reviewComment.html_url,
			body: `${trimBody(reviewComment.body)}${path}`.trim(),
		});
	}

	items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return items;
}

async function fetchDiscussionThread(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
): Promise<ThreadItem[]> {
	const query = `
query($owner: String!, $repo: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $repo) {
    discussion(number: $number) {
      title
      url
      createdAt
      body
      author { login }
      comments(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          createdAt
          body
          url
          author { login }
          replies(first: 100) {
            nodes {
              createdAt
              body
              url
              author { login }
            }
          }
        }
      }
    }
  }
}
`;

	const items: ThreadItem[] = [];
	let after: string | null = null;
	let seeded = false;

	while (true) {
		const args = [
			"api",
			"graphql",
			"-f",
			`query=${query}`,
			"-F",
			`owner=${owner}`,
			"-F",
			`repo=${repo}`,
			"-F",
			`number=${number}`,
		];
		if (after) args.push("-F", `after=${after}`);

		const payload = await client.ghJson<any>(args);
		const discussion = payload?.data?.repository?.discussion;
		if (!discussion) break;

		if (!seeded) {
			items.push({
				kind: "discussion",
				author: discussion.author?.login ?? "unknown",
				createdAt: safeIso(discussion.createdAt),
				url: discussion.url,
				body: trimBody(discussion.body),
			});
			seeded = true;
		}

		for (const comment of discussion.comments?.nodes ?? []) {
			items.push({
				kind: "discussion_comment",
				author: comment.author?.login ?? "unknown",
				createdAt: safeIso(comment.createdAt),
				url: comment.url,
				body: trimBody(comment.body),
			});

			for (const reply of comment.replies?.nodes ?? []) {
				items.push({
					kind: "discussion_reply",
					author: reply.author?.login ?? "unknown",
					createdAt: safeIso(reply.createdAt),
					url: reply.url,
					body: trimBody(reply.body),
				});
			}
		}

		const pageInfo = discussion.comments?.pageInfo;
		if (!pageInfo?.hasNextPage) break;
		after = pageInfo.endCursor;
	}

	items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
	return items;
}

async function fetchThread(
	client: BrowseClient,
	entity: BrowseEntity,
	owner: string,
	repo: string,
	number: number,
): Promise<ThreadItem[]> {
	if (entity === "issue") return fetchIssueThread(client, owner, repo, number);
	if (entity === "pr") return fetchPrThread(client, owner, repo, number);
	return fetchDiscussionThread(client, owner, repo, number);
}

async function fetchPrChanges(client: BrowseClient, owner: string, repo: string, number: number): Promise<ChangeRef[]> {
	const files = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/files`);
	let id = 1;
	return files.map((file) => ({
		id: id++,
		filename: String(file.filename ?? "unknown"),
		status: String(file.status ?? "modified"),
		additions: Number(file.additions ?? 0),
		deletions: Number(file.deletions ?? 0),
		changes: Number(file.changes ?? 0),
		patch: typeof file.patch === "string" ? file.patch : undefined,
		blobUrl: typeof file.blob_url === "string" ? file.blob_url : undefined,
		rawUrl: typeof file.raw_url === "string" ? file.raw_url : undefined,
		previousFilename: typeof file.previous_filename === "string" ? file.previous_filename : undefined,
	}));
}

async function fetchPrCommits(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
): Promise<PrCommitRef[]> {
	const commits = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/commits`);
	return commits.map((commit) => ({
		sha: String(commit.sha ?? ""),
		author: String(commit.author?.login ?? commit.commit?.author?.name ?? "unknown"),
		date: safeIso(commit.commit?.author?.date),
		message:
			String(commit.commit?.message ?? "")
				.split("\n")[0]
				?.trim() ?? "",
		url: typeof commit.html_url === "string" ? commit.html_url : undefined,
	}));
}

async function fetchPrCommitDetail(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
	commitSha: string,
): Promise<PrCommitDetail> {
	const commits = await fetchPrCommits(client, owner, repo, number);
	const match = commits.find((commit) => commit.sha === commitSha || commit.sha.startsWith(commitSha));
	if (!match) {
		throw new Error(`commitSha ${commitSha} not found in PR #${number}`);
	}

	const payload = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/commits/${match.sha}`]);
	const files = Array.isArray(payload?.files) ? payload.files : [];
	return {
		sha: match.sha,
		author: String(payload?.author?.login ?? payload?.commit?.author?.name ?? match.author),
		date: safeIso(payload?.commit?.author?.date ?? match.date),
		message: String(payload?.commit?.message ?? match.message).trim(),
		url: typeof payload?.html_url === "string" ? payload.html_url : match.url,
		changes: files.map((file: any) => ({
			filename: String(file.filename ?? "unknown"),
			status: String(file.status ?? "modified"),
			additions: Number(file.additions ?? 0),
			deletions: Number(file.deletions ?? 0),
			changes: Number(file.changes ?? 0),
			patch: typeof file.patch === "string" ? file.patch : undefined,
		})),
	};
}

async function fetchPrChecks(
	client: BrowseClient,
	owner: string,
	repo: string,
	headSha: string,
): Promise<PrCheckRef[]> {
	const checks = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/commits/${headSha}/check-runs`]);
	const runs = Array.isArray(checks?.check_runs) ? checks.check_runs : [];
	return runs.map((run) => ({
		name: String(run.name ?? "unknown"),
		status: String(run.status ?? "unknown"),
		conclusion: typeof run.conclusion === "string" ? run.conclusion : undefined,
		startedAt: safeIso(run.started_at),
		completedAt: safeIso(run.completed_at),
		url: typeof run.html_url === "string" ? run.html_url : undefined,
	}));
}

async function fetchPrOverview(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
	options: { includeFiles: boolean; includeReviews: boolean; includeChecks: boolean },
): Promise<PrOverview> {
	const pr = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/pulls/${number}`]);
	const headSha = String(pr?.head?.sha ?? "").trim();
	if (!headSha) {
		throw new Error(`Could not resolve PR head SHA for #${number}`);
	}

	const overview: PrOverview = {
		number,
		title: String(pr?.title ?? "(no title)"),
		state: String(pr?.state ?? "unknown"),
		draft: Boolean(pr?.draft),
		author: String(pr?.user?.login ?? "unknown"),
		baseRef: typeof pr?.base?.ref === "string" ? pr.base.ref : undefined,
		headRef: typeof pr?.head?.ref === "string" ? pr.head.ref : undefined,
		headSha,
		url: typeof pr?.html_url === "string" ? pr.html_url : undefined,
	};

	if (options.includeReviews) {
		const reviews = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/reviews`);
		const counts: Record<string, number> = {};
		for (const review of reviews) {
			const key = String(review?.state ?? "COMMENTED").toLowerCase();
			counts[key] = (counts[key] ?? 0) + 1;
		}
		overview.reviewCounts = counts;
	}

	if (options.includeChecks) {
		overview.checks = await fetchPrChecks(client, owner, repo, headSha);
	}

	if (options.includeFiles) {
		overview.changes = await fetchPrChanges(client, owner, repo, number);
	}

	return overview;
}

async function fetchReviewComments(
	client: BrowseClient,
	owner: string,
	repo: string,
	number: number,
): Promise<ReviewCommentRef[]> {
	const comments = await client.fetchAllRestPages(`/repos/${owner}/${repo}/pulls/${number}/comments`);
	let id = 1;
	return comments.map((comment) => ({
		id: id++,
		author: comment.user?.login ?? "unknown",
		body: trimBody(comment.body),
		createdAt: safeIso(comment.created_at),
		url: typeof comment.html_url === "string" ? comment.html_url : undefined,
		path: typeof comment.path === "string" ? comment.path : undefined,
		line: typeof comment.line === "number" ? comment.line : undefined,
	}));
}

function decodeBase64(content: string): string {
	return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

async function fetchRepoFile(
	client: BrowseClient,
	owner: string,
	repo: string,
	path: string,
	ref?: string,
): Promise<string> {
	const separator = path.includes("?") ? "&" : "?";
	const suffix = ref ? `${separator}ref=${encodeURIComponent(ref)}` : "";
	const payload = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/contents/${path}${suffix}`]);
	if (Array.isArray(payload)) {
		throw new Error(`Path ${path} is a directory, not a file`);
	}
	const encoding = String(payload?.encoding ?? "").toLowerCase();
	const content = String(payload?.content ?? "");
	return encoding === "base64" ? decodeBase64(content) : content;
}

async function fetchRepoDirectory(
	client: BrowseClient,
	owner: string,
	repo: string,
	path: string,
	ref?: string,
): Promise<Array<{ name: string; type: "file" | "dir"; path: string }>> {
	const normalizedPath = path.trim().replace(/^\//, "");
	const separator = normalizedPath.includes("?") ? "&" : "?";
	const suffix = ref ? `${separator}ref=${encodeURIComponent(ref)}` : "";
	const payload = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/contents/${normalizedPath}${suffix}`]);
	if (!Array.isArray(payload)) {
		throw new Error(`Path ${normalizedPath || "."} is not a directory`);
	}
	return payload.map((item) => ({
		name: String(item?.name ?? "unknown"),
		type: item?.type === "dir" ? "dir" : "file",
		path: String(item?.path ?? ""),
	}));
}

async function searchRepoCode(
	client: BrowseClient,
	owner: string,
	repo: string,
	query: string,
	path?: string,
	page = 1,
	perPage = 20,
): Promise<Array<{ path: string; url?: string; snippets: string[] }>> {
	const pathSegment = path?.trim() ? ` path:${path.trim()}` : "";
	const q = `${query} repo:${owner}/${repo}${pathSegment}`;
	const payload = await client.ghJson<any>([
		"api",
		"-H",
		"Accept: application/vnd.github.v3.text-match+json",
		`/search/code?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`,
	]);
	const items = Array.isArray(payload?.items) ? payload.items : [];
	return items.map((item) => ({
		path: String(item?.path ?? ""),
		url: typeof item?.html_url === "string" ? item.html_url : undefined,
		snippets: Array.isArray(item?.text_matches)
			? item.text_matches
					.filter((match: any) => match?.property === "content" && typeof match?.fragment === "string")
					.map((match: any) => String(match.fragment).trim())
			: [],
	}));
}

async function fetchRepoTreeFiles(client: BrowseClient, owner: string, repo: string, ref?: string): Promise<string[]> {
	const targetRef = ref?.trim() || "HEAD";
	const payload = await client.ghJson<any>([
		"api",
		`/repos/${owner}/${repo}/git/trees/${encodeURIComponent(targetRef)}?recursive=1`,
	]);
	const tree = Array.isArray(payload?.tree) ? payload.tree : [];
	return tree.filter((item) => item?.type === "blob").map((item) => String(item.path ?? ""));
}

async function searchRepoCommits(
	client: BrowseClient,
	owner: string,
	repo: string,
	params: { query?: string; author?: string; since?: string; until?: string; page?: number; perPage?: number },
): Promise<Array<{ sha: string; message: string; author: string; date: string; url?: string }>> {
	const parts: string[] = [];
	if (params.query?.trim()) parts.push(params.query.trim());
	parts.push(`repo:${owner}/${repo}`);
	if (params.author?.trim()) parts.push(`author:${params.author.trim()}`);
	if (params.since?.trim()) parts.push(`author-date:>=${params.since.trim()}`);
	if (params.until?.trim()) parts.push(`author-date:<=${params.until.trim()}`);
	const q = parts.join(" ");
	const page = Math.max(1, Number(params.page ?? 1));
	const perPage = Math.max(1, Math.min(100, Number(params.perPage ?? 20)));
	const payload = await client.ghJson<any>([
		"api",
		"-H",
		"Accept: application/vnd.github+json",
		`/search/commits?q=${encodeURIComponent(q)}&page=${page}&per_page=${perPage}`,
	]);
	const items = Array.isArray(payload?.items) ? payload.items : [];
	return items.map((item) => ({
		sha: String(item?.sha ?? ""),
		message:
			String(item?.commit?.message ?? "")
				.split("\n")[0]
				?.trim() ?? "",
		author: String(item?.commit?.author?.name ?? item?.author?.login ?? "unknown"),
		date: safeIso(item?.commit?.author?.date),
		url: typeof item?.html_url === "string" ? item.html_url : undefined,
	}));
}

function mdEscape(input: string): string {
	return input.replace(/\|/g, "\\|").replace(/\r/g, "");
}

function trimBody(body: string | null | undefined): string {
	return (body ?? "").trim();
}

function safeIso(iso: string | null | undefined): string {
	return iso || "unknown-time";
}

function formatSimpleDate(iso: string): string {
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "unknown-date";
	return `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;
}

function formatKindLabel(kind: string): string {
	return kind
		.split("_")
		.map((word) => (word ? word[0].toUpperCase() + word.slice(1) : word))
		.join(" ");
}

function imageExtFromUrl(url: string): string {
	const clean = url.split("?")[0] ?? url;
	const ext = extname(clean).toLowerCase();
	if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(ext)) return ext;
	return ".img";
}

function parseImagesFromMarkdown(markdown: string): Array<{ url: string; alt?: string }> {
	const out: Array<{ url: string; alt?: string }> = [];

	for (const match of markdown.matchAll(/!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g)) {
		const alt = match[1] ?? "";
		const url = (match[2] ?? "").replace(/[)>]+$/, "").trim();
		if (url) out.push({ url, alt });
	}

	for (const match of markdown.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi)) {
		const url = (match[1] ?? "").trim();
		if (url) out.push({ url });
	}

	for (const match of markdown.matchAll(/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s"')<>]+)?)/gi)) {
		const url = (match[1] ?? "").trim();
		if (url) out.push({ url });
	}

	return out;
}

function collectImages(items: ThreadItem[]): ImageRef[] {
	const seen = new Map<string, ImageRef>();
	let id = 1;

	for (const item of items) {
		for (const image of parseImagesFromMarkdown(item.body)) {
			if (!seen.has(image.url)) {
				seen.set(image.url, { id, url: image.url, alt: image.alt });
				id += 1;
			}
		}
	}

	return [...seen.values()].sort((a, b) => a.id - b.id);
}

function replaceImagesWithTags(markdown: string, images: ImageRef[]): string {
	if (!markdown) return markdown;
	const byUrl = new Map(images.map((image) => [image.url, image.id]));

	let next = markdown.replace(/!\[([^\]]*)\]\((\S+?)(?:\s+"[^"]*")?\)/g, (full, _alt, rawUrl) => {
		const url = String(rawUrl ?? "")
			.replace(/[)>]+$/, "")
			.trim();
		const id = byUrl.get(url);
		return id ? `[image #${id}]` : full;
	});

	next = next.replace(/<img[^>]*src=["']([^"']+)["'][^>]*>/gi, (full, rawUrl) => {
		const url = String(rawUrl ?? "").trim();
		const id = byUrl.get(url);
		return id ? `[image #${id}]` : full;
	});

	next = next.replace(/(https?:\/\/\S+\.(?:png|jpe?g|gif|webp|svg|bmp)(?:\?[^\s"')<>]+)?)/gi, (full, rawUrl) => {
		const url = String(rawUrl ?? "").trim();
		const id = byUrl.get(url);
		return id ? `[image #${id}]` : full;
	});

	return next;
}

function toEpoch(raw?: string): number | undefined {
	if (!raw) return undefined;
	const ms = Date.parse(raw);
	return Number.isFinite(ms) ? ms : undefined;
}

function applyThreadFilters(
	items: ThreadItem[],
	filters: { author?: string; kind?: string; since?: string; until?: string; contains?: string },
): ThreadItem[] {
	const author = filters.author?.trim().toLowerCase();
	const kind = filters.kind?.trim().toLowerCase();
	const contains = filters.contains?.trim().toLowerCase();
	const since = toEpoch(filters.since);
	const until = toEpoch(filters.until);

	return items.filter((item) => {
		if (author && item.author.toLowerCase() !== author) return false;
		if (kind && item.kind.toLowerCase() !== kind) return false;
		if (contains && !item.body.toLowerCase().includes(contains)) return false;
		if (since !== undefined || until !== undefined) {
			const at = Date.parse(item.createdAt);
			if (!Number.isFinite(at)) return false;
			if (since !== undefined && at < since) return false;
			if (until !== undefined && at > until) return false;
		}
		return true;
	});
}

function collectParticipants(items: ThreadItem[]): ParticipantRef[] {
	const byUser = new Map<string, { roles: Set<"author" | "reviewer" | "commenter">; count: number }>();

	for (const item of items) {
		const login = item.author?.trim();
		if (!login) continue;
		const roles = byUser.get(login) ?? { roles: new Set(), count: 0 };
		roles.roles.add(roleFromKind(item.kind));
		roles.count += 1;
		byUser.set(login, roles);
	}

	return [...byUser.entries()]
		.map(([login, data]) => ({ login, roles: [...data.roles].sort(), count: data.count }))
		.sort((a, b) => b.count - a.count || a.login.localeCompare(b.login));
}

function roleFromKind(kind: string): "author" | "reviewer" | "commenter" {
	if (kind === "issue" || kind === "pull_request" || kind === "discussion") return "author";
	if (kind.startsWith("review_")) return "reviewer";
	return "commenter";
}

function escapeRegexChar(char: string): string {
	return /[\\^$+?.()|{}[\]]/.test(char) ? `\\${char}` : char;
}

function globToRegex(pattern: string): RegExp {
	const withToken = pattern.replace(/\*\*\//g, "::GLOBSTAR_DIR::");
	let out = "";

	for (let i = 0; i < withToken.length; i += 1) {
		if (withToken.startsWith("::GLOBSTAR_DIR::", i)) {
			out += "(?:.*/)?";
			i += "::GLOBSTAR_DIR::".length - 1;
			continue;
		}

		const ch = withToken[i]!;
		const next = withToken[i + 1];
		if (ch === "*" && next === "*") {
			out += ".*";
			i += 1;
			continue;
		}
		if (ch === "*") {
			out += "[^/]*";
			continue;
		}
		if (ch === "?") {
			out += "[^/]";
			continue;
		}
		if (ch === "{") {
			const end = withToken.indexOf("}", i + 1);
			if (end > i) {
				const inner = withToken.slice(i + 1, end);
				const parts = inner
					.split(",")
					.map((part) => part.trim())
					.filter(Boolean)
					.map((part) => part.split("").map(escapeRegexChar).join(""));
				out += parts.length > 0 ? `(?:${parts.join("|")})` : "";
				i = end;
				continue;
			}
		}
		out += escapeRegexChar(ch);
	}

	return new RegExp(`^${out}$`);
}

function globMatch(paths: string[], pattern: string): string[] {
	const regex = globToRegex(pattern);
	return paths.filter((path) => regex.test(path));
}

function renderThreadMarkdown(params: {
	entity: BrowseEntity;
	owner: string;
	repo: string;
	number: number;
	page: number;
	perPage: number;
	items: ThreadItem[];
	images: ImageRef[];
	changes?: ChangeRef[];
	filteredFromTotal?: number;
}): string {
	const { entity, owner, repo, number, page, perPage, items, images, changes, filteredFromTotal } = params;
	const total = items.length;
	const totalPages = Math.max(1, Math.ceil(total / perPage));
	const normalizedPage = Math.min(Math.max(1, page), totalPages);
	const start = (normalizedPage - 1) * perPage;
	const paged = items.slice(start, start + perPage);

	const lines: string[] = [];
	lines.push(`# ${entity.toUpperCase()} ${owner}/${repo}#${number}`);
	const rangeStart = total === 0 ? 0 : start + 1;
	lines.push(`(${rangeStart}-${Math.min(start + perPage, total)} of ${total}, page ${normalizedPage}/${totalPages})`);
	if (typeof filteredFromTotal === "number" && filteredFromTotal >= total && filteredFromTotal !== total) {
		lines.push(`filtered_items: ${total} (from ${filteredFromTotal})`);
	}
	lines.push("");

	for (const [index, item] of paged.entries()) {
		const n = start + index + 1;
		lines.push(
			`## ${n}. ${formatKindLabel(item.kind)} | ${mdEscape(item.author)} <@${mdEscape(item.author)}> (${formatSimpleDate(item.createdAt)})`,
		);
		lines.push("");
		lines.push(replaceImagesWithTags(item.body, images) || "_No body text_");
		lines.push("");
	}

	const pageImageSet = new Set<number>();
	for (const item of paged) {
		for (const image of parseImagesFromMarkdown(item.body)) {
			const match = images.find((candidate) => candidate.url === image.url);
			if (match) pageImageSet.add(match.id);
		}
	}

	if (pageImageSet.size > 0) {
		lines.push("## Images in this page");
		lines.push("");
		for (const id of [...pageImageSet].sort((a, b) => a - b)) {
			const image = images.find((candidate) => candidate.id === id);
			if (image) lines.push(`- image #${image.id}: ${image.url}`);
		}
		lines.push("");
		lines.push("Use action=download_image with imageId to download to /tmp.");
		lines.push("");
	}

	if (entity === "pr" && Array.isArray(changes) && changes.length > 0) {
		lines.push("## Changed files");
		lines.push("");
		for (const change of changes) {
			const patchState = change.patch ? "patch available" : "patch unavailable";
			lines.push(
				`- change #${change.id}: ${change.filename} (${change.status}, +${change.additions} -${change.deletions}, ${patchState})`,
			);
		}
		lines.push("");
		lines.push("Use action=get_change with changeId (or patchId/codeId) to retrieve the diff for one file.");
		lines.push("");
	}

	return lines.join("\n").trim();
}

function renderImagesListMarkdown(
	entity: BrowseEntity,
	owner: string,
	repo: string,
	number: number,
	images: ImageRef[],
): string {
	const lines = [
		"---",
		`entity: ${entity}`,
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_images: ${images.length}`,
		"---",
		"",
		`# Images for ${entity.toUpperCase()} ${owner}/${repo}#${number}`,
		"",
	];
	if (images.length === 0) {
		lines.push("No images found.");
	} else {
		for (const image of images) lines.push(`- image #${image.id}: ${image.url}`);
	}
	return lines.join("\n");
}

function renderChangesListMarkdown(owner: string, repo: string, number: number, changes: ChangeRef[]): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_changes: ${changes.length}`,
		"---",
		"",
		`# Changes for PR ${owner}/${repo}#${number}`,
		"",
	];
	if (changes.length === 0) {
		lines.push("No changed files found.");
	} else {
		for (const change of changes) {
			const patchState = change.patch ? "patch available" : "patch unavailable";
			lines.push(
				`- change #${change.id}: ${change.filename} (${change.status}, +${change.additions} -${change.deletions}, ${patchState})`,
			);
		}
		lines.push("");
		lines.push("Use action=get_change with changeId (or patchId/codeId) to retrieve a file diff.");
	}
	return lines.join("\n");
}

function renderIssuesListMarkdown(owner: string, repo: string, page: number, perPage: number, issues: any[]): string {
	const lines = [
		"---",
		"entity: issue",
		`repo: ${owner}/${repo}`,
		`page: ${page}`,
		`per_page: ${perPage}`,
		`items_on_page: ${issues.length}`,
		"---",
		"",
		`# Issues for ${owner}/${repo}`,
		"",
	];
	if (issues.length === 0) {
		lines.push("No issues found on this page.");
	} else {
		for (const issue of issues) {
			const number = Number(issue.number ?? 0);
			const state = String(issue.state ?? "unknown");
			const title = String(issue.title ?? "(no title)")
				.replace(/\r?\n/g, " ")
				.trim();
			const author = String(issue.user?.login ?? "unknown");
			const updated = safeIso(issue.updated_at);
			const url = String(issue.html_url ?? "");
			lines.push(
				`- #${number} [${state}] ${title} (@${author}, updated ${formatSimpleDate(updated)})${url ? ` - ${url}` : ""}`,
			);
		}
	}
	return lines.join("\n");
}

function renderPrsListMarkdown(owner: string, repo: string, page: number, perPage: number, prs: any[]): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`page: ${page}`,
		`per_page: ${perPage}`,
		`items_on_page: ${prs.length}`,
		"---",
		"",
		`# Pull requests for ${owner}/${repo}`,
		"",
	];
	if (prs.length === 0) {
		lines.push("No pull requests found on this page.");
	} else {
		for (const pr of prs) {
			const number = Number(pr.number ?? 0);
			const state = String(pr.state ?? "unknown");
			const title = String(pr.title ?? "(no title)")
				.replace(/\r?\n/g, " ")
				.trim();
			const author = String(pr.user?.login ?? "unknown");
			const updated = safeIso(pr.updated_at);
			const draft = pr.draft ? " draft" : "";
			const url = String(pr.html_url ?? "");
			lines.push(
				`- #${number} [${state}${draft}] ${title} (@${author}, updated ${formatSimpleDate(updated)})${url ? ` - ${url}` : ""}`,
			);
		}
	}
	return lines.join("\n");
}

function renderPrCommitsMarkdown(owner: string, repo: string, number: number, commits: PrCommitRef[]): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_commits: ${commits.length}`,
		"---",
		"",
		`# Commits for PR ${owner}/${repo}#${number}`,
		"",
	];
	if (commits.length === 0) {
		lines.push("No commits found.");
	} else {
		for (const commit of commits) {
			lines.push(
				`- ${commit.sha.slice(0, 7)} @${commit.author} (${formatSimpleDate(commit.date)}) ${commit.message}${commit.url ? ` - ${commit.url}` : ""}`,
			);
		}
	}
	return lines.join("\n");
}

function renderPrCommitMarkdown(owner: string, repo: string, number: number, commit: PrCommitDetail): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`commit: ${commit.sha}`,
		`author: ${commit.author}`,
		`date: ${commit.date}`,
		`files_changed: ${commit.changes.length}`,
		"---",
		"",
		`# Commit ${commit.sha.slice(0, 7)} for PR ${owner}/${repo}#${number}`,
		"",
		commit.message || "(no message)",
		"",
	];
	for (const change of commit.changes) {
		lines.push(`## ${change.filename} (${change.status}, +${change.additions} -${change.deletions})`);
		if (change.patch) {
			lines.push("```diff");
			lines.push(change.patch);
			lines.push("```");
		} else {
			lines.push("_Patch unavailable_");
		}
		lines.push("");
	}
	return lines.join("\n").trim();
}

function renderPrChecksMarkdown(owner: string, repo: string, number: number, checks: PrCheckRef[]): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_checks: ${checks.length}`,
		"---",
		"",
		`# Checks for PR ${owner}/${repo}#${number}`,
		"",
	];
	if (checks.length === 0) {
		lines.push("No check runs found.");
	} else {
		for (const check of checks) {
			const outcome = check.conclusion ? `${check.status}/${check.conclusion}` : check.status;
			lines.push(`- ${check.name}: ${outcome}${check.url ? ` - ${check.url}` : ""}`);
		}
	}
	return lines.join("\n");
}

function renderCommitSearchMarkdown(
	owner: string,
	repo: string,
	query: string,
	results: Array<{ sha: string; message: string; author: string; date: string; url?: string }>,
): string {
	const lines = [
		"---",
		`repo: ${owner}/${repo}`,
		`query: ${query}`,
		`results: ${results.length}`,
		"---",
		"",
		`# Commit search results for ${owner}/${repo}`,
		"",
	];
	if (results.length === 0) {
		lines.push("No commits found.");
	} else {
		for (const result of results) {
			lines.push(
				`- ${result.sha.slice(0, 7)} ${formatSimpleDate(result.date)} @${result.author}: ${result.message}${result.url ? ` - ${result.url}` : ""}`,
			);
		}
	}
	return lines.join("\n");
}

function renderGlobMarkdown(owner: string, repo: string, pattern: string, files: string[], total: number): string {
	const lines = [
		"---",
		`repo: ${owner}/${repo}`,
		`pattern: ${pattern}`,
		`results: ${files.length}`,
		`total_matches: ${total}`,
		"---",
		"",
		`# Glob results for ${owner}/${repo}`,
		"",
	];
	if (files.length === 0) {
		lines.push("No files matched.");
	} else {
		for (const file of files) lines.push(`- ${file}`);
	}
	return lines.join("\n");
}

function renderCodeSearchMarkdown(
	owner: string,
	repo: string,
	query: string,
	results: Array<{ path: string; url?: string; snippets: string[] }>,
): string {
	const lines = [
		"---",
		`repo: ${owner}/${repo}`,
		`query: ${query}`,
		`results: ${results.length}`,
		"---",
		"",
		`# Code search results for ${owner}/${repo}`,
		"",
	];
	if (results.length === 0) {
		lines.push("No results found.");
	} else {
		for (const [index, result] of results.entries()) {
			lines.push(`${index + 1}. ${result.path}${result.url ? ` - ${result.url}` : ""}`);
			for (const snippet of result.snippets.slice(0, 2)) {
				lines.push(`   - ${snippet.replace(/\r?\n/g, " ")}`);
			}
		}
	}
	return lines.join("\n");
}

function renderDirectoryMarkdown(
	owner: string,
	repo: string,
	path: string,
	entries: Array<{ name: string; type: "file" | "dir"; path: string }>,
): string {
	const sorted = [...entries].sort((a, b) => {
		if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
		return a.name.localeCompare(b.name);
	});
	const lines = sorted.map((entry) => `${entry.type === "dir" ? "[dir]" : "[file]"} ${entry.path || entry.name}`);
	return [
		"---",
		`repo: ${owner}/${repo}`,
		`path: ${path || "."}`,
		`entries: ${entries.length}`,
		"---",
		"",
		lines.length > 0 ? lines.join("\n") : "(empty directory)",
	]
		.join("\n")
		.trim();
}

function renderFileMarkdown(
	owner: string,
	repo: string,
	path: string,
	content: string,
	startLine = 1,
	endLine?: number,
): string {
	const lines = content.split("\n");
	const startIndex = Math.max(0, startLine - 1);
	const endIndex = typeof endLine === "number" ? Math.max(startIndex, endLine) : lines.length;
	const selected = lines.slice(startIndex, endIndex);
	const numbered = selected.map((line, index) => `${startLine + index}: ${line}`);
	return ["---", `repo: ${owner}/${repo}`, `path: ${path}`, `lines: ${numbered.length}`, "---", "", numbered.join("\n")]
		.join("\n")
		.trim();
}

function renderPrOverviewMarkdown(owner: string, repo: string, overview: PrOverview): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${overview.number}`,
		`state: ${overview.state}`,
		`draft: ${overview.draft}`,
		`head_sha: ${overview.headSha}`,
		"---",
		"",
		`# PR ${owner}/${repo}#${overview.number}: ${overview.title}`,
		"",
		`- Author: @${overview.author}`,
		`- State: ${overview.state}${overview.draft ? " (draft)" : ""}`,
	];
	if (overview.baseRef || overview.headRef) {
		lines.push(`- Branches: ${overview.headRef ?? "?"} -> ${overview.baseRef ?? "?"}`);
	}
	if (overview.url) lines.push(`- URL: ${overview.url}`);
	lines.push("");

	if (overview.reviewCounts) {
		const entries = Object.entries(overview.reviewCounts).sort((a, b) => b[1] - a[1]);
		lines.push("## Reviews");
		if (entries.length === 0) lines.push("- No reviews yet.");
		for (const [state, count] of entries) lines.push(`- ${state}: ${count}`);
		lines.push("");
	}

	if (overview.checks) {
		lines.push("## Checks");
		if (overview.checks.length === 0) {
			lines.push("- No check runs found.");
		} else {
			for (const check of overview.checks) {
				const outcome = check.conclusion ? `${check.status}/${check.conclusion}` : check.status;
				lines.push(`- ${check.name}: ${outcome}`);
			}
		}
		lines.push("");
	}

	if (overview.changes) {
		lines.push("## Changed files");
		if (overview.changes.length === 0) {
			lines.push("- No file changes.");
		} else {
			for (const change of overview.changes.slice(0, 20)) {
				lines.push(`- #${change.id}: ${change.filename} (${change.status}, +${change.additions} -${change.deletions})`);
			}
			if (overview.changes.length > 20) {
				lines.push(`- ... ${overview.changes.length - 20} more files`);
			}
		}
		lines.push("");
	}

	return lines.join("\n").trim();
}

function renderReviewCommentsMarkdown(
	owner: string,
	repo: string,
	number: number,
	comments: ReviewCommentRef[],
): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_review_comments: ${comments.length}`,
		"---",
		"",
		`# Review comments for PR ${owner}/${repo}#${number}`,
		"",
	];
	if (comments.length === 0) {
		lines.push("No review comments found.");
	} else {
		for (const comment of comments) {
			const location = comment.path
				? `${comment.path}${typeof comment.line === "number" ? `:${comment.line}` : ""}`
				: "unknown";
			const body = comment.body.replace(/\r?\n/g, " ").trim();
			const compactBody = body.length > 120 ? `${body.slice(0, 117)}...` : body;
			lines.push(
				`- #${comment.id} @${comment.author} (${formatSimpleDate(comment.createdAt)}) [${location}] ${compactBody}${comment.url ? ` - ${comment.url}` : ""}`,
			);
		}
	}
	return lines.join("\n");
}

function renderParticipantsMarkdown(
	entity: BrowseEntity,
	owner: string,
	repo: string,
	number: number,
	participants: ParticipantRef[],
): string {
	const lines = [
		"---",
		`entity: ${entity}`,
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`total_participants: ${participants.length}`,
		"---",
		"",
		`# Participants for ${entity.toUpperCase()} ${owner}/${repo}#${number}`,
		"",
	];
	if (participants.length === 0) {
		lines.push("No participants found.");
	} else {
		for (const participant of participants) {
			lines.push(`- @${participant.login} (${participant.roles.join(", ")}, ${participant.count} entries)`);
		}
	}
	return lines.join("\n");
}

function renderChangeMarkdown(owner: string, repo: string, number: number, change: ChangeRef): string {
	const lines = [
		"---",
		"entity: pr",
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`change_id: ${change.id}`,
		`file: ${change.filename}`,
		`status: ${change.status}`,
		`additions: ${change.additions}`,
		`deletions: ${change.deletions}`,
		`changes: ${change.changes}`,
	];
	if (change.previousFilename) lines.push(`previous_file: ${change.previousFilename}`);
	if (change.blobUrl) lines.push(`blob_url: ${change.blobUrl}`);
	if (change.rawUrl) lines.push(`raw_url: ${change.rawUrl}`);
	lines.push("---", "", `# Change #${change.id}: ${change.filename}`, "");
	if (!change.patch) {
		lines.push(
			"Diff patch is not available for this file (likely binary, deleted large file, or truncated by GitHub API).",
		);
		return lines.join("\n");
	}
	lines.push("```diff", change.patch, "```");
	return lines.join("\n");
}

async function downloadImage(
	client: BrowseClient,
	fetchThreadCached: (entity: BrowseEntity, owner: string, repo: string, number: number) => Promise<ThreadItem[]>,
	entity: BrowseEntity,
	owner: string,
	repo: string,
	number: number,
	imageId: number,
	tmpDir = "/tmp",
): Promise<string> {
	const items = await fetchThreadCached(entity, owner, repo, number);
	const images = collectImages(items);
	const image = images.find((candidate) => candidate.id === imageId);
	if (!image) throw new Error(`imageId ${imageId} not found`);

	await mkdir(tmpDir, { recursive: true });
	let token = "";
	try {
		token = (await client.ghText(["auth", "token"]))?.trim() ?? "";
	} catch {
		token = "";
	}

	const response = await fetch(image.url, {
		headers: token
			? {
					Authorization: `Bearer ${token}`,
					"User-Agent": "pure-github",
				}
			: { "User-Agent": "pure-github" },
	});
	if (!response.ok) {
		throw new Error(`failed to download image: HTTP ${response.status}`);
	}

	const bytes = new Uint8Array(await response.arrayBuffer());
	const ext = imageExtFromUrl(image.url);
	const file = join(tmpDir, `github-${owner}-${repo}-${entity}-${number}-image-${imageId}${ext}`);
	await writeFile(file, bytes);

	return [
		"---",
		`entity: ${entity}`,
		`repo: ${owner}/${repo}`,
		`number: ${number}`,
		`image_id: ${imageId}`,
		`downloaded_to: ${file}`,
		`source_url: ${image.url}`,
		"---",
		"",
		`Downloaded image #${imageId} to: ${file}`,
	].join("\n");
}

export function createBrowseToolDefinition(options: {
	exec: PiExecFn;
	binaryPath: string;
	getCwd: () => string;
	getDefaultOwner: () => string | undefined;
}) {
	const threadCache = new ThreadCache();

	return {
		name: "github_browse",
		label: "GitHub Browse",
		description: `Read and inspect remote GitHub repos without cloning. Actions: read_file, list_directory, search_code, glob_files, search_commits, list_issues, list_prs, pr_overview, list_pr_commits, get_pr_commit, list_pr_checks, list_review_comments, list_changes, get_change, list_participants, list_images, download_image, format.

Common patterns:
- Read a file: action "read_file" with owner/repo/path and optional ref/startLine/endLine
- List a directory: action "list_directory" with owner/repo/path
- Search code: action "search_code" with owner/repo/query and optional path filter
- Glob files: action "glob_files" with owner/repo/filePattern and optional ref
- Inspect a PR: action "pr_overview" or "list_changes" / "get_change" / "list_pr_commits"
- Render a thread: action "format" with id (issue/PR/discussion number); entity auto-detects if omitted

Output is markdown/text optimized for the agent. All actions are read-only except download_image, which writes a temp file.`,
		promptSnippet: "Browse remote GitHub repos, files, threads, and PR metadata without cloning",
		promptGuidelines: [
			"github_browse is read-only except download_image, which writes to a temp directory",
			"Prefer specific actions like read_file, search_code, pr_overview, or get_change over dumping full threads when possible",
			"owner/repo can be omitted inside a local clone; the tool will try to detect the GitHub origin from git remote",
		],
		parameters: BrowseParamsSchema,
		async execute(_toolCallId: string, rawParams: BrowseParams, signal?: AbortSignal) {
			const client = createBrowseClient(options.exec, options.binaryPath, signal);
			const action = rawParams.action ?? "format";
			const page = Number(rawParams.page ?? 1);
			const perPage = Number(rawParams.perPage ?? 20);
			const normalizedPage = Number.isInteger(page) && page > 0 ? page : 1;
			const normalizedPerPage = Number.isInteger(perPage) && perPage > 0 ? Math.min(perPage, 100) : 20;

			try {
				const { owner, repo } = await resolveRepoCoordinates(
					options.exec,
					options.getCwd,
					options.getDefaultOwner(),
					rawParams.owner,
					rawParams.repo,
				);

				const fetchThreadCached = (entity: BrowseEntity, entityOwner: string, entityRepo: string, number: number) =>
					threadCache.get(entity, entityOwner, entityRepo, number, () =>
						fetchThread(client, entity, entityOwner, entityRepo, number),
					);

				if (action === "read_file") {
					const path = typeof rawParams.path === "string" ? rawParams.path.trim().replace(/^\//, "") : "";
					if (!path) throw new Error("path is required for action=read_file");
					const startLine = Number(rawParams.startLine ?? 1);
					const endLine = rawParams.endLine === undefined ? undefined : Number(rawParams.endLine);
					if (!Number.isInteger(startLine) || startLine < 1) throw new Error("startLine must be an integer >= 1");
					if (endLine !== undefined && (!Number.isInteger(endLine) || endLine < startLine)) {
						throw new Error("endLine must be an integer >= startLine");
					}
					const content = await fetchRepoFile(client, owner, repo, path, rawParams.ref?.trim() || undefined);
					return {
						content: [{ type: "text", text: renderFileMarkdown(owner, repo, path, content, startLine, endLine) }],
					};
				}

				if (action === "list_directory") {
					const path = typeof rawParams.path === "string" ? rawParams.path.trim().replace(/^\//, "") : "";
					const entries = await fetchRepoDirectory(client, owner, repo, path, rawParams.ref?.trim() || undefined);
					return { content: [{ type: "text", text: renderDirectoryMarkdown(owner, repo, path || ".", entries) }] };
				}

				if (action === "search_code") {
					const query = rawParams.query?.trim() ?? "";
					if (!query) throw new Error("query is required for action=search_code");
					const searchPath = rawParams.path?.trim() || undefined;
					const results = await searchRepoCode(
						client,
						owner,
						repo,
						query,
						searchPath,
						normalizedPage,
						normalizedPerPage,
					);
					return { content: [{ type: "text", text: renderCodeSearchMarkdown(owner, repo, query, results) }] };
				}

				if (action === "glob_files") {
					const filePattern = rawParams.filePattern?.trim() ?? "";
					if (!filePattern) throw new Error("filePattern is required for action=glob_files");
					const files = await fetchRepoTreeFiles(client, owner, repo, rawParams.ref?.trim() || undefined);
					const matched = globMatch(files, filePattern);
					const offset = Math.max(0, Number(rawParams.offset ?? 0));
					const limit = rawParams.limit === undefined ? matched.length : Math.max(1, Number(rawParams.limit));
					const pageItems = matched.slice(offset, offset + limit);
					return {
						content: [{ type: "text", text: renderGlobMarkdown(owner, repo, filePattern, pageItems, matched.length) }],
					};
				}

				if (action === "search_commits") {
					const query = rawParams.query?.trim() || undefined;
					const author = rawParams.author?.trim() || undefined;
					const since = rawParams.since?.trim() || undefined;
					const until = rawParams.until?.trim() || undefined;
					const results = await searchRepoCommits(client, owner, repo, {
						query,
						author,
						since,
						until,
						page: normalizedPage,
						perPage: normalizedPerPage,
					});
					const queryLabel = [
						query || "*",
						author ? `author:${author}` : "",
						since ? `since:${since}` : "",
						until ? `until:${until}` : "",
					]
						.filter(Boolean)
						.join(" ");
					return { content: [{ type: "text", text: renderCommitSearchMarkdown(owner, repo, queryLabel, results) }] };
				}

				if (action === "list_issues") {
					const rows = await client.fetchRestPage(
						`/repos/${owner}/${repo}/issues?state=open&sort=updated&direction=desc`,
						normalizedPage,
						normalizedPerPage,
					);
					const issues = rows.filter((row) => !row?.pull_request);
					return {
						content: [
							{ type: "text", text: renderIssuesListMarkdown(owner, repo, normalizedPage, normalizedPerPage, issues) },
						],
					};
				}

				if (action === "list_prs") {
					const prs = await client.fetchRestPage(
						`/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc`,
						normalizedPage,
						normalizedPerPage,
					);
					return {
						content: [
							{ type: "text", text: renderPrsListMarkdown(owner, repo, normalizedPage, normalizedPerPage, prs) },
						],
					};
				}

				const id = Number(rawParams.id ?? rawParams.number);
				if (!Number.isInteger(id) || id < 1) throw new Error("id must be an integer >= 1");
				const entity = rawParams.entity ?? (await inferEntity(client, owner, repo, id));

				if (action === "list_participants") {
					const participants = collectParticipants(await fetchThreadCached(entity, owner, repo, id));
					return {
						content: [{ type: "text", text: renderParticipantsMarkdown(entity, owner, repo, id, participants) }],
					};
				}

				if (action === "list_images") {
					const images = collectImages(await fetchThreadCached(entity, owner, repo, id));
					return { content: [{ type: "text", text: renderImagesListMarkdown(entity, owner, repo, id, images) }] };
				}

				if (action === "download_image") {
					if (!rawParams.imageId) throw new Error("imageId is required for action=download_image");
					const text = await downloadImage(
						client,
						fetchThreadCached,
						entity,
						owner,
						repo,
						id,
						Number(rawParams.imageId),
						rawParams.tmpDir?.trim() || "/tmp",
					);
					return { content: [{ type: "text", text }] };
				}

				if (action === "list_changes") {
					if (entity !== "pr") throw new Error("action=list_changes only works for pull requests");
					return {
						content: [
							{
								type: "text",
								text: renderChangesListMarkdown(owner, repo, id, await fetchPrChanges(client, owner, repo, id)),
							},
						],
					};
				}

				if (action === "list_pr_commits") {
					if (entity !== "pr") throw new Error("action=list_pr_commits only works for pull requests");
					const commits = await fetchPrCommits(client, owner, repo, id);
					const start = (normalizedPage - 1) * normalizedPerPage;
					return {
						content: [
							{
								type: "text",
								text: renderPrCommitsMarkdown(owner, repo, id, commits.slice(start, start + normalizedPerPage)),
							},
						],
					};
				}

				if (action === "get_pr_commit") {
					if (entity !== "pr") throw new Error("action=get_pr_commit only works for pull requests");
					const commitSha = rawParams.commitSha?.trim() ?? "";
					if (!commitSha) throw new Error("commitSha is required for action=get_pr_commit");
					return {
						content: [
							{
								type: "text",
								text: renderPrCommitMarkdown(
									owner,
									repo,
									id,
									await fetchPrCommitDetail(client, owner, repo, id, commitSha),
								),
							},
						],
					};
				}

				if (action === "pr_overview") {
					if (entity !== "pr") throw new Error("action=pr_overview only works for pull requests");
					const overview = await fetchPrOverview(client, owner, repo, id, {
						includeFiles: rawParams.includeFiles !== false,
						includeReviews: rawParams.includeReviews !== false,
						includeChecks: rawParams.includeChecks !== false,
					});
					return { content: [{ type: "text", text: renderPrOverviewMarkdown(owner, repo, overview) }] };
				}

				if (action === "list_pr_checks") {
					if (entity !== "pr") throw new Error("action=list_pr_checks only works for pull requests");
					const pr = await client.ghJson<any>(["api", `/repos/${owner}/${repo}/pulls/${id}`]);
					const headSha = String(pr?.head?.sha ?? "").trim();
					if (!headSha) throw new Error(`Could not resolve PR head SHA for #${id}`);
					return {
						content: [
							{
								type: "text",
								text: renderPrChecksMarkdown(owner, repo, id, await fetchPrChecks(client, owner, repo, headSha)),
							},
						],
					};
				}

				if (action === "list_review_comments") {
					if (entity !== "pr") throw new Error("action=list_review_comments only works for pull requests");
					const allComments = await fetchReviewComments(client, owner, repo, id);
					const authorFilter = rawParams.author?.trim().toLowerCase() ?? "";
					const pathFilter = rawParams.path?.trim() ?? "";
					const sinceMs = rawParams.since ? Date.parse(rawParams.since) : Number.NaN;
					const untilMs = rawParams.until ? Date.parse(rawParams.until) : Number.NaN;
					const filtered = allComments.filter((comment) => {
						if (authorFilter && comment.author.toLowerCase() !== authorFilter) return false;
						if (pathFilter && comment.path !== pathFilter) return false;
						if (Number.isFinite(sinceMs) || Number.isFinite(untilMs)) {
							const createdMs = Date.parse(comment.createdAt);
							if (!Number.isFinite(createdMs)) return false;
							if (Number.isFinite(sinceMs) && createdMs < sinceMs) return false;
							if (Number.isFinite(untilMs) && createdMs > untilMs) return false;
						}
						return true;
					});
					const start = (normalizedPage - 1) * normalizedPerPage;
					return {
						content: [
							{
								type: "text",
								text: renderReviewCommentsMarkdown(owner, repo, id, filtered.slice(start, start + normalizedPerPage)),
							},
						],
					};
				}

				if (action === "get_change") {
					if (entity !== "pr") throw new Error("action=get_change only works for pull requests");
					const requestedChangeId = Number(rawParams.changeId ?? rawParams.patchId ?? rawParams.codeId);
					if (!Number.isInteger(requestedChangeId) || requestedChangeId < 1) {
						throw new Error("changeId (or patchId/codeId) is required for action=get_change");
					}
					const change = (await fetchPrChanges(client, owner, repo, id)).find(
						(candidate) => candidate.id === requestedChangeId,
					);
					if (!change) throw new Error(`changeId ${requestedChangeId} not found`);
					return { content: [{ type: "text", text: renderChangeMarkdown(owner, repo, id, change) }] };
				}

				const items = await fetchThreadCached(entity, owner, repo, id);
				const filteredItems = applyThreadFilters(items, {
					author: rawParams.author,
					kind: rawParams.kind,
					since: rawParams.since,
					until: rawParams.until,
					contains: rawParams.contains,
				});
				const images = collectImages(filteredItems);
				const changes = entity === "pr" ? await fetchPrChanges(client, owner, repo, id) : undefined;
				return {
					content: [
						{
							type: "text",
							text: renderThreadMarkdown({
								entity,
								owner,
								repo,
								number: id,
								page: normalizedPage,
								perPage: normalizedPerPage,
								items: filteredItems,
								images,
								changes,
								filteredFromTotal: items.length,
							}),
						},
					],
				};
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return { content: [{ type: "text", text: `GitHub browse error: ${message}` }] };
			}
		},
	};
}
