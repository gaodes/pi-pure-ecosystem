import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { setupPackageManagerTool } from "./tools/detect-package-manager";
import { setupChangelogTool } from "./tools/pi-changelog";
import { setupDocsTool } from "./tools/pi-docs";
import { setupVersionTool } from "./tools/pi-version";

export default function (pi: ExtensionAPI) {
	setupPackageManagerTool(pi);
	setupVersionTool(pi);
	setupDocsTool(pi);
	setupChangelogTool(pi);
}
