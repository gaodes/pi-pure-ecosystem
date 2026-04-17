// Ported from @aliou/pi-dev-kit via extensions/pi-devkit/tools/utils.ts
import * as child_process from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export function findPiInstallation(): string | null {
	try {
		const mainPath = require.resolve("@mariozechner/pi-coding-agent");
		const found = walkUpForPackage(mainPath);
		if (found) return found;
	} catch {
		// Main export may not be resolvable
	}

	const globalRoots: string[] = [];
	try {
		const root = child_process.execSync("npm root -g", { encoding: "utf-8" }).trim();
		if (root) globalRoots.push(root);
	} catch {
		// npm not available
	}

	globalRoots.push("/opt/homebrew/lib/node_modules");
	globalRoots.push("/usr/local/lib/node_modules");
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

	const scriptPath = process.argv[1];
	if (scriptPath) {
		const found = walkUpForPackage(scriptPath);
		if (found) return found;
	}

	return null;
}

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
