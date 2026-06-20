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

const atomicCheck = {
	isAtomic: true,
	reason: "Single reducer edit with one unit-test verification",
	canBeDoneInOneAgentAction: true,
	hasSingleObservableOutput: true,
	hasSingleVerificationMethod: true,
	hasNoHiddenSubtasks: true,
};

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
		planSteps: [
			{
				text: "write reducer",
				expectedOutput: "Reducer transition is implemented",
				criterionIds: [`${taskId}-AC1`, `${taskId}-AC2`],
				evidenceRequired: true,
				allowedActions: ["edit reducer", "run unit test"],
				decompositionStatus: "atomic",
				granularityCheck: atomicCheck,
			},
		],
		activate,
	};
}

function coarseCreated(): TaskEvent {
	return {
		...created(),
		planSteps: [
			{
				text: "Prepare release verification package",
				expectedOutput:
					"Release verification package produces auditable output",
				criterionIds: ["T1-AC1", "T1-AC2"],
				evidenceRequired: true,
				allowedActions: ["inspect", "edit", "test"],
				granularityCheck: {
					isAtomic: false,
					reason: "Contains build, package, install, and dogfood subtasks",
					canBeDoneInOneAgentAction: false,
					hasSingleObservableOutput: false,
					hasSingleVerificationMethod: false,
					hasNoHiddenSubtasks: false,
				},
			},
		],
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
			quality: {
				source: "vitest",
				reproducible: true,
				verifier: "tool",
				artifactRefs: ["npm test"],
				observedOutput: "Test suite passed",
			},
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

function evidenceThenStepDone(): TaskEvent[] {
	return [evidence(), stepDone()];
}

function decompose(): TaskEvent {
	return {
		version: 1,
		id: "T1-decompose",
		type: "task.steps_decomposed",
		taskId: "T1",
		createdAt: now,
		source: "tool",
		parentStepId: "T1-S1",
		reason: "Split release workflow into atomic verification steps",
		childSteps: [
			{
				text: "Run package dry-run",
				expectedOutput: "npm pack dry-run completes",
				criterionIds: ["T1-AC1"],
				evidenceRequired: true,
				allowedActions: ["npm pack --dry-run"],
				decompositionStatus: "atomic",
				granularityCheck: atomicCheck,
			},
			{
				text: "Run installed package smoke",
				expectedOutput: "Installed package smoke completes",
				criterionIds: ["T1-AC2"],
				evidenceRequired: true,
				allowedActions: ["pi installed smoke"],
				decompositionStatus: "atomic",
				granularityCheck: atomicCheck,
			},
		],
	};
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

	it("rejects task creation without ordered plan steps", () => {
		expect(() =>
			reduceTaskState(createEmptyState(), {
				...created(),
				planSteps: [],
			}),
		).toThrow("At least one ordered plan step is required");
	});

	it("requires non-atomic steps to be decomposed before completion", () => {
		expect(() => apply([coarseCreated(), evidence(), stepDone()])).toThrow(
			"use task_decompose until it is atomic",
		);
		const state = apply([coarseCreated(), decompose()]);
		expect(state.tasks.T1.planSteps.map((step) => step.id)).toEqual([
			"T1-S1.1",
			"T1-S1.2",
		]);
		expect(state.tasks.T1.planSteps[0]?.status).toBe("active");
		expect(state.tasks.T1.planSteps[0]?.parentStepId).toBe("T1-S1");
		expect(state.tasks.T1.currentStep).toBe("Run package dry-run");
	});

	it("rejects compound atomic step wording", () => {
		expect(() =>
			apply([
				{
					...created(),
					planSteps: [
						{
							text: "Run tests and update docs",
							expectedOutput: "Test result is recorded",
							criterionIds: ["T1-AC1"],
							evidenceRequired: true,
							allowedActions: ["npm test"],
							decompositionStatus: "atomic",
							granularityCheck: atomicCheck,
						},
					],
				},
			]),
		).toThrow("multiple actions");
	});

	it("does not auto-link criterion evidence to multiple matching child steps", () => {
		const sharedCriterionDecompose: TaskEvent = {
			...decompose(),
			childSteps: [
				{
					text: "Run package dry-run",
					expectedOutput: "npm pack dry-run completes",
					criterionIds: ["T1-AC1"],
					evidenceRequired: true,
					allowedActions: ["npm pack --dry-run"],
					decompositionStatus: "atomic",
					granularityCheck: atomicCheck,
				},
				{
					text: "Run package import smoke",
					expectedOutput: "package import smoke completes",
					criterionIds: ["T1-AC1"],
					evidenceRequired: true,
					allowedActions: ["node import smoke"],
					decompositionStatus: "atomic",
					granularityCheck: atomicCheck,
				},
			],
		};
		const broadEvidence: TaskEvent = {
			...evidence(),
			criterionIds: ["T1-AC1"],
		};
		const stepEvidence: TaskEvent = {
			...evidence({
				id: "T1-evidence-step",
				evidence: {
					id: "E2",
					type: "test",
					level: "unit_test",
					summary: "pack dry-run passed",
					passed: true,
					references: ["npm pack --dry-run"],
					quality: {
						source: "npm",
						reproducible: true,
						verifier: "tool",
						artifactRefs: ["npm pack --dry-run"],
						observedOutput: "npm pack dry-run completed",
					},
				},
			}),
			criterionIds: ["T1-AC1"],
			stepIds: ["T1-S1.1"],
		};
		const broadState = apply([
			coarseCreated(),
			sharedCriterionDecompose,
			broadEvidence,
		]);
		expect(broadState.tasks.T1.planSteps[0]?.evidenceIds).toEqual([]);
		expect(broadState.tasks.T1.planSteps[1]?.evidenceIds).toEqual([]);
		const linkedState = apply([
			coarseCreated(),
			sharedCriterionDecompose,
			stepEvidence,
		]);
		expect(linkedState.tasks.T1.planSteps[0]?.evidenceIds).toEqual(["E2"]);
		expect(linkedState.tasks.T1.planSteps[1]?.evidenceIds).toEqual([]);
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
		expect(state.tasks.T1.progress).toBeGreaterThan(1);
		expect(state.tasks.T1.progress).toBeLessThan(100);
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
					quality: {
						source: "vitest",
						reproducible: true,
						verifier: "tool",
						artifactRefs: ["npm test"],
						observedOutput: "Test suite passed",
					},
				},
			}),
		]);
		expect(state.tasks.T1.evidence).toHaveLength(1);
		expect(state.tasks.T1.evidence[0]?.id).toBe("E1");
		expect(state.tasks.T1.acceptanceCriteria[0]?.evidenceIds).toEqual(["E1"]);
	});

	it("advances plan steps only in order", () => {
		const state = apply([created(), ...evidenceThenStepDone()]);
		expect(state.tasks.T1.planSteps[0]?.status).toBe("done");
		expect(state.tasks.T1.currentStep).toBeUndefined();
		expect(state.tasks.T1.progress).toBeGreaterThan(1);
		expect(() =>
			apply([
				created(),
				evidence(),
				updated({ stepId: "T1-S2", stepStatus: "done" }),
			]),
		).toThrow("cannot be updated before T1-S1");
	});

	it("rejects evidence-required step completion without evidence", () => {
		expect(() => apply([created(), stepDone()])).toThrow(
			"requires evidence before done",
		);
	});

	it("records scope drift warnings when activity is off plan", () => {
		const state = apply([
			created(),
			updated({
				activity: "Edited an unrelated release script",
				scope: "off_plan",
				scopeReason: "Needed to verify drift detection",
			}),
		]);
		expect(state.tasks.T1.warnings[0]).toContain("off_plan");
		expect(() =>
			apply([
				created(),
				updated({ activity: "Changed scope", scope: "scope_change" }),
			]),
		).toThrow("requires scopeReason");
	});

	it("requires scope drift warnings to be resolved before completion", () => {
		const warning =
			"off_plan: Edited an unrelated release script (Needed to verify drift detection)";
		expect(() =>
			apply([
				created(),
				updated({
					activity: "Edited an unrelated release script",
					scope: "off_plan",
					scopeReason: "Needed to verify drift detection",
				}),
				...evidenceThenStepDone(),
				complete(),
			]),
		).toThrow("unresolved scope drift warning");
		const state = apply([
			created(),
			updated({
				activity: "Edited an unrelated release script",
				scope: "off_plan",
				scopeReason: "Needed to verify drift detection",
			}),
			...evidenceThenStepDone(),
			updated({ resolveWarnings: [warning] }),
			complete(),
		]);
		expect(state.tasks.T1.status).toBe("done");
	});

	it("derives high active progress when all criteria are satisfied", () => {
		const state = apply([created(), ...evidenceThenStepDone()]);
		expect(state.tasks.T1.status).toBe("active");
		expect(state.tasks.T1.progress).toBe(99);
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

	it("rejects low-quality evidence without observed output", () => {
		expect(() =>
			apply([
				created(),
				evidence({
					evidence: {
						id: "E1",
						type: "test",
						level: "unit_test",
						summary: "tests passed",
						passed: true,
						references: ["npm test"],
						quality: {
							source: "vitest",
							reproducible: true,
							verifier: "agent",
							artifactRefs: ["npm test"],
						},
					},
				}),
			]),
		).toThrow("observedOutput is required");
	});

	it("rejects oversized evidence text", () => {
		expect(() =>
			apply([
				created(),
				evidence({
					evidence: {
						id: "E1",
						type: "test",
						level: "unit_test",
						summary: "x".repeat(501),
						passed: true,
						references: ["npm test"],
						quality: {
							source: "vitest",
							reproducible: true,
							verifier: "tool",
							artifactRefs: ["npm test"],
							observedOutput: "Test suite passed",
						},
					},
				}),
			]),
		).toThrow("summary exceeds");
	});

	it("locks evidence to the current step unless overrideReason is provided", () => {
		expect(() =>
			apply([
				coarseCreated(),
				decompose(),
				evidence({
					stepIds: ["T1-S1.2"],
					criterionIds: ["T1-AC2"],
				}),
			]),
		).toThrow("current step T1-S1.1");

		const state = apply([
			coarseCreated(),
			decompose(),
			evidence({
				stepIds: ["T1-S1.2"],
				criterionIds: ["T1-AC2"],
				overrideReason: "Backfilling evidence from prior installed smoke",
			}),
		]);
		expect(state.tasks.T1.planSteps[1]?.evidenceIds).toEqual(["E1"]);
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
				...evidenceThenStepDone(),
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
		const state = apply([created(), ...evidenceThenStepDone(), complete()]);
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
		const events = [created(), ...evidenceThenStepDone(), complete()];
		expect(replayTaskEvents(events)).toEqual(apply(events));
	});
});
