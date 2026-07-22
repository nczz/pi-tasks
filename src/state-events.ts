import type { TaskState } from "./model.ts";
import type { ExtensionAPI } from "./pi-types.ts";
import { snapshotState } from "./store.ts";

export const TASK_STATE_EVENT = "pi-tasks:state";
export const TASK_WIDGET_ID = "pi-tasks";

export type TaskStateEventReason =
	| "session_start"
	| "session_tree"
	| "task_mutation";

export interface TaskStateEvent {
	version: 1;
	reason: TaskStateEventReason;
	widgetId: typeof TASK_WIDGET_ID;
	state: Omit<TaskState, "events">;
}

export function emitTaskState(
	pi: ExtensionAPI,
	state: TaskState,
	reason: TaskStateEventReason,
): void {
	const event: TaskStateEvent = {
		version: 1,
		reason,
		widgetId: TASK_WIDGET_ID,
		state: structuredClone(snapshotState(state)),
	};

	try {
		pi.events.emit(TASK_STATE_EVENT, event);
	} catch {
		// UI observers must not break an already-persisted task transition.
	}
}
