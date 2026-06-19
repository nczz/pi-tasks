import {
	type AcceptanceCriterion,
	createEmptyState,
	type Task,
	type TaskEvent,
	type TaskEvidence,
	type TaskState,
	type TaskStatus,
	type TaskStep,
} from "./model.ts";

const TERMINAL_STATUSES: TaskStatus[] = ["done", "cancelled"];

export class TaskTransitionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TaskTransitionError";
	}
}

export function reduceTaskState(state: TaskState, event: TaskEvent): TaskState {
	validateEventEnvelope(event);
	const baseState =
		event.type === "task.snapshot"
			? applySnapshot(event)
			: applyEvent(cloneState(state), event);
	baseState.events = [...state.events, event];
	baseState.lastUpdatedAt = event.createdAt;
	return baseState;
}

export function replayTaskEvents(events: TaskEvent[]): TaskState {
	return events.reduce(
		(state, event) => reduceTaskState(state, event),
		createEmptyState(),
	);
}

function applyEvent(state: TaskState, event: TaskEvent): TaskState {
	switch (event.type) {
		case "task.created":
			return createTask(state, event);
		case "task.updated":
			return updateTask(state, event);
		case "task.evidence_added":
			return addEvidence(state, event);
		case "task.decision_recorded":
			return recordDecision(state, event);
		case "task.completed":
			return completeTask(state, event);
		case "task.cancelled":
			return cancelTask(state, event);
		case "task.snapshot":
			return applySnapshot(event);
		default:
			return unreachable(event);
	}
}

function createTask(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.created" }>,
): TaskState {
	if (state.tasks[event.taskId]) {
		throw new TaskTransitionError(`Task ${event.taskId} already exists`);
	}
	if (!event.title.trim())
		throw new TaskTransitionError("Task title is required");
	if (!event.objective.trim())
		throw new TaskTransitionError("Task objective is required");
	if (event.acceptanceCriteria.length === 0) {
		throw new TaskTransitionError(
			"At least one acceptance criterion is required",
		);
	}

	const acceptanceCriteria = event.acceptanceCriteria.map(
		(text, index): AcceptanceCriterion => {
			if (!text.trim())
				throw new TaskTransitionError("Acceptance criteria cannot be blank");
			return {
				id: `${event.taskId}-AC${index + 1}`,
				text,
				status: "pending",
				evidenceIds: [],
			};
		},
	);
	const planSteps = createPlanSteps(
		event.taskId,
		event.initialSteps ?? [],
		event.createdAt,
		event.activate ?? true,
	);
	const task: Task = {
		id: event.taskId,
		title: event.title,
		objective: event.objective,
		status: event.activate ? "active" : "pending",
		priority: event.priority ?? "normal",
		progress: event.activate ? 1 : 0,
		planSteps,
		acceptanceCriteria,
		evidence: [],
		decisions: [],
		blockers: [],
		dependencies: event.dependencies ?? [],
		tags: event.tags ?? [],
		linkedFiles: event.linkedFiles ?? [],
		linkedCommits: [],
		confidence: 0,
		createdAt: event.createdAt,
		updatedAt: event.createdAt,
		warnings: [],
	};
	const activeStep = getActiveStep(task);
	if (activeStep) {
		task.currentStep = activeStep.text;
		task.nextAction = activeStep.text;
	}
	if (event.parentId) task.parentId = event.parentId;

	for (const existing of Object.values(state.tasks)) {
		if (event.activate && existing.status === "active")
			existing.status = "pending";
	}
	state.tasks[task.id] = task;
	if (event.activate) state.activeTaskId = task.id;
	return state;
}

function updateTask(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.updated" }>,
): TaskState {
	const task = requireTask(state, event.taskId);
	const previousStatus = task.status;
	if (event.status) validateStatusTransition(task, event.status, event);
	if (event.stepId || event.stepStatus) updatePlanStep(task, event);
	if (event.progress !== undefined)
		task.progress = clampProgress(event.progress);
	if (event.currentStep !== undefined) {
		validateCurrentStepUpdate(task, event.currentStep);
		task.currentStep = event.currentStep;
	}
	if (event.nextAction !== undefined) task.nextAction = event.nextAction;
	if (event.blocker) {
		task.blockers.push({
			id: `${task.id}-B${task.blockers.length + 1}`,
			taskId: task.id,
			reason: event.blocker.reason,
			blockedBy: event.blocker.blockedBy,
			neededToUnblock: event.blocker.neededToUnblock,
			since: event.createdAt,
		});
	}
	if (event.status)
		applyStatusChange(state, task, event.status, event.createdAt);
	if (previousStatus === "blocked" && event.status === "active") {
		for (const blocker of task.blockers) {
			if (!blocker.resolvedAt) blocker.resolvedAt = event.createdAt;
		}
	}
	task.updatedAt = event.createdAt;
	return state;
}

