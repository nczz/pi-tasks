import {
	type AcceptanceCriterion,
	createEmptyState,
	type EvidenceQuality,
	type PlanQuality,
	type Task,
	type TaskEvent,
	type TaskEvidence,
	type TaskGranularityCheck,
	type TaskState,
	type TaskStatus,
	type TaskStep,
	type TaskStepInput,
} from "./model.ts";

const TERMINAL_STATUSES: TaskStatus[] = ["done", "cancelled"];
const MAX_DECOMPOSITION_DEPTH = 4;
const MIN_PLAN_QUALITY_SCORE = 80;
const VAGUE_PLAN_PATTERNS = [
	/\b(do|handle|fix|improve|update|implement|complete|work on|deal with)\b/i,
	/完成(全部|所有|整個)?/,
	/處理(一下|全部|所有)?/,
	/修好/,
	/優化/,
	/弄好/,
	/整理/,
];
const VAGUE_EVIDENCE_PATTERNS = [
	/\b(done|looks good|seems ok|probably|should work)\b/i,
	/完成了/,
	/看起來/,
	/應該/,
	/似乎/,
];

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
		case "task.steps_decomposed":
			return decomposeStep(state, event);
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
		event.planSteps,
		event.initialSteps,
		acceptanceCriteria.map((criterion) => criterion.id),
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

function decomposeStep(
	state: TaskState,
	event: Extract<TaskEvent, { type: "task.steps_decomposed" }>,
): TaskState {
	const task = requireTask(state, event.taskId);
	if (!event.reason.trim())
		throw new TaskTransitionError("Decomposition reason is required");
	if (event.childSteps.length < 2) {
		throw new TaskTransitionError(
			"Decomposition requires at least two child steps",
		);
	}
	const parentIndex = task.planSteps.findIndex(
		(step) => step.id === event.parentStepId,
	);
	if (parentIndex === -1) {
		throw new TaskTransitionError(`Plan step ${event.parentStepId} not found`);
	}
	const parent = task.planSteps[parentIndex];
	if (!parent) {
		throw new TaskTransitionError(`Plan step ${event.parentStepId} not found`);
	}
	if (parent.status === "done" || parent.status === "skipped") {
		throw new TaskTransitionError(
			`Plan step ${parent.id} is already closed and cannot be decomposed`,
		);
	}
	if (parent.depth >= MAX_DECOMPOSITION_DEPTH) {
		throw new TaskTransitionError(
			`Plan step ${parent.id} reached maximum decomposition depth ${MAX_DECOMPOSITION_DEPTH}`,
		);
	}
	const children = createPlanSteps(
		task.id,
		event.childSteps,
		undefined,
		task.acceptanceCriteria.map((criterion) => criterion.id),
		event.createdAt,
		false,
		{
			parentStepId: parent.id,
			parentStatus: parent.status,
			startIndex: 1,
			depth: parent.depth + 1,
			idPrefix: parent.id,
		},
	);
	const firstChild = children[0];
	if (!firstChild) {
		throw new TaskTransitionError("Decomposition produced no child steps");
	}
	firstChild.status = parent.status;
	if (parent.startedAt) firstChild.startedAt = parent.startedAt;
	parent.childStepIds = children.map((child) => child.id);
	parent.decompositionStatus = "breaking_down";
	task.planSteps.splice(parentIndex, 1, ...children);
	task.warnings.push(
		`decomposed ${parent.id}: ${event.reason.trim()} -> ${children.map((child) => child.id).join(",")}`,
	);
	const activeStep = getCurrentOpenStep(task);
	if (activeStep) {
		task.currentStep = activeStep.text;
		task.nextAction =
			activeStep.decompositionStatus === "atomic"
				? activeStep.text
				: `Break down ${activeStep.id}`;
	} else {
		delete task.currentStep;
		delete task.nextAction;
	}
	recalculateProgress(task);
	task.updatedAt = event.createdAt;
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
	recordScopeSignal(task, event);
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
	if (event.resolveWarnings) resolveTaskWarnings(task, event.resolveWarnings);
	if (event.status)
		applyStatusChange(state, task, event.status, event.createdAt);
	if (previousStatus === "blocked" && event.status === "active") {
		for (const blocker of task.blockers) {
			if (!blocker.resolvedAt) blocker.resolvedAt = event.createdAt;
		}
	}
	recalculateProgress(task);
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
		quality: normalizeEvidenceQuality(event.evidence.quality, event.evidence),
		createdAt: event.createdAt,
	};
	validateEvidence(evidence);
	const duplicate = findDuplicateEvidence(task, evidence);
	if (duplicate) {
		linkEvidenceToCriteria(task, duplicate, event.criterionIds ?? []);
		linkEvidenceToSteps(task, duplicate, event.stepIds ?? []);
		if (!event.stepIds || event.stepIds.length === 0) {
			linkEvidenceToMatchingSteps(task, duplicate, event.criterionIds ?? []);
		}
		recalculateProgress(task);
		task.updatedAt = event.createdAt;
		return state;
	}
	task.evidence.push(evidence);
	linkEvidenceToCriteria(task, evidence, event.criterionIds ?? []);
	linkEvidenceToSteps(task, evidence, event.stepIds ?? []);
	if (!event.stepIds || event.stepIds.length === 0) {
		linkEvidenceToMatchingSteps(task, evidence, event.criterionIds ?? []);
	}
	recalculateProgress(task);
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

