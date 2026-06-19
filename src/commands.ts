import type { ExtensionAPI, ExtensionContext } from "./pi-types.ts";
import { formatTaskList } from "./render.ts";
import type { TaskRuntimeStore } from "./store.ts";

export function registerTaskCommands(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
): void {
	pi.registerCommand("tasks", {
		description: "Show pi-tasks tasks on the current branch",
		handler: async (_args: string, ctx: ExtensionContext) => {
			const summary = formatTaskList(store.getState(), {
				includeDone: true,
				includeEvidence: true,
			});
			ctx.ui.notify(summary, "info");
		},
	});
}
