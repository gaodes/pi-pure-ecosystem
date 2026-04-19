import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

interface UpstreamSource {
	name: string;
	type: string;
	url: string;
	license?: string;
	relationship: string;
}

interface UpstreamJson {
	version: number;
	updatedAt: string;
	primary: UpstreamSource;
	otherSources?: UpstreamSource[];
}

interface FoundUpstream {
	pkgName: string;
	pkgDir: string;
	upstreamPath: string;
	data: UpstreamJson;
}

function discoverUpstreams(cwd: string): FoundUpstream[] {
	const results: FoundUpstream[] = [];
	const seen = new Set<string>();

	function tryRead(pkgName: string, pkgDir: string) {
		const upstreamPath = path.join(pkgDir, ".upstream.json");
		if (seen.has(pkgDir)) return;
		seen.add(pkgDir);

		if (!fs.existsSync(upstreamPath)) return;
		try {
			const data = JSON.parse(fs.readFileSync(upstreamPath, "utf-8")) as UpstreamJson;
			results.push({ pkgName, pkgDir, upstreamPath, data });
		} catch {
			// Skip malformed files
		}
	}

	function scanDir(dir: string) {
		if (!fs.existsSync(dir)) return;
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			if (entry.startsWith("@")) {
				// Scoped packages: @scope/name
				const scopeDir = path.join(dir, entry);
				let scoped: string[];
				try {
					scoped = fs.readdirSync(scopeDir);
				} catch {
					continue;
				}
				for (const sub of scoped) {
					tryRead(`${entry}/${sub}`, path.join(scopeDir, sub));
				}
			} else {
				tryRead(entry, path.join(dir, entry));
			}
		}
	}

	function scanExtensionsDir(dir: string) {
		if (!fs.existsSync(dir)) return;
		let entries: string[];
		try {
			entries = fs.readdirSync(dir);
		} catch {
			return;
		}
		for (const entry of entries) {
			const extDir = path.join(dir, entry);
			try {
				if (!fs.statSync(extDir).isDirectory()) continue;
			} catch {
				continue;
			}
			const pkgJsonPath = path.join(extDir, "package.json");
			let pkgName = entry;
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
				if (pkg.name) pkgName = pkg.name;
			} catch {
				// Use directory name
			}
			tryRead(pkgName, extDir);
		}
	}

	// 1. Pi's global node_modules (where npm extensions live)
	try {
		const require = createRequire(import.meta.url);
		const piAgentPkg = require.resolve("@mariozechner/pi-coding-agent/package.json");
		const nodeModules = path.dirname(path.dirname(piAgentPkg));
		scanDir(nodeModules);
	} catch {
		// Pi package not resolvable, skip
	}

	// 2. Project-local .pi/npm/node_modules (shadowed npm packages)
	const projectNpmDir = path.join(cwd, ".pi", "npm", "node_modules");
	scanDir(projectNpmDir);

	// 3. Local extensions/ directory relative to session cwd
	scanExtensionsDir(path.join(cwd, "extensions"));

	// 4. Derive from this extension's own source location.
	//    import.meta.url points into extensions/pure-dev-kit/src/commands/,
	//    so walk up to the parent extensions/ directory to find siblings.
	try {
		const selfFile = new URL(import.meta.url).pathname;
		const selfExtDir = path.resolve(path.dirname(selfFile), "..", ".."); // -> extensions/pure-dev-kit
		const parentExtDir = path.dirname(selfExtDir); // -> extensions/
		if (path.basename(parentExtDir) === "extensions") {
			scanExtensionsDir(parentExtDir);
		}
	} catch {
		// import.meta.url resolution failed, skip
	}

	// 5. Pi git cache (~/.pi/git/)
	const gitDir = path.join(os.homedir(), ".pi", "git");
	if (fs.existsSync(gitDir)) {
		function walkGit(dir: string, depth: number) {
			if (depth > 5) return;
			const upstreamPath = path.join(dir, ".upstream.json");
			if (fs.existsSync(upstreamPath) && depth > 0) {
				// Derive package name from directory
				const pkgName = path.basename(dir);
				tryRead(`git:${pkgName}`, dir);
			}
			let entries: string[];
			try {
				entries = fs.readdirSync(dir);
			} catch {
				return;
			}
			for (const entry of entries) {
				const full = path.join(dir, entry);
				try {
					if (fs.statSync(full).isDirectory()) {
						walkGit(full, depth + 1);
					}
				} catch {
					// Skip
				}
			}
		}
		walkGit(gitDir, 0);
	}

	return results;
}

function formatRelationship(rel: string): string {
	switch (rel) {
		case "fork":
			return "🔀 fork";
		case "synced-source":
			return "🔄 synced";
		case "upstream":
			return "⬆️ upstream";
		case "historical-ancestor":
			return "📜 ancestor";
		case "reference":
			return "📖 reference";
		default:
			return rel;
	}
}

