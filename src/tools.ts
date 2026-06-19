import { createEventId, SequentialIdGenerator } from "./ids.ts";
import type {
	AcceptanceCriterion,
	EvidenceType,
	Task,
	TaskDecision,
	TaskEvent,
	TaskEvidence,
	TaskPriority,
	TaskState,
	TaskStatus,
	TaskStepStatus,
	VerificationLevel,
} from "./model.ts";
import type { ExtensionAPI, ExtensionContext, ToolResult } from "./pi-types.ts";
import { formatTaskList } from "./render.ts";
import { Type } from "./schema.ts";
import { errorText, type TaskRuntimeStore } from "./store.ts";
import { updateTaskUi } from "./widget.ts";

const TASK_STATUSES = [
	"pending",
	"active",
	"blocked",
	"review",
	"done",
	"cancelled",
] as const;
const STEP_STATUSES = ["active", "done", "skipped"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
const EVIDENCE_TYPES = [
	"test",
	"command",
	"review",
	"file",
	"commit",
	"dogfood",
	"user_acceptance",
	"external",
	"note",
] as const;
const VERIFICATION_LEVELS = [
	"not_verified",
	"static_read",
	"unit_test",
	"integration_test",
	"e2e_smoke",
	"release_grade_e2e",
	"pi_dogfood",
	"external_unverified",
] as const;

interface TaskPlanParams extends Record<string, unknown> {
	title: string;
	objective: string;
	acceptance_criteria: string[];
	initial_steps?: string[];
	priority?: TaskPriority;
	tags?: string[];
	activate?: boolean;
}

interface TaskListParams extends Record<string, unknown> {
	status?: TaskStatus;
	include_done?: boolean;
	include_evidence?: boolean;
	limit?: number;
}

interface TaskUpdateParams extends Record<string, unknown> {
	task_id: string;
	status?: TaskStatus;
	progress?: number;
	current_step?: string;
	next_action?: string;
	step_id?: string;
	step_status?: Exclude<TaskStepStatus, "pending">;
	step_evidence_ids?: string[];
	note?: string;
	reason?: string;
	blocker?: {
		reason: string;
		blockedBy: "user" | "external" | "environment" | "dependency" | "ambiguity";
		neededToUnblock: string;
	};
}

interface TaskEvidenceParams extends Record<string, unknown> {
	task_id: string;
	type: EvidenceType;
	level: VerificationLevel;
	summary: string;
	passed: "true" | "false" | "unknown";
	references?: string[];
	criterion_ids?: string[];
}

interface TaskDecisionParams extends Record<string, unknown> {
	task_id: string;
	question: string;
	decision: string;
	decided_by: "user" | "agent";
	rationale?: string;
	impact?: string;
}

interface TaskCompleteParams extends Record<string, unknown> {
	task_id: string;
	summary: string;
	evidence_ids: string[];
	criterion_results?: Array<{
		criterionId: string;
		status: AcceptanceCriterion["status"];
		evidenceIds?: string[];
		note?: string;
	}>;
	force_with_reason?: string;
}

export function registerTaskTools(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
	idGenerator = new SequentialIdGenerator(),
): void {
	pi.registerTool<TaskPlanParams>({
		name: "task_plan",
		label: "Task Plan",
		description:
			"Create a structured pi-tasks task with objective and acceptance criteria.",
		promptSnippet:
			"Create a pi-tasks execution contract before non-trivial implementation work",
		promptGuidelines: [
			"Use task_plan for multi-step work before implementation when no suitable active task exists.",
			"Acceptance criteria must be concrete enough to verify with evidence before completion.",
			"Activate only one task unless the user explicitly asks for parallel work.",
		],
		parameters: Type.Object({
			title: Type.String({ description: "Concise task title" }),
			objective: Type.String({
				description: "User-facing objective and scope",
			}),
			acceptance_criteria: Type.Array(
				Type.String({ description: "Concrete acceptance criterion" }),
			),
			initial_steps: Type.Optional(Type.Array(Type.String())),
			priority: Type.Optional(Type.Enum(PRIORITIES)),
			tags: Type.Optional(Type.Array(Type.String())),
			activate: Type.Optional(
				Type.Boolean({ description: "Make this the active task" }),
			),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const taskId = idGenerator.next("T");
			const event = baseEvent("task.created", taskId, ctx, {
				title: params.title,
				objective: params.objective,
				acceptanceCriteria: params.acceptance_criteria,
				activate: params.activate ?? true,
				...(params.initial_steps ? { initialSteps: params.initial_steps } : {}),
				...(params.priority ? { priority: params.priority } : {}),
				...(params.tags ? { tags: params.tags } : {}),
			});
			return appendAndReport(
				pi,
				store,
				ctx,
				event,
				`Created task ${taskId}: ${params.title}`,
			);
		},
	});

	pi.registerTool<TaskListParams>({
		name: "task_list",
		label: "Task List",
		description: "List pi-tasks tasks on the current session branch.",
		promptSnippet:
			"Inspect current pi-tasks task status, blockers, and verification gaps",
		promptGuidelines: [
			"Use task_list before resuming work after session reload or branch navigation.",
			"Do not treat task_list as evidence; attach verification with task_evidence.",
		],
		parameters: Type.Object({
			status: Type.Optional(Type.Enum(TASK_STATUSES)),
			include_done: Type.Optional(Type.Boolean()),
			include_evidence: Type.Optional(Type.Boolean()),
			limit: Type.Optional(Type.Number()),
		}),
		execute: async (_toolCallId, params) => {
			const rawState = store.getState();
			const filtered = params.status
				? filterStateByStatus(rawState, params.status)
				: rawState;
			return textResult(
				formatTaskList(filtered, formatListOptions(params)),
				filtered,
			);
		},
	});

	pi.registerTool<TaskUpdateParams>({
		name: "task_update",
		label: "Task Update",
		description:
			"Update task progress, ordered plan step, status, next action, or blocker state.",
		promptSnippet:
			"Update pi-tasks progress, current ordered step, next action, status, or blocker details",
		promptGuidelines: [
			"Use step_id with step_status=done when the current planned step is finished.",
			"Do not skip ahead; ordered plan steps must be completed or skipped in the displayed order.",
			"Moving to blocked requires blocker details; unblocking requires a reason.",
		],
		parameters: Type.Object({
			task_id: Type.String(),
			status: Type.Optional(Type.Enum(TASK_STATUSES)),
			progress: Type.Optional(Type.Number()),
			current_step: Type.Optional(Type.String()),
			next_action: Type.Optional(Type.String()),
			step_id: Type.Optional(Type.String()),
			step_status: Type.Optional(Type.Enum(STEP_STATUSES)),
			step_evidence_ids: Type.Optional(Type.Array(Type.String())),
			note: Type.Optional(Type.String()),
			reason: Type.Optional(
				Type.String({ description: "Reason for unblock/rework transition" }),
			),
			blocker: Type.Optional(
				Type.Object({
					reason: Type.String(),
					blockedBy: Type.Enum([
						"user",
						"external",
						"environment",
						"dependency",
						"ambiguity",
					]),
					neededToUnblock: Type.String(),
				}),
			),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const event = baseEvent("task.updated", params.task_id, ctx, {
				...(params.status ? { status: params.status } : {}),
				...(params.progress !== undefined ? { progress: params.progress } : {}),
				...(params.current_step !== undefined
					? { currentStep: params.current_step }
					: {}),
				...(params.next_action !== undefined
					? { nextAction: params.next_action }
					: {}),
				...(params.step_id !== undefined ? { stepId: params.step_id } : {}),
				...(params.step_status !== undefined
					? { stepStatus: params.step_status }
					: {}),
				...(params.step_evidence_ids !== undefined
					? { stepEvidenceIds: params.step_evidence_ids }
					: {}),
				...(params.note !== undefined ? { note: params.note } : {}),
				...(params.reason !== undefined ? { reason: params.reason } : {}),
				...(params.blocker ? { blocker: params.blocker } : {}),
			});
			return appendAndReport(
				pi,
				store,
				ctx,
				event,
				`Updated task ${params.task_id}`,
			);
		},
	});

	pi.registerTool<TaskEvidenceParams>({
		name: "task_evidence",
		label: "Task Evidence",
		description:
			"Attach verification evidence to a task and optionally satisfy acceptance criteria.",
		promptSnippet:
			"Record verification evidence before claiming a task is complete",
		promptGuidelines: [
			"Use task_evidence for tests, commands, reviews, files, dogfood, or explicit user acceptance.",
			"Passing non-note evidence must use a verification level stronger than not_verified.",
			"Attach criterion IDs when evidence proves specific acceptance criteria.",
		],
		parameters: Type.Object({
			task_id: Type.String(),
			type: Type.Enum(EVIDENCE_TYPES),
			level: Type.Enum(VERIFICATION_LEVELS),
			summary: Type.String(),
			passed: Type.Enum(["true", "false", "unknown"]),
			references: Type.Optional(Type.Array(Type.String())),
			criterion_ids: Type.Optional(Type.Array(Type.String())),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const duplicate = findDuplicateEvidenceForParams(
				store.getState().tasks[params.task_id],
				params,
			);
			if (
				duplicate &&
				criteriaAlreadyLinked(store.getState(), params, duplicate)
			) {
				return textResult(
					`Evidence already recorded as ${duplicate.id} for task ${params.task_id}\n\n${formatTaskList(store.getState(), { includeDone: true, includeEvidence: true })}`,
					store.getState(),
				);
			}
			const evidenceId = idGenerator.next("E");
			const event = baseEvent("task.evidence_added", params.task_id, ctx, {
				evidence: {
					id: evidenceId,
					type: params.type,
					level: params.level,
					summary: params.summary,
					passed: parsePassed(params.passed),
					references: params.references ?? [],
				},
				...(params.criterion_ids ? { criterionIds: params.criterion_ids } : {}),
			});
			const success = duplicate
				? `Linked existing evidence ${duplicate.id} for task ${params.task_id}`
				: `Recorded evidence ${evidenceId} for task ${params.task_id}`;
			return appendAndReport(pi, store, ctx, event, success);
		},
	});

	pi.registerTool<TaskDecisionParams>({
		name: "task_decision",
		label: "Task Decision",
		description:
			"Record a user or agent decision that affects task scope or implementation.",
		promptSnippet:
			"Record explicit decisions that affect pi-tasks scope, tradeoffs, or acceptance",
		promptGuidelines: [
			"Use task_decision for user-facing scope choices and meaningful agent tradeoffs.",
			"Do not hide unresolved user choices in notes; record them as blockers or decisions.",
		],
		parameters: Type.Object({
			task_id: Type.String(),
			question: Type.String(),
			decision: Type.String(),
			decided_by: Type.Enum(["user", "agent"]),
			rationale: Type.Optional(Type.String()),
			impact: Type.Optional(Type.String()),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const decisionId = idGenerator.next("D");
			const decision: Omit<TaskDecision, "taskId" | "createdAt"> = {
				id: decisionId,
				question: params.question,
				decision: params.decision,
				decidedBy: params.decided_by,
			};
			if (params.rationale !== undefined) decision.rationale = params.rationale;
			if (params.impact !== undefined) decision.impact = params.impact;
			const event = baseEvent("task.decision_recorded", params.task_id, ctx, {
				decision,
			});
			return appendAndReport(
				pi,
				store,
				ctx,
				event,
				`Recorded decision ${decisionId} for task ${params.task_id}`,
			);
		},
	});

	pi.registerTool<TaskCompleteParams>({
		name: "task_complete",
		label: "Task Complete",
		description:
			"Mark a task complete only after evidence and criteria support completion.",
		promptSnippet:
			"Complete a pi-tasks task only when acceptance criteria have evidence",
		promptGuidelines: [
			"Call task_complete only after task_evidence has recorded supporting evidence.",
			"Unsupported completion is rejected unless force_with_reason documents the verification gap.",
			"Forced completion must be reported as not fully verified.",
		],
		parameters: Type.Object({
			task_id: Type.String(),
			summary: Type.String(),
			evidence_ids: Type.Array(Type.String()),
			criterion_results: Type.Optional(
				Type.Array(
					Type.Object({
						criterionId: Type.String(),
						status: Type.Enum(["pending", "satisfied", "failed", "skipped"]),
						evidenceIds: Type.Optional(Type.Array(Type.String())),
						note: Type.Optional(Type.String()),
					}),
				),
			),
			force_with_reason: Type.Optional(Type.String()),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const event = baseEvent("task.completed", params.task_id, ctx, {
				summary: params.summary,
				evidenceIds: params.evidence_ids,
				...(params.criterion_results
					? { criterionResults: params.criterion_results }
					: {}),
				...(params.force_with_reason
					? { forceWithReason: params.force_with_reason }
					: {}),
			});
			return appendAndReport(
				pi,
				store,
				ctx,
				event,
				`Completed task ${params.task_id}`,
			);
		},
	});
}

function appendAndReport(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
	ctx: ExtensionContext,
	event: TaskEvent,
	success: string,
): ToolResult {
	try {
		const state = store.append(event, pi.appendEntry);
		updateTaskUi(ctx, state);
		const warning =
			event.type === "task.completed" && event.forceWithReason
				? `\nWarning: forced completion: ${event.forceWithReason}`
				: "";
		return textResult(
			`${success}${warning}\n\n${formatTaskList(state, { includeDone: true, includeEvidence: true })}`,
			state,
		);
	} catch (error) {
		return {
			...textResult(`Error: ${errorText(error)}`, store.getState()),
			isError: true,
		};
	}
}

function baseEvent<TType extends TaskEvent["type"]>(
	type: TType,
	taskId: string,
	ctx: ExtensionContext,
	payload: Omit<
		Extract<TaskEvent, { type: TType }>,
		"version" | "id" | "type" | "taskId" | "createdAt" | "source"
	>,
): Extract<TaskEvent, { type: TType }> {
	const createdAt = new Date().toISOString();
	return {
		version: 1,
		id: createEventId(taskId, createdAt, type),
		type,
		taskId,
		createdAt,
		source: ctx.mode === "tui" ? "tool" : "tool",
		...payload,
	} as Extract<TaskEvent, { type: TType }>;
}

function textResult(text: string, details?: unknown): ToolResult {
	return { content: [{ type: "text", text }], details };
}

function parsePassed(value: string): boolean | "unknown" {
	if (value === "true") return true;
	if (value === "false") return false;
	return "unknown";
}

function findDuplicateEvidenceForParams(
	task: Task | undefined,
	params: TaskEvidenceParams,
): TaskEvidence | undefined {
	if (!task) return undefined;
	const passed = parsePassed(params.passed);
	const references = params.references ?? [];
	return task.evidence.find(
		(evidence) =>
			evidence.type === params.type &&
			evidence.level === params.level &&
			evidence.passed === passed &&
			evidence.summary.trim() === params.summary.trim() &&
			normalizedReferences(evidence.references) ===
				normalizedReferences(references),
	);
}

function criteriaAlreadyLinked(
	state: TaskState,
	params: TaskEvidenceParams,
	evidence: TaskEvidence,
): boolean {
	const task = state.tasks[params.task_id];
	if (!task) return false;
	return (params.criterion_ids ?? []).every((criterionId) =>
		task.acceptanceCriteria
			.find((criterion) => criterion.id === criterionId)
			?.evidenceIds.includes(evidence.id),
	);
}

function normalizedReferences(references: string[]): string {
	return [
		...new Set(references.map((reference) => reference.trim()).filter(Boolean)),
	]
		.sort()
		.join("\n");
}

function filterStateByStatus(state: TaskState, status: TaskStatus): TaskState {
	const tasks = Object.fromEntries(
		Object.entries(state.tasks).filter(([, task]) => task.status === status),
	);
	const filtered: TaskState = {
		...state,
		tasks,
	};
	if (state.activeTaskId && tasks[state.activeTaskId]) {
		filtered.activeTaskId = state.activeTaskId;
	} else {
		delete filtered.activeTaskId;
	}
	return filtered;
}

function formatListOptions(params: TaskListParams): {
	includeDone?: boolean;
	includeEvidence?: boolean;
	limit?: number;
} {
	return {
		...(params.include_done !== undefined
			? { includeDone: params.include_done }
			: {}),
		...(params.include_evidence !== undefined
			? { includeEvidence: params.include_evidence }
			: {}),
		...(params.limit !== undefined ? { limit: params.limit } : {}),
	};
}