function addEvidence(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.evidence_added" }>,
): TaskState {
	const task = requireTask(state, event.taskId);
	const evidence: TaskEvidence = {
		...event.evidence,
		taskId: task.id,
		summary: event.evidence.summary.trim(),
		references: event.evidence.references ?? [],
		createdAt: event.createdAt,
	};
	validateEvidence(evidence);
	const duplicate = findDuplicateEvidence(task, evidence);
	if (duplicate) {
		linkEvidenceToCriteria(task, duplicate, event.criterionIds ?? []);
		task.updatedAt = event.createdAt;
		return state;
	}
	task.evidence.push(evidence);
	linkEvidenceToCriteria(task, evidence, event.criterionIds ?? []);
	task.updatedAt = event.createdAt;
	return state;
}

function linkEvidenceToCriteria(
	task: Task,
	evidence: TaskEvidence,
	criterionIds: string[],
): void {
	for (const criterionId of criterionIds) {
		const criterion = requireCriterion(task, criterionId);
		if (evidence.passed === true) {
			criterion.status = "satisfied";
			criterion.evidenceIds = unique([...criterion.evidenceIds, evidence.id]);
		} else if (evidence.passed === false) {
			criterion.status = "failed";
			criterion.evidenceIds = unique([...criterion.evidenceIds, evidence.id]);
		}
	}
}

function recordDecision(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.decision_recorded" }>,
): TaskState {
	const task = requireTask(state, event.taskId);
	if (!event.decision.question.trim())
		throw new TaskTransitionError("Decision question is required");
	if (!event.decision.decision.trim())
		throw new TaskTransitionError("Decision text is required");
	task.decisions.push({
		...event.decision,
		taskId: task.id,
		createdAt: event.createdAt,
	});
	task.updatedAt = event.createdAt;
	return state;
}

function completeTask(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.completed" }>,
): TaskState {
	const task = requireTask(state, event.taskId);
	validateStatusTransition(task, "done", event);
	for (const result of event.criterionResults ?? []) {
		const criterion = requireCriterion(task, result.criterionId);
		if (
			result.status === "satisfied" &&
			(!result.evidenceIds || result.evidenceIds.length === 0)
		) {
			throw new TaskTransitionError(
				`Criterion ${criterion.id} cannot be satisfied without evidence`,
			);
		}
		if (result.status === "skipped" && !result.note?.trim()) {
			throw new TaskTransitionError(
				`Criterion ${criterion.id} skipped status requires a note`,
			);
		}
		criterion.status = result.status;
		criterion.evidenceIds = unique([
			...criterion.evidenceIds,
			...(result.evidenceIds ?? []),
		]);
		if (result.note !== undefined) criterion.note = result.note;
	}
	const completionEvidenceIds = unique(event.evidenceIds);
	validateCompletion(task, completionEvidenceIds, event.forceWithReason);
	applyStatusChange(state, task, "done", event.createdAt);
	task.progress = 100;
	task.completedAt = event.createdAt;
	task.completionSummary = event.summary;
	task.confidence = event.forceWithReason
		? Math.min(task.confidence ?? 60, 79)
		: Math.max(task.confidence ?? 0, 90);
	if (event.forceWithReason) {
		task.warnings.push(`Forced completion: ${event.forceWithReason}`);
	}
	task.updatedAt = event.createdAt;
	return state;
}

function cancelTask(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.cancelled" }>,
): TaskState {
	if (!event.reason.trim())
		throw new TaskTransitionError("Cancellation reason is required");
	const task = requireTask(state, event.taskId);
	validateStatusTransition(task, "cancelled", event);
	applyStatusChange(state, task, "cancelled", event.createdAt);
	task.cancelledAt = event.createdAt;
	task.updatedAt = event.createdAt;
	return state;
}

function applySnapshot(
	event: Extract<TaskEvent, { type: "task.snapshot" }>,
): TaskState {
	const state = cloneState({ ...event.state, events: [] });
	state.lastUpdatedAt = event.createdAt;
	return state;
}

function createPlanSteps(
	taskId: string,
	steps: string[],
	createdAt: string,
	activate: boolean,
): TaskStep[] {
	return steps.map((step, index): TaskStep => {
		const text = step.trim();
		if (!text) throw new TaskTransitionError("Plan steps cannot be blank");
		return {
			id: `${taskId}-S${index + 1}`,
			taskId,
			text,
			status: index === 0 && activate ? "active" : "pending",
			evidenceIds: [],
			...(index === 0 && activate ? { startedAt: createdAt } : {}),
		};
	});
}