const UPSTREAM_SYNC_PROMPT = `# Upstream Sync Analysis

You have been given a discovery report of extensions with \`.upstream.json\` lineage data.
For each extension with a **fork** or **synced-source** relationship, perform the following analysis.
Skip extensions with **historical-ancestor** or **reference** relationships — those are informational only.

## Steps (per extension)

### 1. Read our extension

Read the local extension's:
- \`README.md\` — understand what we ship, our scope, and any local modifications documented there
- \`CHANGELOG.md\` — understand our version history and what we have already changed
- \`package.json\` — note our current version
- \`.upstream.json\` — note the \`updatedAt\` date (last time we checked upstream)

### 2. Read the upstream

For the primary upstream source:
- If it is a **repo** (GitHub URL): browse the upstream repo's \`README.md\`, \`CHANGELOG.md\` (or release notes), and recent commits since our \`updatedAt\` date
- If it is an **npm package**: fetch the package metadata, read its README and changelog from the registry or linked repo
- Focus on changes **after** the \`updatedAt\` date in our \`.upstream.json\`

### 3. Identify upstream changes

List every meaningful upstream change since our last sync. For each change, note:
- What changed (feature, fix, refactor, dependency update, API change)
- Which files or areas are affected
- Whether it is a breaking change

### 4. Classify each change

For each upstream change, classify it into one of these categories:

- ✅ **Pull** — the change is beneficial and compatible with our extension. We should adopt it.
- ⚠️ **Review** — the change may be useful but needs adaptation, conflicts with our modifications, or touches areas we have customized. Explain what needs manual review.
- ❌ **Skip** — the change is irrelevant to our fork/scope, conflicts with our architecture, or we have intentionally diverged from that upstream behavior. Explain why.
- 🔄 **Already have** — we independently made the same or equivalent change. Note the overlap.

### 5. Present the sync report

For each extension, present a structured report:

#### Extension: \`<name>\`
| Our version | Upstream version | Last synced |
|---|---|---|
| \`x.y.z\` | \`a.b.c\` | \`YYYY-MM-DD\` |

**Changes since last sync:**

| # | Change | Category | Notes |
|---|---|---|---|
| 1 | description | ✅ Pull / ⚠️ Review / ❌ Skip / 🔄 Already have | explanation |

**Recommendation:** brief overall assessment — is a sync needed, and how large is the effort?

### 6. Wait for confirmation

Present the full report and wait for the user to decide which changes to pull.
Do not apply any changes until explicitly confirmed.

## Important

- Do not modify any files during the analysis phase.
- If the upstream repo or package is inaccessible, report that and move on to the next extension.
- Focus on substance — skip trivial formatting-only or whitespace changes unless they fix a real issue.
- When our extension has intentionally diverged (renamed, restructured, added features), note that context when classifying changes.
`;

function formatSummary(upstreams: FoundUpstream[]): string {
	const lines: string[] = [];
	lines.push(`# Extension Upstream Report`);
	lines.push(`Scanned ${upstreams.length} extension(s) with \`.upstream.json\` data.\n`);

	for (const u of upstreams) {
		const { pkgName, pkgDir, data } = u;
		lines.push(`## ${pkgName}`);
		lines.push(`- **Path:** \`${pkgDir}\``);
		lines.push(`- **Updated:** ${data.updatedAt}`);
		lines.push(`- **Primary:** ${data.primary.name} — ${formatRelationship(data.primary.relationship)}`);
		lines.push(`  - Type: ${data.primary.type}`);
		lines.push(`  - URL: ${data.primary.url}`);
		if (data.primary.license) {
			lines.push(`  - License: ${data.primary.license}`);
		}
		if (data.otherSources && data.otherSources.length > 0) {
			lines.push(`- **Other sources:**`);
			for (const s of data.otherSources) {
				lines.push(`  - ${s.name} (${s.type}) — ${formatRelationship(s.relationship)} — ${s.url}`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

export function registerUpdateUpstreamCommand(pi: ExtensionAPI) {
	pi.registerCommand("extensions:update-upstream", {
		description: "Report upstream lineage for installed extensions (.upstream.json)",
		handler: async (_args, ctx) => {
			if (!ctx.hasUI) return;

			ctx.ui.setStatus("extensions:update-upstream", "Scanning extensions...");

			const upstreams = discoverUpstreams(ctx.cwd);

			ctx.ui.setStatus("extensions:update-upstream", undefined);

			if (upstreams.length === 0) {
				ctx.ui.notify("No extensions with .upstream.json found.", "info");
				return;
			}

			const summary = formatSummary(upstreams);

			// Check if any upstream has a syncable relationship
			const hasSyncable = upstreams.some(
				(u) => u.data.primary.relationship === "fork" || u.data.primary.relationship === "synced-source",
			);

			if (hasSyncable) {
				pi.sendUserMessage(`${summary}\n${UPSTREAM_SYNC_PROMPT}`);
			} else {
				// No syncable upstreams — just show the report
				pi.sendUserMessage(summary);
			}
		},
	});
}
