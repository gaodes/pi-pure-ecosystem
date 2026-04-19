import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerUpdateCommand } from "./update";
import { registerUpdateUpstreamCommand } from "./update-upstream";

export function registerCommands(pi: ExtensionAPI) {
	registerUpdateCommand(pi);
	registerUpdateUpstreamCommand(pi);
}