function updatePlanStep(
	task: Task,
	event: Extract<TaskEvent, { type: "task.updated" }>,
): void {
	if (!event.stepId || !event.stepStatus) {
		throw new TaskTransitionError(
			"Updating a plan step requires stepId and stepStatus",
		);
	}
	const currentStep = getCurrentOpenStep(task);
	if (!currentStep) {
		throw new TaskTransitionError(`Task ${task.id} has no open plan steps`);
	}
	if (event.stepId !== currentStep.id) {
		throw new TaskTransitionError(
			`Plan step ${event.stepId} cannot be updated before ${currentStep.id}`,
		);
	}
	if (event.stepStatus === "pending") {
		throw new TaskTransitionError("Plan steps cannot move back to pending");
	}
	if (
		event.stepStatus === "skipped" &&
		!event.reason?.trim() &&
		!event.note?.trim()
	) {
		throw new TaskTransitionError("Skipping a plan step requires a reason");
	}
	for (const evidenceId of event.stepEvidenceIds ?? []) {
		requireEvidence(task, evidenceId);
	}
	currentStep.status = event.stepStatus;
	currentStep.evidenceIds = unique([
		...currentStep.evidenceIds,
		...(event.stepEvidenceIds ?? []),
	]);
	if (event.note !== undefined) currentStep.note = event.note;
	if (event.stepStatus === "active") {
		currentStep.startedAt ??= event.createdAt;
		task.currentStep = currentStep.text;
		task.nextAction = currentStep.text;
		return;
	}
	currentStep.completedAt = event.createdAt;
	const nextStep = getCurrentOpenStep(task);
	if (nextStep) {
		nextStep.status = "active";
		nextStep.startedAt ??= event.createdAt;
		task.currentStep = nextStep.text;
		task.nextAction = nextStep.text;
		return;
	}
	delete task.currentStep;
	delete task.nextAction;
}

function validateCurrentStepUpdate(task: Task, currentStep: string): void {
	const openStep = getCurrentOpenStep(task);
	if (openStep && currentStep.trim() !== openStep.text) {
		throw new TaskTransitionError(
			`Current step must remain ${openStep.id}: ${openStep.text}`,
		);
	}
}

function getActiveStep(task: Task): TaskStep | undefined {
	return task.planSteps.find((step) => step.status === "active");
}

function getCurrentOpenStep(task: Task): TaskStep | undefined {
	return task.planSteps.find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
}

function validateCompletion(
	task: Task,
	evidenceIds: string[],
	forceReason?: string,
): void {
	const unresolvedBlockers = task.blockers.filter(
		(blocker) => !blocker.resolvedAt,
	);
	if (unresolvedBlockers.length > 0 && !forceReason) {
		throw new TaskTransitionError(`Task ${task.id} has unresolved blockers`);
	}
	const incompleteStep = task.planSteps.find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
	if (incompleteStep && !forceReason) {
		throw new TaskTransitionError(
			`Plan step ${incompleteStep.id} is not complete`,
		);
	}
	if (task.evidence.length === 0 && !forceReason)
		throw new TaskTransitionError(`Task ${task.id} has no evidence`);
	const evidence =
		evidenceIds.length > 0
			? evidenceIds.map((id) => requireEvidence(task, id))
			: task.evidence;
	if (!forceReason && evidence.length === 0)
		throw new TaskTransitionError("Completion evidence IDs are required");
	if (!forceReason && evidence.every((item) => item.level === "not_verified")) {
		throw new TaskTransitionError(
			"Completion requires verification stronger than not_verified",
		);
	}
	for (const criterion of task.acceptanceCriteria) {
		if (
			criterion.status !== "satisfied" &&
			criterion.status !== "skipped" &&
			!forceReason
		) {
			throw new TaskTransitionError(
				`Criterion ${criterion.id} is not satisfied`,
			);
		}
		if (
			criterion.status === "satisfied" &&
			criterion.evidenceIds.length === 0
		) {
			throw new TaskTransitionError(
				`Criterion ${criterion.id} is satisfied without evidence`,
			);
		}
		for (const evidenceId of criterion.evidenceIds) {
			const criterionEvidence = requireEvidence(task, evidenceId);
			if (criterionEvidence.passed === false && !forceReason) {
				throw new TaskTransitionError(
					`Criterion ${criterion.id} has failing evidence ${evidenceId}`,
				);
			}
		}
	}
}

