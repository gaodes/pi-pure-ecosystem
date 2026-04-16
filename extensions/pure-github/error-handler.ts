/**
 * Error classes and messages for GH PI extension
 */

export const INSTALL_INSTRUCTIONS = `
GitHub CLI (gh) not found in PATH.

Install:
  macOS:    brew install gh
  Ubuntu:   sudo apt install gh
  Windows:  winget install GitHub.cli
  Other:    https://github.com/cli/cli#installation

Authenticate:
  gh auth login

See: https://cli.github.com/
`;

export function getInstallInstructions(): string {
	return INSTALL_INSTRUCTIONS.trim();
}

export class GHNotFoundError extends Error {
	constructor(prefix = "") {
		const baseMessage = "gh CLI not found in PATH";
		const instructions = getInstallInstructions();
		const message = prefix ? `${prefix}\n${baseMessage}\n${instructions}` : `${baseMessage}\n${instructions}`;
		super(message);
		this.name = "GHNotFoundError";
	}
}

export class GHAuthError extends Error {
	constructor(message = "Authentication failed. Run: gh auth login") {
		super(message);
		this.name = "GHAuthError";
	}
}

export class GHRateLimitError extends Error {
	constructor(detail?: string) {
		super(detail ? `GitHub API rate limit hit: ${detail}` : "GitHub API rate limit hit");
		this.name = "GHRateLimitError";
	}
}

/**
 * Generic gh CLI error for any non-zero exit that is not auth, rate limit,
 * or a user cancellation.
 */
export class GHError extends Error {
	code: number;
	/** Captured stdout from the failing gh invocation. Empty string if gh produced no stdout. */
	stdout: string;

	constructor(code: number, stderr: string, stdout = "") {
		super(stderr.trim() || `gh CLI failed with exit code ${code}`);
		this.name = "GHError";
		this.code = code;
		this.stdout = stdout;
	}
}
