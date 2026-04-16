/**
 * Repo reference parsing utilities.
 *
 * Supports:
 *   - owner/repo
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo/issues/123
 *   - #123 (issue/PR number)
 */

export interface RepoRef {
	owner?: string;
	repo?: string;
	number?: number;
}

const GITHUB_URL_RE = /github\.com\/([^/]+)\/([^/]+)/;

export function extractRepoRef(input: string): RepoRef {
	const trimmed = input.trim();

	// Issue/PR number only
	if (/^#\d+$/.test(trimmed)) {
		return { number: Number(trimmed.slice(1)) };
	}

	// GitHub URL
	const urlMatch = trimmed.match(GITHUB_URL_RE);
	if (urlMatch) {
		const owner = urlMatch[1];
		const rest = urlMatch[2];
		const repo = rest.split("/")[0];
		const numberMatch = trimmed.match(/\/(?:issues|pull)\/(\d+)/);
		return {
			owner,
			repo,
			number: numberMatch ? Number(numberMatch[1]) : undefined,
		};
	}

	// owner/repo shorthand
	const slashMatch = trimmed.match(/^([^/]+)\/([^/]+)$/);
	if (slashMatch) {
		return {
			owner: slashMatch[1],
			repo: slashMatch[2],
		};
	}

	return {};
}

/**
 * Resolve a repo reference to an `owner/repo` string.
 * Falls back to `defaultOwner` when only a repo name is provided.
 * Returns `null` if the reference cannot be resolved.
 */
export function resolveRepo(input: string, defaultOwner?: string): string | null {
	const trimmed = input.trim();
	const ref = extractRepoRef(trimmed);

	if (ref.owner && ref.repo) {
		return `${ref.owner}/${ref.repo}`;
	}

	// Bare repo name (no slash, no URL)
	if (!trimmed.includes("/") && !trimmed.startsWith("http") && trimmed.length > 0) {
		if (defaultOwner) {
			return `${defaultOwner}/${trimmed}`;
		}
	}

	return null;
}

/**
 * Parse the `--repo <owner/repo>` style flag from a list of CLI arguments.
 * Returns the repo string or `null` if not found.
 */
export function parseRepoFlag(args: string[]): string | null {
	const idx = args.indexOf("--repo");
	if (idx !== -1 && args[idx + 1]) {
		return args[idx + 1];
	}
	return null;
}
