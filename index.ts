import { registerTaskCommands } from "./src/commands.ts";
import type { ExtensionAPI, ExtensionContext } from "./src/pi-types.ts";
import { buildTaskResume } from "./src/render.ts";
import {
	TASK_STATE_EVENT,
	TASK_WIDGET_ID,
	type TaskStateEvent,
	type TaskStateEventReason,
} from "./src/state-events.ts";
import { createTaskRuntimeStore, snapshotState } from "./src/store.ts";
import { registerTaskTools } from "./src/tools.ts";
import { updateTaskUi } from "./src/widget.ts";

export {
	TASK_STATE_EVENT,
	TASK_WIDGET_ID,
	type TaskStateEvent,
	type TaskStateEventReason,
};

export default function (pi: ExtensionAPI) {
	const store = createTaskRuntimeStore();

	const replay = (
		ctx: ExtensionContext,
		reason: Extract<TaskStateEventReason, "session_start" | "session_tree">,
	) => {
		const result = store.replay(ctx.sessionManager.getBranch());
		updateTaskUi(pi, ctx, result.state, reason);
		if (result.malformedEvents.length > 0) {
			ctx.ui.notify(
				`pi-tasks skipped ${result.malformedEvents.length} malformed event(s)`,
				"warning",
			);
		}
	};

	pi.on("session_start", async (_event, ctx) => replay(ctx, "session_start"));
	pi.on("session_tree", async (_event, ctx) => replay(ctx, "session_tree"));
	pi.on("session_before_compact", async (_event, _ctx) => {
		const state = store.getState();
		if (Object.keys(state.tasks).length > 0) {
			const createdAt = new Date().toISOString();
			pi.appendEntry("pi-tasks:event", {
				version: 1,
				id: `snapshot-${createdAt}`,
				type: "task.snapshot",
				taskId: state.activeTaskId ?? "snapshot",
				createdAt,
				source: "system",
				state: snapshotState(state),
				resume: buildTaskResume(state),
				reason: "compaction",
			});
		}
	});

	registerTaskTools(pi, store);
	registerTaskCommands(pi, store);
}
