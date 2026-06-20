import { describe, expect, it } from "vitest";
import { registerTaskCommands } from "../../src/commands.ts";
import { TASK_EVENT_CUSTOM_TYPE, type TaskEvent } from "../../src/model.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	RegisteredCommand,
} from "../../src/pi-types.ts";
import { createTaskRuntimeStore } from "../../src/store.ts";

const createEvent: TaskEvent = {
	version: 1,
	id: "T1-created",
	type: "task.created",
	taskId: "T1",
	createdAt: "2026-06-18T00:00:00.000Z",
	source: "tool",
	title: "Command test",
	objective: "Verify /tasks",
	acceptanceCriteria: ["command shows task"],
	planSteps: [
		{
			text: "render command output",
			expectedOutput: "/tasks command output includes task details",
			criterionIds: ["T1-AC1"],
			evidenceRequired: true,
			allowedActions: ["run /tasks command"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single command render assertion",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
	],
	activate: true,
};

describe("/tasks command", () => {
	it("registers and notifies a compact current branch task summary by default", async () => {
		const commands = new Map<string, RegisteredCommand>();
		const pi: ExtensionAPI = {
			on: () => {},
			registerTool: () => {},
			registerCommand: (name, command) => commands.set(name, command),
			appendEntry: () => {},
		};
		const store = createTaskRuntimeStore();
		store.replay([
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: createEvent,
			},
		]);
		let notification = "";
		const ctx: ExtensionContext = {
			mode: "tui",
			sessionManager: { getBranch: () => [] },
			ui: {
				notify: (message) => {
					notification = message;
				},
				setStatus: () => {},
				setWidget: () => {},
			},
		};

		registerTaskCommands(pi, store);
		await commands.get("tasks")?.handler("", ctx);

		expect(notification).toContain("T1 [active]");
		expect(notification).not.toContain("T1-AC1");
	});

	it("shows full task details only when explicitly requested", async () => {
		const commands = new Map<string, RegisteredCommand>();
		const pi: ExtensionAPI = {
			on: () => {},
			registerTool: () => {},
			registerCommand: (name, command) => commands.set(name, command),
			appendEntry: () => {},
		};
		const store = createTaskRuntimeStore();
		store.replay([
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: createEvent,
			},
		]);
		let notification = "";
		const ctx: ExtensionContext = {
			mode: "tui",
			sessionManager: { getBranch: () => [] },
			ui: {
				notify: (message) => {
					notification = message;
				},
				setStatus: () => {},
				setWidget: () => {},
			},
		};

		registerTaskCommands(pi, store);
		await commands.get("tasks")?.handler("detail", ctx);

		expect(notification).toContain("T1 [active]");
		expect(notification).toContain("T1-AC1");
	});
});
