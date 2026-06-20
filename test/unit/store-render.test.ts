import { describe, expect, it } from "vitest";
import { TASK_EVENT_CUSTOM_TYPE, type TaskEvent } from "../../src/model.ts";
import {
	buildTaskResume,
	formatStatusText,
	formatTaskFocus,
	formatTaskList,
	formatTaskResume,
	formatWidgetLines,
} from "../../src/render.ts";
import { replayBranchEntries, snapshotState } from "../../src/store.ts";

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
	planSteps: [
		{
			text: "verify renderer",
			expectedOutput: "Renderer output includes task contract",
			criterionIds: ["T1-AC1"],
			evidenceRequired: true,
			allowedActions: ["render helper"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single render helper assertion",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
	],
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

const coarseEvent: TaskEvent = {
	version: 1,
	id: "T2-created",
	type: "task.created",
	taskId: "T2",
	createdAt: "2026-06-18T00:00:00.000Z",
	source: "tool",
	title: "Compaction resume",
	objective: "Verify resume after compaction",
	acceptanceCriteria: ["resume restores child step"],
	planSteps: [
		{
			text: "Prepare release",
			expectedOutput: "Release is prepared",
			criterionIds: ["T2-AC1"],
			evidenceRequired: true,
			allowedActions: ["inspect", "test"],
			granularityCheck: {
				isAtomic: false,
				reason: "Contains multiple hidden subtasks",
				canBeDoneInOneAgentAction: false,
				hasSingleObservableOutput: false,
				hasSingleVerificationMethod: false,
				hasNoHiddenSubtasks: false,
			},
		},
	],
	activate: true,
};

const decomposeEvent: TaskEvent = {
	version: 1,
	id: "T2-decompose",
	type: "task.steps_decomposed",
	taskId: "T2",
	createdAt: "2026-06-18T00:01:00.000Z",
	source: "tool",
	parentStepId: "T2-S1",
	reason: "Create atomic resume steps",
	childSteps: [
		{
			text: "Run resume smoke",
			expectedOutput: "Resume smoke passes",
			criterionIds: ["T2-AC1"],
			evidenceRequired: true,
			allowedActions: ["run smoke"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single resume smoke check",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
		{
			text: "Record resume evidence",
			expectedOutput: "Evidence is linked",
			criterionIds: ["T2-AC1"],
			evidenceRequired: true,
			allowedActions: ["task_evidence"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single evidence recording step",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
	],
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

	it("bounds long evidence detail output", () => {
		const longText = "x".repeat(500);
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: {
					version: 1,
					id: "T1-evidence",
					type: "task.evidence_added",
					taskId: "T1",
					createdAt: "2026-06-18T00:02:00.000Z",
					source: "tool",
					evidence: {
						id: "E1",
						type: "command",
						level: "unit_test",
						summary: longText,
						passed: true,
						references: [longText],
						quality: {
							source: longText,
							reproducible: true,
							verifier: "tool",
							command: "npm test",
							artifactRefs: [longText],
							observedOutput: longText,
						},
					},
					criterionIds: ["T1-AC1"],
					stepIds: ["T1-S1"],
				},
			},
		]).state;
		const output = formatTaskList(state, { includeEvidence: true });
		expect(output).toContain("E1 evidence");
		expect(output).toContain("…");
		expect(output).not.toContain(longText);
	});

	it("formats the active focus with step contract details", () => {
		const state = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: createEvent },
		]).state;
		const output = formatTaskFocus(state);
		expect(output).toContain("Current step: T1-S1");
		expect(output).toContain("Granularity: atomic");
		expect(output).toContain("Expected output");
		expect(output).toContain("Evidence: none (required)");
	});

	it("replays a compaction snapshot with resume fields for a decomposed step", () => {
		const beforeSnapshot = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: coarseEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: decomposeEvent,
			},
		]).state;
		const snapshot: TaskEvent = {
			version: 1,
			id: "T2-snapshot",
			type: "task.snapshot",
			taskId: "T2",
			createdAt: "2026-06-18T00:02:00.000Z",
			source: "system",
			state: snapshotState(beforeSnapshot),
			resume: buildTaskResume(beforeSnapshot),
			reason: "compaction",
		};
		const result = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: snapshot },
		]);
		const output = formatTaskResume(result.state);
		expect(result.state.activeTaskId).toBe("T2");
		expect(output).toContain("Current step: T2-S1.1");
		expect(output).toContain("Lineage: T2-S1:breaking_down > T2-S1.1:atomic");
		expect(output).toContain("task_evidence.step_ids");
		expect(snapshot.resume.currentStepId).toBe("T2-S1.1");
	});

	it("continues replay correctly after a snapshot checkpoint", () => {
		const beforeSnapshot = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: coarseEvent },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: decomposeEvent,
			},
		]).state;
		const snapshot: TaskEvent = {
			version: 1,
			id: "T2-snapshot",
			type: "task.snapshot",
			taskId: "T2",
			createdAt: "2026-06-18T00:02:00.000Z",
			source: "system",
			state: snapshotState(beforeSnapshot),
			resume: buildTaskResume(beforeSnapshot),
			reason: "manual",
		};
		const evidenceEvent: TaskEvent = {
			version: 1,
			id: "T2-evidence",
			type: "task.evidence_added",
			taskId: "T2",
			createdAt: "2026-06-18T00:03:00.000Z",
			source: "tool",
			evidence: {
				id: "E1",
				type: "test",
				level: "unit_test",
				summary: "resume smoke passed",
				passed: true,
				references: ["npm test"],
				quality: {
					source: "vitest",
					reproducible: true,
					verifier: "tool",
					artifactRefs: ["npm test"],
					observedOutput: "resume smoke test passed",
				},
			},
			criterionIds: ["T2-AC1"],
			stepIds: ["T2-S1.1"],
		};
		const doneEvent: TaskEvent = {
			version: 1,
			id: "T2-step-done",
			type: "task.updated",
			taskId: "T2",
			createdAt: "2026-06-18T00:04:00.000Z",
			source: "tool",
			stepId: "T2-S1.1",
			stepStatus: "done",
		};
		const result = replayBranchEntries([
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: snapshot },
			{
				type: "custom",
				customType: TASK_EVENT_CUSTOM_TYPE,
				data: evidenceEvent,
			},
			{ type: "custom", customType: TASK_EVENT_CUSTOM_TYPE, data: doneEvent },
		]);
		expect(result.state.tasks.T2?.planSteps[0]?.status).toBe("done");
		expect(result.state.tasks.T2?.planSteps[0]?.evidenceIds).toEqual(["E1"]);
		expect(formatTaskResume(result.state)).toContain("Current step: T2-S1.2");
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
