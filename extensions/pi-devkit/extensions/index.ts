import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { registerUpdateCommand } from "../commands/update";
import { setupTools } from "../tools";

export default function (pi: ExtensionAPI) {
	setupTools(pi);
	registerUpdateCommand(pi);
}
