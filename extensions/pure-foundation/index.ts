import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

/**
 * Shared library extension entrypoint.
 * Intentionally registers nothing; this package exposes reusable modules for other pure-* extensions.
 */
export default function (_pi: ExtensionAPI): void {}

export * from "./primitives";
export * from "./tools";
export * from "./ui/components";
export * from "./utils";
export * from "./widgets";
