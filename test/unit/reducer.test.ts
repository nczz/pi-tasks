import { describe, expect, it } from "vitest";
import {
	createEmptyState,
	type TaskEvent,
	type TaskState,
} from "../../src/model.ts";
import {
	reduceTaskState,
	replayTaskEvents,
	TaskTransitionError,
} from "../../src/reducer.ts";

const now = "2026-06-18T00:00:00.000Z";

function created(taskId = "T1", activate = true): TaskEvent {
	return {
		version: 1,
		id: `${taskId}-created`,
		type: "task.created",
		taskId,
		createdAt: now,
		source: "tool",
		title: "Build MVP",
		objective: "Implement pi-tasks MVP",
		acceptanceCriteria: ["model exists", "completion requires evidence"],
		initialSteps: ["write reducer"],
		activate,
	};
}

function updated(
	fields: Partial<Extract<TaskEvent, { type: "task.updated" }>>,
): TaskEvent {
	return {
		version: 1,
		id: `T1-updated-${Math.random()}`,
		type: "task.updated",
		taskId: "T1",
		createdAt: now,
		source: "tool",
		...fields,
	};
}

function evidence(
	params: Partial<Extract<TaskEvent, { type: "task.evidence_added" }>> = {},
): TaskEvent {
	return {
		version: 1,
		id: "T1-evidence",
		type: "task.evidence_added",
		taskId: "T1",
		createdAt: now,
		source: "tool",
		evidence: {
			id: "E1",
			type: "test",
			level: "unit_test",
			summary: "vitest passed",
			passed: true,
			references: ["npm test"],
		},
		criterionIds: ["T1-AC1", "T1-AC2"],
		...params,
	};
}

function complete(
	params: Partial<Extract<TaskEvent, { type: "task.completed" }>> = {},
): TaskEvent {
	return {
		version: 1,
		id: "T1-complete",
		type: "task.completed",
		taskId: "T1",
		createdAt: now,
		source: "tool",
		summary: "done",
		evidenceIds: ["E1"],
		...params,
	};
}

function stepDone(stepId = "T1-S1"): TaskEvent {
	return updated({ stepId, stepStatus: "done" });
}

function apply(events: TaskEvent[]): TaskState {
	return replayTaskEvents(events);
}

