import type { TaskState } from "./model.ts";
import type { ExtensionAPI, ExtensionContext } from "./pi-types.ts";
import { formatStatusText, formatWidgetLines } from "./render.ts";
import {
	emitTaskState,
	TASK_WIDGET_ID,
	type TaskStateEventReason,
} from "./state-events.ts";

export function updateTaskUi(
	pi: ExtensionAPI,
	ctx: ExtensionContext,
	state: TaskState,
	reason: TaskStateEventReason,
): void {
	ctx.ui.setStatus(TASK_WIDGET_ID, formatStatusText(state));
	ctx.ui.setWidget(TASK_WIDGET_ID, formatWidgetLines(state), {
		placement: "aboveEditor",
	});
	emitTaskState(pi, state, reason);
}
