import {
	createEmptyState,
	type ReplayResult,
	TASK_EVENT_CUSTOM_TYPE,
	type TaskEvent,
	type TaskState,
} from "./model.ts";
import { reduceTaskState, TaskTransitionError } from "./reducer.ts";

export interface BranchEntry {
	type: string;
	customType?: string;
	data?: unknown;
	id?: string;
	timestamp?: string;
}

export interface TaskRuntimeStore {
	getState(): TaskState;
	replay(branchEntries: BranchEntry[]): ReplayResult;
	append(
		event: TaskEvent,
		appendEntry: (customType: string, data: TaskEvent) => void,
	): TaskState;
}

export function createTaskRuntimeStore(
	initialState: TaskState = createEmptyState(),
): TaskRuntimeStore {
	let state = initialState;

	return {
		getState() {
			return state;
		},
		replay(branchEntries) {
			const replayed = replayBranchEntries(branchEntries);
			state = replayed.state;
			return replayed;
		},
		append(event, appendEntry) {
			const next = reduceTaskState(state, event);
			appendEntry(TASK_EVENT_CUSTOM_TYPE, event);
			state = next;
			return state;
		},
	};
}

export function replayBranchEntries(entries: BranchEntry[]): ReplayResult {
	let state = createEmptyState();
	const malformedEvents: string[] = [];
	for (const entry of entries) {
		if (entry.type !== "custom" || entry.customType !== TASK_EVENT_CUSTOM_TYPE)
			continue;
		if (!isTaskEvent(entry.data)) {
			malformedEvents.push(
				`Entry ${entry.id ?? "unknown"} is not a pi-tasks event`,
			);
			continue;
		}
		try {
			state = reduceTaskState(state, entry.data);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			malformedEvents.push(`Entry ${entry.id ?? entry.data.id}: ${message}`);
		}
	}
	if (malformedEvents.length > 0) {
		state.warnings.push(...malformedEvents);
	}
	return { state, malformedEvents };
}

export function snapshotState(state: TaskState): Omit<TaskState, "events"> {
	const { events: _events, ...snapshot } = state;
	return snapshot;
}

function isTaskEvent(value: unknown): value is TaskEvent {
	if (!value || typeof value !== "object") return false;
	const maybe = value as Partial<TaskEvent>;
	return (
		maybe.version === 1 &&
		typeof maybe.id === "string" &&
		typeof maybe.type === "string"
	);
}

export function errorText(error: unknown): string {
	if (error instanceof TaskTransitionError) return error.message;
	if (error instanceof Error) return error.message;
	return String(error);
}
