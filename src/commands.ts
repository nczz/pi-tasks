import type { ExtensionAPI, ExtensionContext } from "./pi-types.ts";
import { formatTaskList } from "./render.ts";
import type { TaskRuntimeStore } from "./store.ts";

export function registerTaskCommands(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
): void {
	pi.registerCommand("tasks", {
		description: "Show pi-tasks tasks on the current branch",
		handler: async (args: string, ctx: ExtensionContext) => {
			const mode = args.trim().toLowerCase();
			const includeDetails =
				mode === "detail" || mode === "details" || mode === "evidence";
			const summary = formatTaskList(store.getState(), {
				includeDone: includeDetails,
				includeEvidence: includeDetails,
				limit: includeDetails ? 20 : 10,
			});
			ctx.ui.notify(summary, "info");
		},
	});
}
