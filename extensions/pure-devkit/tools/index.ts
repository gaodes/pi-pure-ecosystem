import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupChangelogTool } from "./changelog";
import { setupDocsTool } from "./docs";
import { setupPackageManagerTool } from "./package-manager";
import { setupVersionTool } from "./version";

export function setupTools(pi: ExtensionAPI) {
	setupPackageManagerTool(pi);
	setupVersionTool(pi);
	setupDocsTool(pi);
	setupChangelogTool(pi);
}