describe("task reducer", () => {
	it("creates and activates a task", () => {
		const state = reduceTaskState(createEmptyState(), created());
		expect(state.activeTaskId).toBe("T1");
		expect(state.tasks.T1.status).toBe("active");
		expect(state.tasks.T1.planSteps[0]?.id).toBe("T1-S1");
		expect(state.tasks.T1.planSteps[0]?.status).toBe("active");
		expect(state.tasks.T1.acceptanceCriteria).toHaveLength(2);
	});

	it("keeps only one active task by default", () => {
		const state = apply([created("T1", true), created("T2", true)]);
		expect(state.activeTaskId).toBe("T2");
		expect(state.tasks.T1.status).toBe("pending");
		expect(state.tasks.T2.status).toBe("active");
	});

	it("clamps update progress to 0-100", () => {
		const state = apply([created(), updated({ progress: 130 })]);
		expect(state.tasks.T1.progress).toBe(100);
	});

	it("blocks and unblocks a task", () => {
		const state = apply([
			created(),
			updated({
				status: "blocked",
				blocker: {
					reason: "Need user choice",
					blockedBy: "user",
					neededToUnblock: "Choose option",
				},
			}),
			updated({ status: "active", reason: "User chose option" }),
		]);
		expect(state.tasks.T1.status).toBe("active");
		expect(state.tasks.T1.blockers[0]?.resolvedAt).toBe(now);
	});

	it("rejects blocked transition without blocker details", () => {
		expect(() => apply([created(), updated({ status: "blocked" })])).toThrow(
			TaskTransitionError,
		);
	});

	it("adds evidence and satisfies criteria with passing evidence", () => {
		const state = apply([created(), evidence()]);
		expect(state.tasks.T1.evidence).toHaveLength(1);
		expect(
			state.tasks.T1.acceptanceCriteria.every(
				(criterion) => criterion.status === "satisfied",
			),
		).toBe(true);
	});

	it("deduplicates identical evidence during replay", () => {
		const state = apply([
			created(),
			evidence(),
			evidence({
				id: "T1-evidence-duplicate",
				evidence: {
					id: "E2",
					type: "test",
					level: "unit_test",
					summary: "vitest passed",
					passed: true,
					references: ["npm test"],
				},
			}),
		]);
		expect(state.tasks.T1.evidence).toHaveLength(1);
		expect(state.tasks.T1.evidence[0]?.id).toBe("E1");
		expect(state.tasks.T1.acceptanceCriteria[0]?.evidenceIds).toEqual(["E1"]);
	});

	it("advances plan steps only in order", () => {
		const state = apply([
			created(),
			updated({ stepId: "T1-S1", stepStatus: "done" }),
		]);
		expect(state.tasks.T1.planSteps[0]?.status).toBe("done");
		expect(state.tasks.T1.currentStep).toBeUndefined();
		expect(() =>
			apply([created(), updated({ stepId: "T1-S2", stepStatus: "done" })]),
		).toThrow("cannot be updated before T1-S1");
	});

	it("rejects passing non-note evidence with not_verified level", () => {
		expect(() =>
			apply([
				created(),
				evidence({
					evidence: {
						id: "E1",
						type: "test",
						level: "not_verified",
						summary: "claimed pass",
						passed: true,
						references: [],
					},
				}),
			]),
		).toThrow(TaskTransitionError);
	});

	it("rejects completion without evidence", () => {
		expect(() => apply([created(), complete({ evidenceIds: [] })])).toThrow(
			TaskTransitionError,
		);
	});

	it("rejects task_update attempts to mark done without task_complete", () => {
		expect(() => apply([created(), updated({ status: "done" })])).toThrow(
			"Use task_complete",
		);
	});

	it("rejects completion with unresolved blocker", () => {
		expect(() =>
			apply([
				created(),
				stepDone(),
				evidence(),
				updated({
					status: "blocked",
					blocker: {
						reason: "External outage",
						blockedBy: "external",
						neededToUnblock: "Service returns",
					},
				}),
				complete(),
			]),
		).toThrow(TaskTransitionError);
	});

	it("completes with evidence", () => {
		const state = apply([created(), stepDone(), evidence(), complete()]);
		expect(state.tasks.T1.status).toBe("done");
		expect(state.tasks.T1.progress).toBe(100);
		expect(state.activeTaskId).toBeUndefined();
	});

	it("rejects completion while plan steps remain open", () => {
		expect(() => apply([created(), evidence(), complete()])).toThrow(
			"Plan step T1-S1 is not complete",
		);
	});

	it("forced completion records warning and confidence below 80", () => {
		const state = apply([
			created(),
			complete({
				evidenceIds: [],
				forceWithReason: "External system unavailable",
			}),
		]);
		expect(state.tasks.T1.status).toBe("done");
		expect(state.tasks.T1.confidence).toBeLessThan(80);
		expect(state.tasks.T1.warnings[0]).toContain("Forced completion");
	});

	it("cancels task with reason", () => {
		const state = apply([
			created(),
			{
				version: 1,
				id: "T1-cancel",
				type: "task.cancelled",
				taskId: "T1",
				createdAt: now,
				source: "tool",
				reason: "Out of scope",
			},
		]);
		expect(state.tasks.T1.status).toBe("cancelled");
		expect(state.tasks.T1.cancelledAt).toBe(now);
	});

	it("replay reconstructs the same state", () => {
		const events = [created(), stepDone(), evidence(), complete()];
		expect(replayTaskEvents(events)).toEqual(apply(events));
	});
});
