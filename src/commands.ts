import type { ExtensionAPI, ExtensionContext } from "./pi-types.ts";
import { formatTaskList } from "./render.ts";
import {
	createSemanticCapabilityMonitor,
	type SemanticCapabilityMonitor,
} from "./semantic-capability.ts";
import type { TaskRuntimeStore } from "./store.ts";

export function registerTaskCommands(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
	semanticMonitor: SemanticCapabilityMonitor = createSemanticCapabilityMonitor(),
): void {
	pi.registerCommand("tasks", {
		description:
			"Show current tasks; use /tasks doctor or /tasks doctor live to diagnose native semantic assessment",
		handler: async (args: string, ctx: ExtensionContext) => {
			const mode = args.trim().toLowerCase();
			if (mode === "doctor" || mode === "doctor live") {
				const result = await semanticMonitor.doctor(ctx, {
					live: mode === "doctor live",
				});
				const notificationType =
					result.liveProbe?.status === "failed" ||
					result.report.overall === "unavailable"
						? "warning"
						: "info";
				ctx.ui.notify(result.text, notificationType);
				return;
			}

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
