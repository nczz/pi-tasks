import { describe, expect, it } from "vitest";
import { TASK_EVENT_CUSTOM_TYPE, type TaskEvent } from "../../src/model.ts";
import {
	formatStatusText,
	formatTaskFocus,
	formatTaskList,
	formatWidgetLines,
} from "../../src/render.ts";
import { replayBranchEntries } from "../../src/store.ts";

const createEvent: TaskEvent = {
	version: 1,
	id: "T1-created",
	type: "task.created",
	taskId: "T1",
	createdAt: "2026-06-18T00:00:00.000Z",
	source: "tool",
	title:
		"A very long task title that must be truncated in narrow status displays",
	objective: "Test branch replay",
	acceptanceCriteria: ["criterion"],
	initialSteps: ["verify renderer"],
	activate: true,
};

const blockEvent: TaskEvent = {
	version: 1,
	id: "T1-blocked",
	type: "task.updated",
	taskId: "T1",
	createdAt: "2026-06-18T00:01:00.000Z",
	source: "tool",
	status: "blocked",
	blocker: {
		reason: "Waiting on external approval",
		blockedBy: "external",
		neededToUnblock: "Approval received",
	},
};

describe("store replay and render helpers", () => {
	it("replays task events from custom branch entries", () => {
		const result = replayBranchEntries([
			{ type: "message", id: "m1" },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				id: "e1",
				data: createEvent,
			},
		]);
		expect(result.malformedEvents).toEqual([]);
		expect(result.state.activeTaskId).toBe("T1");
	});

	it("keeps loading valid events and reports malformed custom entries", () => {
		const result = replayBranchEntries([
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				id: "bad",
				data: { nope: true },
			},
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				id: "good",
				data: createEvent,
			},
		]);
		expect(result.state.activeTaskId).toBe("T1");
		expect(result.malformedEvents[0]).toContain("bad");
	});

	it("replays only the provided session branch", () => {
		const branchAUpdate: TaskEvent = {
			version: 1,
			id: "T1-update-a",
			type: "task.updated",
			taskId: "T1",
			createdAt: "2026-06-18T00:02:00.000Z",
			source: "tool",
			progress: 25,
			nextAction: "branch A",
		};
		const branchBUpdate: TaskEvent = {
			version: 1,
			id: "T1-update-b",
			type: "task.updated",
			taskId: "T1",
			createdAt: "2026-06-18T00:03:00.000Z",
			source: "tool",
			progress: 75,
			nextAction: "branch B",
		};

		const branchA = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: branchAUpdate,
			},
		]);
		const branchB = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: branchBUpdate,
			},
		]);

		expect(branchA.state.tasks.T1?.progress).toBe(25);
		expect(branchA.state.tasks.T1?.nextAction).toBe("branch A");
		expect(branchB.state.tasks.T1?.progress).toBe(75);
		expect(branchB.state.tasks.T1?.nextAction).toBe("branch B");
	});

	it("formats active status text with truncation", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
		]).state;
		const text = formatStatusText(state, 32);
		expect(text).toHaveLength(32);
		expect(text).toContain("Task T1 active");
	});

	it("formats compact widget lines", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
		]).state;
		const lines = formatWidgetLines(state, 80);
		expect(lines).toBeDefined();
		expect(lines?.length).toBeLessThanOrEqual(5);
		expect(lines?.[0]).toContain("Active task: T1");
	});

	it("includes criterion IDs when evidence details are requested", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
		]).state;
		expect(formatTaskList(state, { includeEvidence: true })).toContain(
			"T1-AC1",
		);
	});

	it("formats the active focus with step contract details", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
		]).state;
		const output = formatTaskFocus(state);
		expect(output).toContain("Current step: T1-S1");
		expect(output).toContain("Expected output");
		expect(output).toContain("Evidence: none (required)");
	});

	it("includes unresolved blocker details when evidence details are requested", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: blockEvent },
		]).state;
		const output = formatTaskList(state, { includeEvidence: true });
		expect(output).toContain("Waiting on external approval");
		expect(output).toContain("Approval received");
	});

	it("includes decisions and resolved blockers when evidence details are requested", () => {
		const unblockEvent: TaskEvent = {
			version: 1,
			id: "T1-unblocked",
			type: "task.updated",
			taskId: "T1",
			createdAt: "2026-06-18T00:02:00.000Z",
			source: "tool",
			status: "active",
			reason: "User approved option A",
		};
		const decisionEvent: TaskEvent = {
			version: 1,
			id: "T1-decision",
			type: "task.decision_recorded",
			taskId: "T1",
			createdAt: "2026-06-18T00:03:00.000Z",
			source: "tool",
			decision: {
				id: "D1",
				question: "Which option?",
				decision: "Use option A",
				decidedBy: "user",
				rationale: "Matches release scope",
			},
		};
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: blockEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: unblockEvent,
			},
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: decisionEvent,
			},
		]).state;
		const output = formatTaskList(state, { includeEvidence: true });
		expect(output).toContain("blocker T1-B1 [resolved]");
		expect(output).toContain("D1 decision [user]");
		expect(output).toContain("Use option A");
	});

	it("includes task warnings in detailed task output", () => {
		const driftEvent: TaskEvent = {
			version: 1,
			id: "T1-drift",
			type: "task.updated",
			taskId: "T1",
			createdAt: "2026-06-18T00:04:00.000Z",
			source: "tool",
			activity: "Changed unrelated files",
			scope: "off_plan",
			scopeReason: "Testing warning output",
		};
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: driftEvent },
		]).state;
		const output = formatTaskList(state, { includeEvidence: true });
		expect(output).toContain("warning off_plan");
		expect(output).toContain("Testing warning output");
	});
});
