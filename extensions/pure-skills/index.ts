import path from "node:path";
import type { PiExtension } from "@mariozechner/pi-coding-agent";

export default function pureSkills(pi: PiExtension) {
	pi.on("resources_discover", async (_event, _ctx) => {
		return {
			skillPaths: [path.join(__dirname, "skills")],
		};
	});
}
