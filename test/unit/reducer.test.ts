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
import { evidenceAssessment, planAssessment } from "./semantic-fixture.ts";

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
function gateEvidence({
	id,
	eventId,
	passed,
	createdAt,
	supersedes,
	criterionIds = ["T1-AC1", "T1-AC2"],
	stepIds = ["T1-S1"],
}: {
	id: string;
	eventId: string;
	passed: boolean;
	createdAt: string;
	supersedes?: string[];
	criterionIds?: string[];
	stepIds?: string[];
}): TaskEvent {
	const result = passed ? "passed" : "failed";
	return evidence({
		id: eventId,
		createdAt,
		evidence: {
			id,
			type: "review",
			level: "release_grade_e2e",
			summary: `techlead gate ${result}`,
			passed,
			references: ["techlead gate"],
			quality: {
				source: "techlead gate",
				reproducible: true,
				verifier: "user",
				artifactRefs: ["techlead gate"],
				observedOutput: `techlead gate ${result}`,
			},
			...(supersedes ? { supersedes } : {}),
		},
		criterionIds,
		stepIds,
	});
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

	it("auto-links all task criteria when criterionIds is empty", () => {
		const state = reduceTaskState(createEmptyState(), {
			...created(),
			planSteps: [
				{
					text: "write reducer",
					expectedOutput: "Reducer transition is implemented",
					criterionIds: [],
					evidenceRequired: true,
					allowedActions: ["edit reducer", "run unit test"],
					decompositionStatus: "atomic",
					granularityCheck: atomicCheck,
				},
			],
		});

		expect(state.tasks.T1.planSteps[0]?.criterionIds).toEqual([
			"T1-AC1",
			"T1-AC2",
		]);
	});

	it("auto-links parent criteria when decomposed criterionIds is empty", () => {
		const decomposition = decompose();
		if (decomposition.type !== "task.steps_decomposed") {
			throw new Error("Expected a decomposition event");
		}
		const state = apply([
			coarseCreated(),
			{
				...decomposition,
				childSteps: decomposition.childSteps.map((step) => ({
					...step,
					criterionIds: [],
				})),
			},
		]);

		expect(state.tasks.T1.planSteps.map((step) => step.criterionIds)).toEqual([
			["T1-AC1", "T1-AC2"],
			["T1-AC1", "T1-AC2"],
		]);
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

	it("uses the persisted model decision instead of lexical wording", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const sourceStep = base.planSteps[0];
		if (!sourceStep) throw new Error("Expected one plan step");
		const planSteps = [
			{
				...sourceStep,
				text: "Fix the parser and index output in src/parser.ts",
				expectedOutput: "Parser and index output share one normalized record",
			},
		];
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: planSteps,
		};
		const state = apply([
			{
				...base,
				version: 2,
				planSteps,
				semanticAssessment: planAssessment(input),
			},
		]);

		expect(state.tasks.T1.planSteps[0]).toMatchObject({
			decompositionStatus: "atomic",
			semanticAssessment: { decision: "atomic" },
			planQuality: { score: 95, issues: [] },
		});
	});

	it("persists the model decision when a step needs decomposition", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		const state = apply([
			{
				...base,
				version: 2,
				semanticAssessment: planAssessment(input, ["needs_breakdown"]),
			},
		]);

		expect(state.tasks.T1.planSteps[0]).toMatchObject({
			decompositionStatus: "needs_breakdown",
			granularityCheck: { isAtomic: false },
			semanticAssessment: { decision: "needs_breakdown" },
		});
	});

	it("requires semantic assessment on version 2 plan mutations", () => {
		expect(() => apply([{ ...created(), version: 2 }])).toThrow(
			"Version 2 plan mutations require a native semantic assessment",
		);
	});

	it("rejects a model-assessed nonspecific plan step", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		expect(() =>
			apply([
				{
					...base,
					version: 2,
					semanticAssessment: planAssessment(input, ["rejected"]),
				},
			]),
		).toThrow("failed semantic assessment");
	});

	it("rejects a semantic assessment copied to changed plan input", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		expect(() =>
			apply([
				{
					...base,
					version: 2,
					objective: "Changed after assessment",
					semanticAssessment: planAssessment(input),
				},
			]),
		).toThrow("input hash does not match");
	});

	it("rejects invalid semantic provenance during replay", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		const semanticAssessment = planAssessment(input);
		semanticAssessment.provenance.strategy =
			"external_sdk" as typeof semanticAssessment.provenance.strategy;

		expect(() =>
			apply([
				{
					...base,
					version: 2,
					semanticAssessment,
				},
			]),
		).toThrow("Semantic assessment provenance is invalid");
	});

	it("rejects out-of-contract semantic judgment values during replay", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		const semanticAssessment = planAssessment(input);
		const first = semanticAssessment.steps[0];
		if (!first) throw new Error("Expected one semantic assessment");
		first.actionCount.value = "zero" as typeof first.actionCount.value;

		expect(() =>
			apply([
				{
					...base,
					version: 2,
					semanticAssessment,
				},
			]),
		).toThrow("invalid judgments");
	});

	it("rejects plan semantic issues inconsistent with judgments", () => {
		const base = created();
		if (base.type !== "task.created" || !base.planSteps) {
			throw new Error("Expected a task creation event");
		}
		const input = {
			title: base.title,
			objective: base.objective,
			acceptanceCriteria: base.acceptanceCriteria,
			steps: base.planSteps,
		};
		const semanticAssessment = planAssessment(input);
		const first = semanticAssessment.steps[0];
		if (!first) throw new Error("Expected one semantic assessment");
		first.issues = ["step contains hidden subtasks"];

		expect(() =>
			apply([
				{
					...base,
					version: 2,
					semanticAssessment,
				},
			]),
		).toThrow("inconsistent issues");
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

	it("accepts any language when persisted evidence semantics support the pass", () => {
		const evidenceEvent = evidence({
			evidence: {
				id: "E1",
				type: "test",
				level: "unit_test",
				summary: "完成了",
				passed: true,
				references: ["npm test"],
				quality: {
					source: "vitest",
					reproducible: true,
					verifier: "tool",
					command: "npm test",
					artifactRefs: ["npm test"],
					observedOutput: "96 tests passed, exit code 0",
				},
			},
		});
		if (
			evidenceEvent.type !== "task.evidence_added" ||
			!evidenceEvent.evidence.quality
		) {
			throw new Error("Expected an evidence event with quality");
		}
		const input = {
			type: evidenceEvent.evidence.type,
			level: evidenceEvent.evidence.level,
			summary: evidenceEvent.evidence.summary,
			references: evidenceEvent.evidence.references,
			quality: evidenceEvent.evidence.quality,
		};
		const state = apply([
			created(),
			{
				...evidenceEvent,
				version: 2,
				semanticAssessment: evidenceAssessment(input),
			},
		]);
		expect(state.tasks.T1.evidence[0]?.semanticAssessment).toMatchObject({
			decision: "supported",
			confidence: 0.95,
		});
	});

	it("rejects passing evidence when persisted semantics do not support it", () => {
		const evidenceEvent = evidence();
		if (
			evidenceEvent.type !== "task.evidence_added" ||
			!evidenceEvent.evidence.quality
		) {
			throw new Error("Expected an evidence event with quality");
		}
		const input = {
			type: evidenceEvent.evidence.type,
			level: evidenceEvent.evidence.level,
			summary: evidenceEvent.evidence.summary,
			references: evidenceEvent.evidence.references,
			quality: evidenceEvent.evidence.quality,
		};
		expect(() =>
			apply([
				created(),
				{
					...evidenceEvent,
					version: 2,
					semanticAssessment: evidenceAssessment(input, "unsupported"),
				},
			]),
		).toThrow("failed semantic assessment");
	});

	it("rejects supported evidence semantics that retain material issues", () => {
		const evidenceEvent = evidence();
		if (
			evidenceEvent.type !== "task.evidence_added" ||
			!evidenceEvent.evidence.quality
		) {
			throw new Error("Expected an evidence event with quality");
		}
		const input = {
			type: evidenceEvent.evidence.type,
			level: evidenceEvent.evidence.level,
			summary: evidenceEvent.evidence.summary,
			references: evidenceEvent.evidence.references,
			quality: evidenceEvent.evidence.quality,
		};
		const semanticAssessment = evidenceAssessment(input);
		semanticAssessment.issues = ["contradictory_result"];

		expect(() =>
			apply([
				created(),
				{
					...evidenceEvent,
					version: 2,
					semanticAssessment,
				},
			]),
		).toThrow("cannot contain issues");
	});

	it("requires semantic assessment on version 2 passing evidence", () => {
		expect(() => apply([created(), { ...evidence(), version: 2 }])).toThrow(
			"requires a native semantic assessment",
		);
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

	it("allows later passing evidence to supersede a linked failed rerun", () => {
		const state = apply([
			created(),
			gateEvidence({
				id: "E1",
				eventId: "T1-evidence-failed",
				passed: false,
				createdAt: "2026-06-18T00:00:01.000Z",
			}),
			gateEvidence({
				id: "E2",
				eventId: "T1-evidence-passed",
				passed: true,
				createdAt: "2026-06-18T00:00:02.000Z",
				supersedes: ["E1"],
			}),
			stepDone(),
			complete({ evidenceIds: ["E2"] }),
		]);

		expect(state.tasks.T1.status).toBe("done");
		expect(state.tasks.T1.planSteps[0]?.evidenceIds).toEqual(["E1", "E2"]);
		expect(state.tasks.T1.acceptanceCriteria[0]?.evidenceIds).toEqual([
			"E1",
			"E2",
		]);
	});

	it("keeps failed evidence blocking until explicitly superseded", () => {
		expect(() =>
			apply([
				created(),
				gateEvidence({
					id: "E1",
					eventId: "T1-evidence-failed",
					passed: false,
					createdAt: "2026-06-18T00:00:01.000Z",
				}),
				gateEvidence({
					id: "E2",
					eventId: "T1-evidence-passed",
					passed: true,
					createdAt: "2026-06-18T00:00:02.000Z",
				}),
				stepDone(),
				complete({ evidenceIds: ["E2"] }),
			]),
		).toThrow("failing evidence E1");
	});

	it("rejects supersedes references to missing evidence", () => {
		expect(() =>
			apply([
				created(),
				gateEvidence({
					id: "E2",
					eventId: "T1-evidence-passed",
					passed: true,
					createdAt: "2026-06-18T00:00:02.000Z",
					supersedes: ["E404"],
				}),
			]),
		).toThrow("Evidence E404 not found");
	});

	it("rejects superseding evidence without the same linked scope", () => {
		expect(() =>
			apply([
				created(),
				gateEvidence({
					id: "E1",
					eventId: "T1-evidence-failed",
					passed: false,
					createdAt: "2026-06-18T00:00:01.000Z",
					criterionIds: [],
					stepIds: ["T1-S1"],
				}),
				gateEvidence({
					id: "E2",
					eventId: "T1-evidence-passed",
					passed: true,
					createdAt: "2026-06-18T00:00:02.000Z",
					supersedes: ["E1"],
					criterionIds: [],
					stepIds: [],
				}),
			]),
		).toThrow("must link step T1-S1");
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

	it("does not deep-clone accumulated event history", () => {
		const initial = reduceTaskState(createEmptyState(), created());
		const state: TaskState = {
			...initial,
			events: Array.from({ length: 500 }, (_, index) => ({
				...created(),
				id: `historic-${index}`,
			})),
		};
		const stateBeforeRejectedTransition = structuredClone(state);
		const originalStructuredClone = globalThis.structuredClone;
		const clonedEventCounts: number[] = [];
		globalThis.structuredClone = <T>(value: T): T => {
			const candidate = value as { events?: unknown };
			if (Array.isArray(candidate.events)) {
				clonedEventCounts.push(candidate.events.length);
			}
			return originalStructuredClone(value);
		};

		try {
			const updateEvent = updated({ progress: 42 });
			const next = reduceTaskState(state, updateEvent);

			expect(clonedEventCounts).toEqual([0]);
			expect(next.events).toHaveLength(501);
			expect(next.events[0]).toBe(state.events[0]);
			expect(next.events.at(-1)).toBe(updateEvent);
			expect(next.tasks.T1).not.toBe(state.tasks.T1);

			expect(() => reduceTaskState(state, updated({ status: "done" }))).toThrow(
				"Use task_complete",
			);
			expect(clonedEventCounts).toEqual([0, 0]);
			expect(state).toEqual(stateBeforeRejectedTransition);
		} finally {
			globalThis.structuredClone = originalStructuredClone;
		}
	});

	it("replay reconstructs the same state", () => {
		const events = [created(), ...evidenceThenStepDone(), complete()];
		expect(replayTaskEvents(events)).toEqual(apply(events));
	});
});
