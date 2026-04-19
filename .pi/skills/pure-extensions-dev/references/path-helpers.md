# Path Helpers

> Pi version: 0.67.4 | Last updated: 2026-04-17

Inline these in every extension that needs config/cache storage. No cross-extension dependencies.

```typescript
import { getAgentDir } from "@mariozechner/pi-coding-agent";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function getPurePath(filename: string, category: "config" | "cache", scope: "global" | "project", cwd?: string) {
	const root = scope === "project" ? join(cwd ?? process.cwd(), ".pi", "pure") : join(getAgentDir(), "pure");
	const dir = join(root, category);
	if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
	return { dir, file: join(dir, filename) };
}

function readPureJson<T = unknown>(filename: string, category: "config" | "cache", scope: "global" | "project" = "global", cwd?: string): T | undefined {
	const { file } = getPurePath(filename, category, scope, cwd);
	try {
		return JSON.parse(readFileSync(file, "utf-8"));
	} catch {
		return undefined;
	}
}

function writePureJson<T = unknown>(filename: string, data: T, category: "config" | "cache", scope: "global" | "project" = "global", cwd?: string) {
	const { file } = getPurePath(filename, category, scope, cwd);
	writeFileSync(file, JSON.stringify(data, null, 2));
}

function loadConfig<T>(filename: string, category: "config" | "cache", cwd?: string): T | undefined {
	const project = readPureJson<T>(filename, category, "project", cwd);
	if (project !== undefined) return project;
	return readPureJson<T>(filename, category, "global");
}
```

## Config paths

| Scope | Path |
|-------|------|
| Global | `~/.pi/agent/pure/{config,cache}/pure-<name>.json` |
| Project | `<project>/.pi/pure/{config,cache}/pure-<name>.json` |

Project overrides global. Use `loadConfig()` to get the merged behavior.

## Usage pattern

```typescript
// Reading config (project overrides global)
const config = loadConfig<MyConfig>("pure-myext.json", "config");

// Writing config (explicit scope)
writePureJson("pure-myext.json", newConfig, "config", "project");

// Cache (temporary data, same helpers)
const cache = readPureJson<CacheData>("pure-myext.json", "cache");
```
