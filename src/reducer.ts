import {
	type AcceptanceCriterion,
	createEmptyState,
	type EvidenceQuality,
	type EvidenceSemanticAssessment,
	isAtMaximumDecompositionDepth,
	MAX_DECOMPOSITION_DEPTH,
	MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH,
	MAX_EVIDENCE_REFERENCE_LENGTH,
	MAX_EVIDENCE_SUMMARY_LENGTH,
	type PlanQuality,
	type PlanSemanticAssessment,
	SEMANTIC_ASSESSMENT_VERSION,
	type StepSemanticAssessment,
	type Task,
	type TaskEvent,
	type TaskEvidence,
	type TaskGranularityCheck,
	type TaskState,
	type TaskStatus,
	type TaskStep,
	type TaskStepInput,
} from "./model.ts";
import {
	hashEvidenceAssessmentInput,
	hashPlanAssessmentInput,
	hashStepSemanticInput,
	MIN_SEMANTIC_CONFIDENCE,
	type PlanAssessmentInput,
} from "./semantic-assessment.ts";

const TERMINAL_STATUSES: TaskStatus[] = ["done", "cancelled"];
const SEMANTIC_ASSESSMENT_STRATEGIES = new Set([
	"pi_classifier",
	"pi_chat",
	"omp_ephemeral",
]);
const EVIDENCE_SEMANTIC_ISSUES = new Set([
	"missing_observation",
	"hedged_claim",
	"result_not_tied_to_claim",
	"contradictory_result",
	"uncertain",
]);
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export type TaskTransitionErrorCode =
	| "scope_activity_required"
	| "scope_reason_required";

export class TaskTransitionError extends Error {
	readonly code: TaskTransitionErrorCode | undefined;