function validateStatusTransition(
	task: Task,
	nextStatus: TaskStatus,
	event: Extract<
		TaskEvent,
		{ type: "task.updated" | "task.completed" | "task.cancelled" }
	>,
): void {
	const current = task.status;
	if (current === nextStatus) return;
	if (TERMINAL_STATUSES.includes(current)) {
		throw new TaskTransitionError(
			`Task ${task.id} is ${current} and cannot transition to ${nextStatus}`,
		);
	}
	const allowed: Record<TaskStatus, TaskStatus[]> = {
		pending: ["active", "cancelled"],
		active: ["blocked", "review", "done", "cancelled"],
		blocked: ["active", "cancelled"],
		review: ["active", "done", "blocked", "cancelled"],
		done: [],
		cancelled: [],
	};
	if (!allowed[current].includes(nextStatus)) {
		throw new TaskTransitionError(
			`Invalid transition for ${task.id}: ${current} -> ${nextStatus}`,
		);
	}
	if (nextStatus === "done" && event.type === "task.updated") {
		throw new TaskTransitionError("Use task_complete to mark a task done");
	}
	if (
		nextStatus === "cancelled" &&
		event.type === "task.updated" &&
		!event.reason?.trim()
	) {
		throw new TaskTransitionError("Cancelling a task requires a reason");
	}
	if (
		nextStatus === "blocked" &&
		event.type === "task.updated" &&
		!event.blocker
	) {
		throw new TaskTransitionError("Blocking a task requires blocker details");
	}
	if (
		nextStatus === "active" &&
		current === "blocked" &&
		event.type === "task.updated" &&
		!event.reason?.trim()
	) {
		throw new TaskTransitionError("Unblocking a task requires a reason");
	}
	if (
		nextStatus === "review" &&
		task.progress === 0 &&
		task.evidence.length === 0 &&
		event.type === "task.updated"
	) {
		throw new TaskTransitionError(
			"Moving to review requires progress or evidence",
		);
	}
}

function applyStatusChange(
	state: TaskState,
	task: Task,
	status: TaskStatus,
	timestamp: string,
): void {
	if (status === "active") {
		for (const existing of Object.values(state.tasks)) {
			if (existing.id !== task.id && existing.status === "active")
				existing.status = "pending";
		}
		state.activeTaskId = task.id;
	} else if (state.activeTaskId === task.id) {
		delete state.activeTaskId;
	}
	task.status = status;
	if (status === "done") task.progress = 100;
	task.updatedAt = timestamp;
}

function validateEvidence(evidence: TaskEvidence): void {
	if (!evidence.summary.trim())
		throw new TaskTransitionError("Evidence summary is required");
	if (
		evidence.passed === true &&
		evidence.type !== "note" &&
		evidence.level === "not_verified"
	) {
		throw new TaskTransitionError(
			"Passing evidence requires a verification level stronger than not_verified",
		);
	}
}

function findDuplicateEvidence(
	task: Task,
	evidence: TaskEvidence,
): TaskEvidence | undefined {
	return task.evidence.find(
		(existing) =>
			existing.type === evidence.type &&
			existing.level === evidence.level &&
			existing.passed === evidence.passed &&
			existing.summary.trim() === evidence.summary.trim() &&
			normalizedReferences(existing.references) ===
				normalizedReferences(evidence.references),
	);
}

function normalizedReferences(references: string[]): string {
	return unique(references.map((reference) => reference.trim()).filter(Boolean))
		.sort()
		.join("\n");
}

function validateEventEnvelope(event: TaskEvent): void {
	if (event.version !== 1)
		throw new TaskTransitionError(
			`Unsupported task event version: ${event.version}`,
		);
	if (!event.id.trim()) throw new TaskTransitionError("Event ID is required");
	if (!event.taskId.trim())
		throw new TaskTransitionError("Event taskId is required");
	if (!event.createdAt.trim())
		throw new TaskTransitionError("Event createdAt is required");
}

function requireTask(state: TaskState, taskId: string): Task {
	const task = state.tasks[taskId];
	if (!task) throw new TaskTransitionError(`Task ${taskId} not found`);
	task.planSteps ??= [];
	return task;
}

function requireCriterion(
	task: Task,
	criterionId: string,
): AcceptanceCriterion {
	const criterion = task.acceptanceCriteria.find(
		(item) => item.id === criterionId,
	);
	if (!criterion)
		throw new TaskTransitionError(`Criterion ${criterionId} not found`);
	return criterion;
}

function requireEvidence(task: Task, evidenceId: string): TaskEvidence {
	const evidence = task.evidence.find((item) => item.id === evidenceId);
	if (!evidence)
		throw new TaskTransitionError(`Evidence ${evidenceId} not found`);
	return evidence;
}

function clampProgress(progress: number): number {
	if (!Number.isFinite(progress))
		throw new TaskTransitionError("Progress must be a finite number");
	return Math.max(0, Math.min(100, Math.round(progress)));
}

function cloneState(state: TaskState): TaskState {
	return structuredClone(state);
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function unreachable(value: never): never {
	throw new TaskTransitionError(`Unsupported event: ${JSON.stringify(value)}`);
}
