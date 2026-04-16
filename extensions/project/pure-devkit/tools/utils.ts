import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Find the currently running Pi installation directory.
 *
 * Tries multiple strategies in order:
 * 1. resolve the main export and walk up to package root
 * 2. scan known global node_modules locations
 * 3. walk up from process.argv[1]
 */
export function findPiInstallation(): string | null {
	// Strategy 1: resolve main export, walk up to package root
	try {
		const mainPath = require.resolve("@mariozechner/pi-coding-agent");
		const found = walkUpForPackage(mainPath);
		if (found) return found;
	} catch {
		// Main export may not be resolvable (exports conditions)
	}

	// Strategy 2: known global node_modules locations
	const globalRoots: string[] = [];

	// npm root -g (most reliable)
	try {
		const root = child_process.execSync("npm root -g", { encoding: "utf-8" }).trim();
		if (root) globalRoots.push(root);
	} catch {
		// npm not available
	}

	// Common Homebrew path (macOS)
	globalRoots.push("/opt/homebrew/lib/node_modules");
	// Standard Linux path
	globalRoots.push("/usr/local/lib/node_modules");
	// Windows
	if (process.platform === "win32") {
		const appData = process.env.APPDATA;
		if (appData) globalRoots.push(path.join(appData, "npm", "node_modules"));
	}

	for (const root of globalRoots) {
		const pkgDir = path.join(root, "@mariozechner", "pi-coding-agent");
		const pkgFile = path.join(pkgDir, "package.json");
		if (fs.existsSync(pkgFile)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf-8"));
				if (pkg.name === "@mariozechner/pi-coding-agent") return pkgDir;
			} catch {}
		}
	}

	// Strategy 3: walk up from process.argv[1]
	const scriptPath = process.argv[1];
	if (scriptPath) {
		const found = walkUpForPackage(scriptPath);
		if (found) return found;
	}

	return null;
}

/** Walk up from a file path until we find a package.json for @mariozechner/pi-coding-agent. */
function walkUpForPackage(startPath: string): string | null {
	let currentDir = path.dirname(path.resolve(startPath));
	while (currentDir !== path.dirname(currentDir)) {
		const packageJsonPath = path.join(currentDir, "package.json");
		if (fs.existsSync(packageJsonPath)) {
			try {
				const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
				if (packageJson.name === "@mariozechner/pi-coding-agent") {
					return currentDir;
				}
			} catch {
				// Continue searching
			}
		}
		currentDir = path.dirname(currentDir);
	}
	return null;
}
