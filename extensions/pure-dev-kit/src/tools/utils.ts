import * as child_process from "node:child_process";
import * as fs from "node:fs";
import { createRequire } from "node:module";
import * as path from "node:path";

const require = createRequire(import.meta.url);

/**
 * Find the currently running Pi installation directory.
 */
export function findPiInstallation(): string | null {
	try {
		const piModulePath = require.resolve("@mariozechner/pi-coding-agent/package.json");
		return path.dirname(piModulePath);
	} catch {
		// package may not be directly resolvable from this context
	}

	const envPackageDir = process.env.PI_PACKAGE_DIR;
	if (envPackageDir) {
		const candidate = path.join(envPackageDir, "@mariozechner", "pi-coding-agent");
		const candidatePkg = path.join(candidate, "package.json");
		if (fs.existsSync(candidatePkg)) return candidate;
	}

	const globalRoots: string[] = [];
	try {
		const npmRoot = child_process.execSync("npm root -g", { encoding: "utf-8" }).trim();
		if (npmRoot) globalRoots.push(npmRoot);
	} catch {
		// npm may be unavailable
	}
	globalRoots.push("/opt/homebrew/lib/node_modules");
	globalRoots.push("/usr/local/lib/node_modules");

	for (const root of globalRoots) {
		const candidate = path.join(root, "@mariozechner", "pi-coding-agent");
		const pkgPath = path.join(candidate, "package.json");
		if (!fs.existsSync(pkgPath)) continue;
		try {
			const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
			if (pkg.name === "@mariozechner/pi-coding-agent") return candidate;
		} catch {
			// continue
		}
	}

	const scriptPath = process.argv[1];
	if (scriptPath) {
		let currentDir = path.dirname(path.resolve(scriptPath));
		while (currentDir !== path.dirname(currentDir)) {
			const packageJsonPath = path.join(currentDir, "package.json");
			if (fs.existsSync(packageJsonPath)) {
				try {
					const packageContent = fs.readFileSync(packageJsonPath, "utf-8");
					const packageJson = JSON.parse(packageContent);
					if (packageJson.name === "@mariozechner/pi-coding-agent") return currentDir;
				} catch {
					// Continue searching
				}
			}
			currentDir = path.dirname(currentDir);
		}
	}

	return null;
}