	constructor(message: string, code?: TaskTransitionErrorCode) {
		super(message);
		this.name = "TaskTransitionError";
		this.code = code;
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
	const criterionIds = acceptanceCriteria.map((criterion) => criterion.id);
	const stepInputs = resolvePlanStepInputs(
		event.planSteps,
		event.initialSteps,
		criterionIds,
	);
	const assessmentInput: PlanAssessmentInput = {
		title: event.title,
		objective: event.objective,
		acceptanceCriteria: event.acceptanceCriteria,
		steps: stepInputs,
	};
	validatePlanSemanticAssessment(
		event.semanticAssessment,
		assessmentInput,
		event.version === 2,
	);
	const planSteps = createPlanSteps(
		event.taskId,
		stepInputs,
		criterionIds,
		event.createdAt,
		event.activate ?? true,
		event.semanticAssessment,
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
	const assessmentInput: PlanAssessmentInput = {
		title: task.title,
		objective: task.objective,
		acceptanceCriteria: task.acceptanceCriteria.map(
			(criterion) => criterion.text,
		),
		steps: event.childSteps,
	};
	validatePlanSemanticAssessment(
		event.semanticAssessment,
		assessmentInput,
		event.version === 2,
	);
	const children = createPlanSteps(
		task.id,
		event.childSteps,
		task.acceptanceCriteria.map((criterion) => criterion.id),
		event.createdAt,
		false,
		event.semanticAssessment,
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
				: isAtMaximumDecompositionDepth(activeStep)
					? `Block ${activeStep.id}; maximum decomposition depth reached`
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
		...(event.evidence.supersedes
			? { supersedes: event.evidence.supersedes }
			: {}),
		...(event.semanticAssessment
			? { semanticAssessment: event.semanticAssessment }
			: {}),
		createdAt: event.createdAt,
	};
	validateEvidence(evidence, event.version === 2);
	const duplicate = findDuplicateEvidence(task, evidence);
	if (duplicate) {
		linkEvidenceToCriteria(task, duplicate, event.criterionIds ?? []);
		linkEvidenceToSteps(
			task,
			duplicate,
			event.stepIds ?? [],
			event.overrideReason,
		);
		if (!event.stepIds || event.stepIds.length === 0) {
			linkEvidenceToMatchingSteps(
				task,
				duplicate,
				event.criterionIds ?? [],
				event.overrideReason,
			);
		}
		recalculateProgress(task);
		task.updatedAt = event.createdAt;
		return state;
	}
	task.evidence.push(evidence);
	linkEvidenceToCriteria(task, evidence, event.criterionIds ?? []);
	linkEvidenceToSteps(
		task,
		evidence,
		event.stepIds ?? [],
		event.overrideReason,
	);
	if (!event.stepIds || event.stepIds.length === 0) {
		linkEvidenceToMatchingSteps(
			task,
			evidence,
			event.criterionIds ?? [],
			event.overrideReason,
		);
	}
	validateEvidenceSupersedes(task, evidence);
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
	overrideReason?: string,
): void {
	if (criterionIds.length === 0) return;
	const matchingSteps = task.planSteps.filter((step) =>
		step.criterionIds.some((criterionId) => criterionIds.includes(criterionId)),
	);
	if (matchingSteps.length === 1) {
		const step = matchingSteps[0];
		if (step) {
			validateEvidenceStepLock(task, [step.id], overrideReason);
			step.evidenceIds = unique([...step.evidenceIds, evidence.id]);
		}
	}
}

function linkEvidenceToSteps(
	task: Task,
	evidence: TaskEvidence,
	stepIds: string[],
	overrideReason?: string,
): void {
	validateEvidenceStepLock(task, stepIds, overrideReason);
	for (const stepId of stepIds) {
		const step = requireStep(task, stepId);
		step.evidenceIds = unique([...step.evidenceIds, evidence.id]);
	}
}

function validateEvidenceStepLock(
	task: Task,
	stepIds: string[],
	overrideReason?: string,
): void {
	if (stepIds.length === 0) return;
	const currentStep = getCurrentOpenStep(task);
	if (!currentStep) return;
	const outsideCurrentStep = stepIds.filter(
		(stepId) => stepId !== currentStep.id,
	);
	if (outsideCurrentStep.length > 0 && !overrideReason?.trim()) {
		throw new TaskTransitionError(
			`Evidence step_ids must target current step ${currentStep.id}; overrideReason is required for ${outsideCurrentStep.join(",")}`,
		);
	}
}
function validateEvidenceSupersedes(task: Task, evidence: TaskEvidence): void {
	const supersededIds = evidence.supersedes ?? [];
	if (supersededIds.length === 0) return;
	if (evidence.passed !== true) {
		throw new TaskTransitionError(
			`Evidence ${evidence.id} must pass to supersede failed evidence`,
		);
	}
	for (const supersededId of unique(supersededIds)) {
		const superseded = requireEvidence(task, supersededId);
		if (superseded.passed !== false) {
			throw new TaskTransitionError(
				`Evidence ${evidence.id} can only supersede failed evidence ${supersededId}`,
			);
		}
		if (Date.parse(evidence.createdAt) <= Date.parse(superseded.createdAt)) {
			throw new TaskTransitionError(
				`Evidence ${evidence.id} must be later than superseded evidence ${supersededId}`,
			);
		}
		for (const criterion of task.acceptanceCriteria) {
			if (
				criterion.evidenceIds.includes(supersededId) &&
				!criterion.evidenceIds.includes(evidence.id)
			) {
				throw new TaskTransitionError(
					`Evidence ${evidence.id} must link criterion ${criterion.id} to supersede evidence ${supersededId}`,
				);
			}
		}
		for (const step of task.planSteps) {
			if (
				step.evidenceIds.includes(supersededId) &&
				!step.evidenceIds.includes(evidence.id)
			) {
				throw new TaskTransitionError(
					`Evidence ${evidence.id} must link step ${step.id} to supersede evidence ${supersededId}`,
				);
			}
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

interface CreatePlanStepsOptions {
	parentStepId?: string;
	parentStatus?: TaskStep["status"];
	startIndex?: number;
	depth?: number;
	idPrefix?: string;
}

function resolvePlanStepInputs(
	planSteps: TaskStepInput[] | undefined,
	initialSteps: string[] | undefined,
	criterionIds: string[],
): TaskStepInput[] {
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
	return steps;
}

function validatePlanSemanticAssessment(
	assessment: PlanSemanticAssessment | undefined,
	input: PlanAssessmentInput,
	required: boolean,
): void {
	if (
		!assessment ||
		typeof assessment !== "object" ||
		Array.isArray(assessment)
	) {
		if (required) {
			throw new TaskTransitionError(
				"Version 2 plan mutations require a native semantic assessment",
			);
		}
		return;
	}
	validateSemanticProvenance(assessment.provenance, "Semantic assessment");
	if (!Array.isArray(assessment.steps)) {
		throw new TaskTransitionError("Semantic assessment steps are invalid");
	}
	const expectedBatchHash = hashPlanAssessmentInput(input);
	if (assessment.provenance.inputHash !== expectedBatchHash) {
		throw new TaskTransitionError(
			"Semantic assessment input hash does not match the plan mutation",
		);
	}
	if (assessment.steps.length !== input.steps.length) {
		throw new TaskTransitionError(
			`Semantic assessment has ${assessment.steps.length} results for ${input.steps.length} plan steps`,
		);
	}
	for (const [index, step] of input.steps.entries()) {
		const result = assessment.steps[index];
		if (
			!result ||
			typeof result !== "object" ||
			Array.isArray(result) ||
			result.index !== index
		) {
			throw new TaskTransitionError(
				`Semantic assessment result ${index + 1} has an invalid index`,
			);
		}
		if (result.inputHash !== hashStepSemanticInput(step)) {
			throw new TaskTransitionError(
				`Semantic assessment result ${index + 1} does not match its plan step`,
			);
		}
		validateStepSemanticAssessment(result, index);
	}
}

function validateStepSemanticAssessment(
	assessment: StepSemanticAssessment,
	index: number,
): void {
	if (
		typeof assessment.specific?.value !== "boolean" ||
		typeof assessment.hiddenSubtasks?.value !== "boolean" ||
		!isSemanticCountChoice(assessment.actionCount?.value) ||
		!isSemanticCountChoice(assessment.outputCount?.value) ||
		!isSemanticCountChoice(assessment.verificationCount?.value) ||
		!Array.isArray(assessment.issues) ||
		!assessment.issues.every((issue) => typeof issue === "string")
	) {
		throw new TaskTransitionError(
			`Semantic assessment result ${index + 1} has invalid judgments`,
		);
	}
	const confidences = [
		assessment.specific.confidence,
		assessment.actionCount.confidence,
		assessment.outputCount.confidence,
		assessment.verificationCount.confidence,
		assessment.hiddenSubtasks.confidence,
		assessment.confidence,
	];
	if (confidences.some((value) => !isSemanticConfidence(value))) {
		throw new TaskTransitionError(
			`Semantic assessment result ${index + 1} has invalid confidence`,
		);
	}
	const expectedIssues = expectedPlanSemanticIssues(assessment);
	if (
		assessment.issues.length !== expectedIssues.length ||
		assessment.issues.some(
			(issue, issueIndex) => issue !== expectedIssues[issueIndex],
		)
	) {
		throw new TaskTransitionError(
			`Semantic assessment result ${index + 1} has inconsistent issues`,
		);
	}
	const minimumConfidence = Math.min(...confidences.slice(0, 5));
	if (assessment.confidence !== minimumConfidence) {
		throw new TaskTransitionError(
			`Semantic assessment result ${index + 1} has inconsistent confidence`,
		);
	}
	const uncertain =
		assessment.actionCount.value === "unclear" ||
		assessment.outputCount.value === "unclear" ||
		assessment.verificationCount.value === "unclear";
	const rejected =
		!assessment.specific.value ||
		assessment.confidence < MIN_SEMANTIC_CONFIDENCE ||
		uncertain;
	const atomic =
		assessment.actionCount.value === "one" &&
		assessment.outputCount.value === "one" &&
		assessment.verificationCount.value === "one" &&
		!assessment.hiddenSubtasks.value;
	const expectedDecision = rejected
		? "rejected"
		: atomic
			? "atomic"
			: "needs_breakdown";
	if (assessment.decision !== expectedDecision) {
		throw new TaskTransitionError(
			`Semantic assessment result ${index + 1} has inconsistent decision ${assessment.decision}`,
		);
	}
}

function expectedPlanSemanticIssues(
	assessment: StepSemanticAssessment,
): string[] {
	const issues: string[] = [];
	if (!assessment.specific.value)
		issues.push("step description is not specific enough");
	if (assessment.actionCount.value === "multiple")
		issues.push("step contains multiple independent actions");
	if (assessment.actionCount.value === "unclear")
		issues.push("independent action count is unclear");
	if (assessment.outputCount.value === "multiple")
		issues.push("step contains multiple independently observable outputs");
	if (assessment.outputCount.value === "unclear")
		issues.push("observable output count is unclear");
	if (assessment.verificationCount.value === "multiple")
		issues.push("step requires multiple independent verification methods");
	if (assessment.verificationCount.value === "unclear")
		issues.push("verification method count is unclear");
	if (assessment.hiddenSubtasks.value)
		issues.push("step contains hidden subtasks");
	if (assessment.confidence < MIN_SEMANTIC_CONFIDENCE) {
		issues.push(
			`semantic assessment confidence ${assessment.confidence.toFixed(2)} is below ${MIN_SEMANTIC_CONFIDENCE.toFixed(2)}`,
		);
	}
	return issues;
}

function createPlanSteps(
	taskId: string,
	steps: TaskStepInput[],
	criterionIds: string[],
	createdAt: string,
	activate: boolean,
	semanticAssessment?: PlanSemanticAssessment,
	options: CreatePlanStepsOptions = {},
): TaskStep[] {
	const createdSteps: TaskStep[] = [];
	const validationErrors: string[] = [];
	for (const [index, step] of steps.entries()) {
		try {
			createdSteps.push(
				createPlanStep(
					taskId,
					step,
					index,
					criterionIds,
					createdAt,
					activate,
					semanticAssessment?.steps[index],
					options,
				),
			);
		} catch (error) {
			if (!(error instanceof TaskTransitionError)) throw error;
			const prefix = `Plan step ${index + 1}`;
			validationErrors.push(
				error.message.startsWith(prefix)
					? error.message
					: `${prefix}: ${error.message}`,
			);
		}
	}
	if (validationErrors.length === 1) {
		throw new TaskTransitionError(validationErrors.join(""));
	}
	if (validationErrors.length > 1) {
		throw new TaskTransitionError(
			`Plan validation failed:\n- ${validationErrors.join("\n- ")}`,
		);
	}
	return createdSteps;
}

function createPlanStep(
	taskId: string,
	step: TaskStepInput,
	index: number,
	criterionIds: string[],
	createdAt: string,
	activate: boolean,
	semanticAssessment: StepSemanticAssessment | undefined,
	options: CreatePlanStepsOptions,
): TaskStep {
	const text = step.text.trim();
	const expectedOutput = step.expectedOutput.trim();
	if (!text) throw new TaskTransitionError("Plan steps cannot be blank");
	if (!expectedOutput) {
		throw new TaskTransitionError("Plan step expectedOutput is required");
	}
	const linkedCriteria = unique(
		step.criterionIds && step.criterionIds.length > 0
			? step.criterionIds
			: criterionIds,
	);
	for (const criterionId of linkedCriteria) {
		if (!criterionIds.includes(criterionId)) {
			throw new TaskTransitionError(
				`Plan step references unknown criterion ${criterionId}`,
			);
		}
	}
	if (semanticAssessment?.decision === "rejected") {
		throw new TaskTransitionError(
			`Plan step ${index + 1} failed semantic assessment: ${semanticAssessment.issues.join("; ") || "model confidence was insufficient"}`,
		);
	}
	const granularityCheck = semanticAssessment
		? semanticGranularityCheck(semanticAssessment)
		: normalizeGranularityCheck(step);
	const decompositionStatus = semanticAssessment
		? semanticAssessment.decision === "atomic"
			? "atomic"
			: "needs_breakdown"
		: (step.decompositionStatus ??
			(granularityCheck.isAtomic ? "atomic" : "needs_breakdown"));
	const planQuality = semanticAssessment
		? {
				score: Math.round(semanticAssessment.confidence * 100),
				issues: [...semanticAssessment.issues],
			}
		: legacyPlanQuality({
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
		...(semanticAssessment ? { semanticAssessment } : {}),
		...(status === "active" ? { startedAt: createdAt } : {}),
	};
}

function semanticGranularityCheck(
	assessment: StepSemanticAssessment,
): TaskGranularityCheck {
	return {
		isAtomic: assessment.decision === "atomic",
		reason:
			assessment.issues.length > 0
				? assessment.issues.join("; ")
				: "Native semantic assessment found one action, one output, one verification method, and no hidden subtasks",
		canBeDoneInOneAgentAction: assessment.actionCount.value === "one",
		hasSingleObservableOutput: assessment.outputCount.value === "one",
		hasSingleVerificationMethod: assessment.verificationCount.value === "one",
		hasNoHiddenSubtasks: !assessment.hiddenSubtasks.value,
	};
}

function legacyPlanQuality(step: {
	criterionIds: string[];
	evidenceRequired: boolean;
	allowedActions: string[];
	decompositionStatus: TaskStep["decompositionStatus"];
	granularityCheck: TaskGranularityCheck;
}): PlanQuality {
	const issues: string[] = [];
	if (step.allowedActions.length > 3)
		issues.push("allowedActions are too broad; use at most three");
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
		reason: "Legacy event has no persisted semantic assessment",
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
	if (step.allowedActions.length > 3) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} allowedActions are too broad; use at most three`,
		);
	}
	if (step.criterionIds.length === 0) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} requires at least one criterion link`,
		);
	}
	if (!step.evidenceRequired) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} evidenceRequired must be true`,
		);
	}
	if (
		step.decompositionStatus === "atomic" &&
		(!step.granularityCheck.isAtomic ||
			!step.granularityCheck.canBeDoneInOneAgentAction ||
			!step.granularityCheck.hasSingleObservableOutput ||
			!step.granularityCheck.hasSingleVerificationMethod ||
			!step.granularityCheck.hasNoHiddenSubtasks)
	) {
		throw new TaskTransitionError(
			`Plan step ${index + 1} atomic granularity flags are inconsistent`,
		);
	}
}

function isSemanticConfidence(value: number): boolean {
	return Number.isFinite(value) && value >= 0 && value <= 1;
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
		if (isAtMaximumDecompositionDepth(currentStep)) {
			throw new TaskTransitionError(
				`Plan step ${currentStep.id} reached maximum decomposition depth while still non-atomic; block the task and carry the remaining scope into a flat successor task`,
			);
		}
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
		throw new TaskTransitionError(
			"Scope updates require an activity",
			"scope_activity_required",
		);
	}
	const scope = event.scope ?? "within_step";
	if (
		(scope === "scope_change" || scope === "off_plan") &&
		!event.scopeReason?.trim()
	) {
		throw new TaskTransitionError(
			"Scope change or off-plan activity requires scopeReason",
			"scope_reason_required",
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
			if (
				hasBlockingFailedEvidence(task, evidenceId, {
					criterionId: criterion.id,
				}) &&
				!forceReason
			) {
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
			if (
				hasBlockingFailedEvidence(task, evidenceId, { stepId: step.id }) &&
				!forceReason
			) {
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

export function hasBlockingFailedEvidence(
	task: Task,
	evidenceId: string,
	scope: { criterionId?: string; stepId?: string },
): boolean {
	const evidence = requireEvidence(task, evidenceId);
	if (evidence.passed !== false) return false;
	return !task.evidence.some(
		(candidate) =>
			candidate.passed === true &&
			(candidate.supersedes ?? []).includes(evidenceId) &&
			Date.parse(candidate.createdAt) > Date.parse(evidence.createdAt) &&
			isEvidenceLinkedToScope(task, candidate.id, scope),
	);
}

function isEvidenceLinkedToScope(
	task: Task,
	evidenceId: string,
	scope: { criterionId?: string; stepId?: string },
): boolean {
	if (scope.criterionId) {
		const criterion = requireCriterion(task, scope.criterionId);
		return criterion.evidenceIds.includes(evidenceId);
	}
	if (scope.stepId) {
		const step = requireStep(task, scope.stepId);
		return step.evidenceIds.includes(evidenceId);
	}
	return false;
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

function validateEvidence(
	evidence: TaskEvidence,
	requireSemanticAssessment: boolean,
): void {
	if (!evidence.summary.trim())
		throw new TaskTransitionError("Evidence summary is required");
	if (evidence.summary.length > MAX_EVIDENCE_SUMMARY_LENGTH) {
		throw new TaskTransitionError(
			`Evidence summary exceeds ${MAX_EVIDENCE_SUMMARY_LENGTH} characters; put long output in artifactRefs`,
		);
	}
	for (const reference of evidence.references) {
		if (reference.length > MAX_EVIDENCE_REFERENCE_LENGTH) {
			throw new TaskTransitionError(
				`Evidence reference exceeds ${MAX_EVIDENCE_REFERENCE_LENGTH} characters; use a shorter artifact path or command reference`,
			);
		}
	}
	for (const artifactRef of evidence.quality.artifactRefs) {
		if (artifactRef.length > MAX_EVIDENCE_REFERENCE_LENGTH) {
			throw new TaskTransitionError(
				`Evidence artifactRef exceeds ${MAX_EVIDENCE_REFERENCE_LENGTH} characters; use a shorter artifact path`,
			);
		}
	}
	if (evidence.quality.source.length > MAX_EVIDENCE_REFERENCE_LENGTH) {
		throw new TaskTransitionError(
			`Evidence source exceeds ${MAX_EVIDENCE_REFERENCE_LENGTH} characters`,
		);
	}
	if (
		evidence.quality.command &&
		evidence.quality.command.length > MAX_EVIDENCE_REFERENCE_LENGTH
	) {
		throw new TaskTransitionError(
			`Evidence command exceeds ${MAX_EVIDENCE_REFERENCE_LENGTH} characters; store full command in an artifact if needed`,
		);
	}
	if (
		evidence.quality.observedOutput &&
		evidence.quality.observedOutput.length > MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH
	) {
		throw new TaskTransitionError(
			`Evidence observedOutput exceeds ${MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH} characters; store long logs in artifactRefs`,
		);
	}
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
	if (evidence.passed === true) {
		validateEvidenceSemanticAssessment(
			evidence.semanticAssessment,
			evidence,
			requireSemanticAssessment,
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

function validateEvidenceSemanticAssessment(
	assessment: EvidenceSemanticAssessment | undefined,
	evidence: TaskEvidence,
	required: boolean,
): void {
	if (
		!assessment ||
		typeof assessment !== "object" ||
		Array.isArray(assessment)
	) {
		if (required) {
			throw new TaskTransitionError(
				"Version 2 passing evidence requires a native semantic assessment",
			);
		}
		return;
	}
	validateSemanticProvenance(
		assessment.provenance,
		"Evidence semantic assessment",
	);
	if (
		!isEvidenceSemanticDecision(assessment.decision) ||
		!Array.isArray(assessment.issues) ||
		!assessment.issues.every((issue) => typeof issue === "string")
	) {
		throw new TaskTransitionError(
			"Evidence semantic assessment shape is invalid",
		);
	}
	if (!isSemanticConfidence(assessment.confidence)) {
		throw new TaskTransitionError(
			"Evidence semantic assessment confidence is invalid",
		);
	}
	if (
		assessment.issues.some((issue) => !EVIDENCE_SEMANTIC_ISSUES.has(issue)) ||
		new Set(assessment.issues).size !== assessment.issues.length
	) {
		throw new TaskTransitionError(
			"Evidence semantic assessment has invalid issues",
		);
	}
	if (assessment.decision === "supported" && assessment.issues.length > 0) {
		throw new TaskTransitionError(
			"Supported evidence semantic assessment cannot contain issues",
		);
	}
	if (assessment.decision === "unsupported" && assessment.issues.length === 0) {
		throw new TaskTransitionError(
			"Unsupported evidence semantic assessment requires an issue",
		);
	}
	if (
		assessment.decision === "uncertain" &&
		!assessment.issues.includes("uncertain")
	) {
		throw new TaskTransitionError(
			"Uncertain evidence semantic assessment requires the uncertain issue",
		);
	}
	const expectedHash = hashEvidenceAssessmentInput({
		type: evidence.type,
		level: evidence.level,
		summary: evidence.summary,
		references: evidence.references,
		quality: evidence.quality,
	});
	if (
		assessment.inputHash !== expectedHash ||
		assessment.provenance.inputHash !== expectedHash
	) {
		throw new TaskTransitionError(
			"Evidence semantic assessment input hash does not match the evidence mutation",
		);
	}
	if (
		assessment.decision !== "supported" ||
		assessment.confidence < MIN_SEMANTIC_CONFIDENCE
	) {
		throw new TaskTransitionError(
			`Passing evidence failed semantic assessment: ${assessment.issues.join("; ") || assessment.decision}`,
		);
	}
}

function validateSemanticProvenance(provenance: unknown, label: string): void {
	if (
		!provenance ||
		typeof provenance !== "object" ||
		Array.isArray(provenance)
	) {
		throw new TaskTransitionError(`${label} provenance is invalid`);
	}
	const value = provenance as Record<string, unknown>;
	if (value.version !== SEMANTIC_ASSESSMENT_VERSION) {
		throw new TaskTransitionError(
			`Unsupported semantic assessment version: ${String(value.version)}`,
		);
	}
	if (
		typeof value.strategy !== "string" ||
		!SEMANTIC_ASSESSMENT_STRATEGIES.has(value.strategy) ||
		typeof value.provider !== "string" ||
		!value.provider.trim() ||
		typeof value.model !== "string" ||
		!value.model.trim() ||
		typeof value.promptVersion !== "string" ||
		!value.promptVersion.trim() ||
		typeof value.inputHash !== "string" ||
		!SHA256_HEX_PATTERN.test(value.inputHash) ||
		typeof value.assessedAt !== "string" ||
		!isIsoTimestamp(value.assessedAt)
	) {
		throw new TaskTransitionError(`${label} provenance is invalid`);
	}
}

function isIsoTimestamp(value: string): boolean {
	const timestamp = Date.parse(value);
	return (
		Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value
	);
}

function isSemanticCountChoice(
	value: unknown,
): value is "one" | "multiple" | "unclear" {
	return value === "one" || value === "multiple" || value === "unclear";
}

function isEvidenceSemanticDecision(
	value: unknown,
): value is EvidenceSemanticAssessment["decision"] {
	return (
		value === "supported" || value === "unsupported" || value === "uncertain"
	);
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
				normalizedReferences(evidence.references) &&
			normalizedReferences(existing.supersedes ?? []) ===
				normalizedReferences(evidence.supersedes ?? []),
	);
}

function normalizedReferences(references: string[]): string {
	return unique(references.map((reference) => reference.trim()).filter(Boolean))
		.sort()
		.join("\n");
}

function validateEventEnvelope(event: TaskEvent): void {
	if (event.version !== 1 && event.version !== 2)
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
	return structuredClone({ ...state, events: [] });
}

function unique(values: string[]): string[] {
	return [...new Set(values)];
}

function unreachable(value: never): never {
	throw new TaskTransitionError(`Unsupported event: ${JSON.stringify(value)}`);
}