function linkEvidenceToMatchingSteps(
	task: Task,
	evidence: TaskEvidence,
	criterionIds: string[],
): void {
	if (criterionIds.length === 0) return;
	const matchingSteps = task.planSteps.filter((step) =>
		step.criterionIds.some((criterionId) => criterionIds.includes(criterionId)),
	);
	if (matchingSteps.length === 1) {
		const step = matchingSteps[0];
		if (step) step.evidenceIds = unique([...step.evidenceIds, evidence.id]);
	}
}

function linkEvidenceToSteps(
	task: Task,
	evidence: TaskEvidence,
	stepIds: string[],
): void {
	for (const stepId of stepIds) {
		const step = requireStep(task, stepId);
		step.evidenceIds = unique([...step.evidenceIds, evidence.id]);
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
	recalculateProgress(task);
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
	planSteps: TaskStepInput[] | undefined,
	initialSteps: string[] | undefined,
	criterionIds: string[],
	createdAt: string,
	activate: boolean,
	options: {
		parentStepId?: string;
		parentStatus?: TaskStep["status"];
		startIndex?: number;
		depth?: number;
		idPrefix?: string;
	} = {},
): TaskStep[] {
	const steps =
		planSteps ??
		initialSteps?.map(
			(text): TaskStepInput => ({
				text,
				expectedOutput: `Verified output for: ${text}`,
				criterionIds,
				evidenceRequired: true,
				allowedActions: [],
			}),
		) ??
		[];
	if (steps.length === 0) {
		throw new TaskTransitionError("At least one ordered plan step is required");
	}
	return steps.map((step, index): TaskStep => {
		const text = step.text.trim();
		const expectedOutput = step.expectedOutput.trim();
		if (!text) throw new TaskTransitionError("Plan steps cannot be blank");
		if (!expectedOutput) {
			throw new TaskTransitionError("Plan step expectedOutput is required");
		}
		const linkedCriteria = unique(step.criterionIds ?? criterionIds);
		for (const criterionId of linkedCriteria) {
			if (!criterionIds.includes(criterionId)) {
				throw new TaskTransitionError(
					`Plan step references unknown criterion ${criterionId}`,
				);
			}
		}
		const granularityCheck = normalizeGranularityCheck(step);
		const decompositionStatus =
			step.decompositionStatus ??
			(granularityCheck.isAtomic ? "atomic" : "needs_breakdown");
		const planQuality = assessPlanQuality({
			text,
			expectedOutput,
			criterionIds: linkedCriteria,
			evidenceRequired: step.evidenceRequired ?? true,
			allowedActions: step.allowedActions ?? [],
			decompositionStatus,
			granularityCheck,
		});
		validateGranularityContract(
			{
				...step,
				text,
				expectedOutput,
				criterionIds: linkedCriteria,
				decompositionStatus,
				granularityCheck,
				planQuality,
				allowedActions: step.allowedActions ?? [],
				evidenceRequired: step.evidenceRequired ?? true,
			},
			index,
		);
		const status =
			index === 0 && (activate || options.parentStatus)
				? (options.parentStatus ?? "active")
				: "pending";
		const idPrefix = options.idPrefix ?? taskId;
		const stepNumber = (options.startIndex ?? 1) + index;
		return {
			id: options.idPrefix
				? `${idPrefix}.${stepNumber}`
				: `${taskId}-S${stepNumber}`,
			taskId,
			text,
			expectedOutput,
			status,
			decompositionStatus,
			granularityCheck,
			...(options.parentStepId ? { parentStepId: options.parentStepId } : {}),
			childStepIds: [],
			depth: options.depth ?? 0,
			evidenceIds: [],
			criterionIds: linkedCriteria,
			evidenceRequired: step.evidenceRequired ?? true,
			allowedActions: step.allowedActions ?? [],
			planQuality,
			...(status === "active" ? { startedAt: createdAt } : {}),
		};
	});
}

function assessPlanQuality(step: {
	text: string;
	expectedOutput: string;
	criterionIds: string[];
	evidenceRequired: boolean;
	allowedActions: string[];
	decompositionStatus: TaskStep["decompositionStatus"];
	granularityCheck: TaskGranularityCheck;
}): PlanQuality {
	const issues: string[] = [];
	if (step.text.length < 8) issues.push("step text is too short");
	if (step.expectedOutput.length < 12)
		issues.push("expected output is too short");
	if (containsVaguePattern(step.text))
		issues.push("step text uses vague or broad wording");
	if (containsVaguePattern(step.expectedOutput))
		issues.push("expected output uses vague or broad wording");
	if (step.allowedActions.length === 0)
		issues.push("allowedActions are required");
	if (step.allowedActions.length > 3)
		issues.push("allowedActions are too broad; use at most three");
	if (step.allowedActions.some((action) => containsVaguePattern(action))) {
		issues.push("allowedActions contain vague actions");
	}
	if (step.criterionIds.length === 0)
		issues.push("at least one criterion link is required");
	if (!step.evidenceRequired) issues.push("evidenceRequired must be true");
	if (
		step.decompositionStatus === "atomic" &&
		(!step.granularityCheck.isAtomic ||
			!step.granularityCheck.canBeDoneInOneAgentAction ||
			!step.granularityCheck.hasSingleObservableOutput ||
			!step.granularityCheck.hasSingleVerificationMethod ||
			!step.granularityCheck.hasNoHiddenSubtasks)
	) {
		issues.push("atomic step has failing granularity flags");
	}
	return {
		score: Math.max(0, 100 - issues.length * 12),
		issues,
	};
}

function containsVaguePattern(value: string): boolean {
	return VAGUE_PLAN_PATTERNS.some((pattern) => pattern.test(value.trim()));
}

function normalizeGranularityCheck(step: TaskStepInput): TaskGranularityCheck {
	if (step.granularityCheck) {
		return {
			isAtomic: step.granularityCheck.isAtomic,
			reason: step.granularityCheck.reason.trim(),
			canBeDoneInOneAgentAction:
				step.granularityCheck.canBeDoneInOneAgentAction,
			hasSingleObservableOutput:
				step.granularityCheck.hasSingleObservableOutput,
			hasSingleVerificationMethod:
				step.granularityCheck.hasSingleVerificationMethod,
			hasNoHiddenSubtasks: step.granularityCheck.hasNoHiddenSubtasks,
		};
	}
	return {
		isAtomic: false,
		reason: "Granularity has not been checked yet",
		canBeDoneInOneAgentAction: false,
		hasSingleObservableOutput: false,
		hasSingleVerificationMethod: false,
		hasNoHiddenSubtasks: false,
	};
}

function validateGranularityContract(
	step: TaskStepInput & {
		decompositionStatus: TaskStep["decompositionStatus"];
		granularityCheck: TaskGranularityCheck;
		planQuality: PlanQuality;
		criterionIds: string[];
		allowedActions: string[];
		evidenceRequired: boolean;
	},
	index: number,
): void {
	if (!step.granularityCheck.reason.trim()) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} granularityCheck.reason is required`,
		);
	}
	if (step.planQuality.score < MIN_PLAN_QUALITY_SCORE) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} failed quality gate: ${step.planQuality.issues.join("; ")}`,
		);
	}
	if (step.decompositionStatus === "atomic") {
		const check = step.granularityCheck;
		if (
			!check.isAtomic ||
			!check.canBeDoneInOneAgentAction ||
			!check.hasSingleObservableOutput ||
			!check.hasSingleVerificationMethod ||
			!check.hasNoHiddenSubtasks
		) {
			throw new TaskTransitionError(
				`Atomic plan step ${index + 1} failed granularity check`,
			);
		}
		if (step.criterionIds.length === 0) {
			throw new TaskTransitionError(
				`Atomic plan step ${index + 1} must link at least one criterion`,
			);
		}
		if (step.allowedActions.length === 0) {
			throw new TaskTransitionError(
				`Atomic plan step ${index + 1} must declare allowedActions`,
			);
		}
		if (!step.evidenceRequired) {
			throw new TaskTransitionError(
				`Atomic plan step ${index + 1} must require evidence`,
			);
		}
	}
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
		event.stepStatus === "done" &&
		currentStep.decompositionStatus !== "atomic"
	) {
		throw new TaskTransitionError(
			`Plan step ${currentStep.id} is ${currentStep.decompositionStatus}; use task_decompose until it is atomic before done`,
		);
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
	const nextEvidenceIds = unique([
		...currentStep.evidenceIds,
		...(event.stepEvidenceIds ?? []),
	]);
	if (
		event.stepStatus === "done" &&
		currentStep.evidenceRequired &&
		nextEvidenceIds.length === 0
	) {
		throw new TaskTransitionError(
			`Plan step ${currentStep.id} requires evidence before done`,
		);
	}
	currentStep.status = event.stepStatus;
	currentStep.evidenceIds = nextEvidenceIds;
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

function recordScopeSignal(
	task: Task,
	event: Extract<TaskEvent, { type: "task.updated" }>,
): void {
	if (!event.activity && !event.scope) return;
	if (!event.activity?.trim()) {
		throw new TaskTransitionError("Scope updates require an activity");
	}
	const scope = event.scope ?? "within_step";
	if (
		(scope === "scope_change" || scope === "off_plan") &&
		!event.scopeReason?.trim()
	) {
		throw new TaskTransitionError(
			"Scope change or off-plan activity requires scopeReason",
		);
	}
	if (scope === "scope_change" || scope === "off_plan") {
		task.warnings.push(
			`${scope}: ${event.activity.trim()} (${event.scopeReason?.trim()})`,
		);
	}
}

function resolveTaskWarnings(task: Task, warnings: string[]): void {
	for (const warning of warnings) {
		const trimmed = warning.trim();
		if (!trimmed) continue;
		const before = task.warnings.length;
		task.warnings = task.warnings.filter(
			(existing) => existing !== trimmed && !existing.startsWith(trimmed),
		);
		if (task.warnings.length === before) {
			throw new TaskTransitionError(`Warning not found: ${trimmed}`);
		}
	}
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
	const unresolvedDriftWarning = task.warnings.find((warning) =>
		/^(off_plan|scope_change):/.test(warning),
	);
	if (unresolvedDriftWarning && !forceReason) {
		throw new TaskTransitionError(
			`Task ${task.id} has unresolved scope drift warning: ${unresolvedDriftWarning}`,
		);
	}
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
	for (const step of task.planSteps) {
		if (
			step.evidenceRequired &&
			step.status === "done" &&
			step.evidenceIds.length === 0 &&
			!forceReason
		) {
			throw new TaskTransitionError(
				`Plan step ${step.id} is done without step evidence`,
			);
		}
		for (const evidenceId of step.evidenceIds) {
			const stepEvidence = requireEvidence(task, evidenceId);
			validateEvidenceQualityScore(stepEvidence);
			if (stepEvidence.passed === false && !forceReason) {
				throw new TaskTransitionError(
					`Plan step ${step.id} has failing evidence ${evidenceId}`,
				);
			}
		}
	}
	if (!forceReason) {
		for (const evidenceItem of evidence)
			validateEvidenceQualityScore(evidenceItem);
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

function recalculateProgress(task: Task): void {
	if (task.status === "done") {
		task.progress = 100;
		return;
	}
	if (task.status === "cancelled") return;
	const derived = deriveProgress(task);
	if (derived > task.progress) task.progress = derived;
}

function deriveProgress(task: Task): number {
	const scores: number[] = [];
	const planSteps = task.planSteps ?? [];
	if (planSteps.length > 0) {
		const closedSteps = planSteps.filter(
			(step) => step.status === "done" || step.status === "skipped",
		).length;
		scores.push(closedSteps / planSteps.length);
	}
	if (task.acceptanceCriteria.length > 0) {
		const closedCriteria = task.acceptanceCriteria.filter(
			(criterion) =>
				criterion.status === "satisfied" || criterion.status === "skipped",
		).length;
		scores.push(closedCriteria / task.acceptanceCriteria.length);
	}
	if (task.evidence.length > 0) scores.push(1);
	if (scores.length === 0) return task.status === "active" ? 1 : 0;
	const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
	return Math.min(
		99,
		Math.max(task.status === "active" ? 1 : 0, Math.round(average * 99)),
	);
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
	validateEvidenceQualityScore(evidence);
	if (evidence.passed === true && containsVagueEvidence(evidence.summary)) {
		throw new TaskTransitionError(
			"Evidence summary is too vague for passing evidence",
		);
	}
	if (evidence.type !== "note" && evidence.references.length === 0) {
		throw new TaskTransitionError(
			"Evidence requires at least one reference for traceability",
		);
	}
}

function normalizeEvidenceQuality(
	quality: EvidenceQuality | undefined,
	evidence: Omit<TaskEvidence, "taskId" | "createdAt" | "quality">,
): EvidenceQuality {
	const artifactRefs = quality?.artifactRefs ?? evidence.references ?? [];
	return {
		source: quality?.source?.trim() || evidence.type,
		reproducible: quality?.reproducible ?? artifactRefs.length > 0,
		verifier: quality?.verifier ?? "agent",
		...(quality?.command ? { command: quality.command.trim() } : {}),
		artifactRefs,
		...(quality?.observedOutput
			? { observedOutput: quality.observedOutput.trim() }
			: {}),
	};
}

function validateEvidenceQualityScore(evidence: TaskEvidence): void {
	const issues = getEvidenceQualityIssues(evidence);
	if (issues.length > 0) {
		throw new TaskTransitionError(
			`Evidence ${evidence.id} failed quality gate: ${issues.join("; ")}`,
		);
	}
}

function getEvidenceQualityIssues(evidence: TaskEvidence): string[] {
	const issues: string[] = [];
	if (!evidence.quality.source.trim()) issues.push("source is required");
	if (!evidence.quality.reproducible)
		issues.push("evidence must be reproducible");
	if (evidence.quality.artifactRefs.length === 0)
		issues.push("artifactRefs are required");
	if (
		(evidence.type === "command" ||
			evidence.type === "test" ||
			evidence.type === "dogfood") &&
		!evidence.quality.observedOutput?.trim()
	) {
		issues.push("observedOutput is required for command/test/dogfood evidence");
	}
	if (evidence.type === "command" && !evidence.quality.command?.trim()) {
		issues.push("command is required for command evidence");
	}
	return issues;
}

function containsVagueEvidence(value: string): boolean {
	return VAGUE_EVIDENCE_PATTERNS.some((pattern) => pattern.test(value.trim()));
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

function requireStep(task: Task, stepId: string): TaskStep {
	const step = task.planSteps.find((item) => item.id === stepId);
	if (!step) throw new TaskTransitionError(`Plan step ${stepId} not found`);
	return step;
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
