import { createEventId, SequentialIdGenerator } from "./ids.ts";
import {
	type AcceptanceCriterion,
	type EvidenceQuality,
	type EvidenceSemanticAssessment,
	type EvidenceType,
	isAtMaximumDecompositionDepth,
	MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH,
	MAX_EVIDENCE_REFERENCE_LENGTH,
	MAX_EVIDENCE_SUMMARY_LENGTH,
	type Task,
	type TaskDecision,
	type TaskEvent,
	type TaskEvidence,
	type TaskPriority,
	type TaskState,
	type TaskStatus,
	type TaskStepInput,
	type TaskStepStatus,
	type VerificationLevel,
} from "./model.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	ModelUsage,
	ToolDefinition,
	ToolResult,
} from "./pi-types.ts";
import { reduceTaskState, TaskTransitionError } from "./reducer.ts";
import {
	buildTaskResume,
	formatTaskFocus,
	formatTaskList,
	formatTaskNext,
	formatTaskResume,
} from "./render.ts";
import { Type } from "./schema.ts";
import {
	assessEvidenceSemantics,
	assessPlanSemantics,
	type EvidenceAssessmentInput,
	SemanticAssessmentError,
} from "./semantic-assessment.ts";
import { errorText, snapshotState, type TaskRuntimeStore } from "./store.ts";
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

interface SemanticTaskStepInput {
	text: string;
	expectedOutput: string;
	criterionIds?: string[];
	evidenceRequired?: boolean;
	allowedActions?: string[];
}

interface TaskPlanParams extends Record<string, unknown> {
	title: string;
	objective: string;
	acceptance_criteria: string[];
	initial_steps?: string[];
	plan_steps?: SemanticTaskStepInput[];
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

interface TaskCheckpointParams extends Record<string, unknown> {
	reason?: string;
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
	activity?: string;
	scope?: "within_step" | "scope_change" | "off_plan";
	scope_reason?: string;
	note?: string;
	reason?: string;
	resolve_warnings?: string[];
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
	references: string[];
	criterion_ids?: string[];
	step_ids?: string[];
	quality: EvidenceQuality;
	override_reason?: string;
	supersedes?: string[];
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

interface TaskGranularityCheckParams extends Record<string, unknown> {
	task_id?: string;
	step_id?: string;
}

interface TaskDecomposeParams extends Record<string, unknown> {
	task_id: string;
	step_id: string;
	reason: string;
	child_steps: SemanticTaskStepInput[];
}

type GuidedTaskToolDefinition<TParams extends Record<string, unknown>> =
	ToolDefinition<TParams> & {
		promptSnippet: string;
		promptGuidelines: string[];
	};

const TASK_ENTRYPOINT_NAMES = ["task_plan", "task_resume"] as const;
const registeredTaskToolNames = new WeakMap<ExtensionAPI, Set<string>>();

interface ToolActivationApi {
	getActiveTools(): string[];
	getAllTools(): Array<{ name: string }>;
	setActiveTools(names: string[]): void;
}

function hasToolActivationApi(
	pi: ExtensionAPI,
): pi is ExtensionAPI & ToolActivationApi {
	return (
		typeof pi.getActiveTools === "function" &&
		typeof pi.getAllTools === "function" &&
		typeof pi.setActiveTools === "function"
	);
}

function registerGuidedTool<TParams extends Record<string, unknown>>(
	pi: ExtensionAPI,
	tool: GuidedTaskToolDefinition<TParams>,
): void {
	let names = registeredTaskToolNames.get(pi);
	if (!names) {
		names = new Set();
		registeredTaskToolNames.set(pi, names);
	}
	if (
		TASK_ENTRYPOINT_NAMES.includes(tool.name as "task_plan" | "task_resume") ||
		!hasToolActivationApi(pi)
	) {
		pi.registerTool({
			...tool,
			description: formatToolDescription(
				tool.description,
				tool.promptGuidelines,
			),
		});
		names.add(tool.name);
		return;
	}

	const {
		promptSnippet: _promptSnippet,
		promptGuidelines: _promptGuidelines,
		...lazyTool
	} = tool;
	pi.registerTool(lazyTool);
	names.add(tool.name);
}

function formatToolDescription(
	description: string,
	guidelines: readonly string[],
): string {
	if (guidelines.length === 0) return description;
	return [
		description,
		"",
		"Agent guidance:",
		...guidelines.map((guideline) => `- ${guideline}`),
	].join("\n");
}

function getToolActivationApi(pi: ExtensionAPI): ToolActivationApi | undefined {
	if (!hasToolActivationApi(pi)) return undefined;
	return pi;
}

function configuredTaskTools(
	pi: ExtensionAPI,
	api: ToolActivationApi,
): string[] {
	const names = registeredTaskToolNames.get(pi);
	if (!names) return [];
	const available = new Set(api.getAllTools().map((tool) => tool.name));
	return [...names].filter((name) => available.has(name));
}

function setTaskTools(
	pi: ExtensionAPI,
	api: ToolActivationApi,
	taskTools: readonly string[],
): void {
	const available = new Set(configuredTaskTools(pi, api));
	const next = [
		...api.getActiveTools().filter((name) => !available.has(name)),
		...taskTools.filter((name) => available.has(name)),
	];
	const unique = [...new Set(next)];
	if (
		unique.length !== api.getActiveTools().length ||
		unique.some((name, index) => api.getActiveTools()[index] !== name)
	) {
		api.setActiveTools(unique);
	}
}

/** Reconciles only registered pi-tasks tools without widening host restrictions. */
export function reconcileTaskTools(pi: ExtensionAPI, state: TaskState): void {
	const api = getToolActivationApi(pi);
	if (!api) return;
	try {
		const taskTools = configuredTaskTools(pi, api);
		const desired =
			Object.keys(state.tasks).length > 0
				? taskTools
				: TASK_ENTRYPOINT_NAMES.filter((name) => taskTools.includes(name));
		setTaskTools(pi, api, desired);
	} catch {
		// Older compatible hosts keep their existing all-tools behavior.
	}
}

function activateTaskTools(pi: ExtensionAPI): void {
	const api = getToolActivationApi(pi);
	if (!api) return;
	try {
		const taskTools = configuredTaskTools(pi, api);
		const active = api.getActiveTools();
		const added = taskTools.filter((name) => !active.includes(name));
		if (added.length > 0) api.setActiveTools([...active, ...added]);
	} catch {
		// Persistence succeeded; a legacy host must not turn that success into an error.
	}
}

export function registerTaskTools(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
	idGenerator = new SequentialIdGenerator(),
): void {
	registerGuidedTool<TaskPlanParams>(pi, {
		name: "task_plan",
		label: "Task Plan",
		description:
			"Create a structured pi-tasks task with objective and acceptance criteria.",
		promptSnippet:
			"Create a pi-tasks execution contract before non-trivial implementation work",
		promptGuidelines: [
			"Use task_plan for multi-step work before implementation when no suitable active task exists.",
			"Constrain the plan to the user's stated objective; do not add speculative scope, gates, or abstractions.",
			"Use concrete acceptance criteria; omit unknown generated criterion IDs or pass an empty criterionIds array during new task creation to auto-link all task criteria.",
			"Plan and decomposition steps are semantically assessed by the configured native host model; provide concrete text and expectedOutput, but do not self-score granularity.",
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
			plan_steps: Type.Optional(
				Type.Array(
					Type.Object({
						text: Type.String(),
						expectedOutput: Type.String(),
						criterionIds: Type.Optional(
							Type.Array(
								Type.String({
									description:
										"Known generated criterion IDs, for example T1-AC1. Omit or pass an empty array during new task creation to auto-link all criteria.",
								}),
							),
						),
						evidenceRequired: Type.Optional(Type.Boolean()),
						allowedActions: Type.Optional(Type.Array(Type.String())),
					}),
				),
			),
			priority: Type.Optional(Type.Enum(PRIORITIES)),
			tags: Type.Optional(Type.Array(Type.String())),
			activate: Type.Optional(
				Type.Boolean({ description: "Make this the active task" }),
			),
		}),
		execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
			const planSteps = planStepInputs(params.plan_steps, params.initial_steps);
			if (planSteps.length === 0) {
				return {
					...textResult(
						"Error: at least one ordered plan step is required",
						buildTaskResume(store.getState()),
					),
					isError: true,
				};
			}
			try {
				const run = await assessPlanSemantics(
					ctx,
					{
						title: params.title,
						objective: params.objective,
						acceptanceCriteria: params.acceptance_criteria,
						steps: planSteps,
					},
					signal,
				);
				const taskId = nextTaskId(store.getState());
				const event = baseEvent("task.created", taskId, ctx, {
					title: params.title,
					objective: params.objective,
					acceptanceCriteria: params.acceptance_criteria,
					activate: params.activate ?? true,
					planSteps,
					semanticAssessment: run.assessment,
					...(params.priority ? { priority: params.priority } : {}),
					...(params.tags ? { tags: params.tags } : {}),
				});
				return appendAndReport(
					pi,
					store,
					ctx,
					event,
					`Created task ${taskId}: ${params.title}`,
					() => activateTaskTools(pi),
					run.usage,
				);
			} catch (error) {
				return semanticAssessmentFailureResult(
					error,
					store.getState(),
					"task_plan",
				);
			}
		},
	});

	registerGuidedTool<Record<string, never>>(pi, {
		name: "task_next",
		label: "Task Next",
		description:
			"Return the single recommended next pi-tasks tool call for weak or small-context models.",
		promptSnippet:
			"Ask pi-tasks for the only next tool to call before continuing",
		promptGuidelines: [
			"Call task_next after rejection, compaction, branch navigation, or uncertainty.",
			"Smart models: treat the returned recommendation as the control contract; do not override it from memory or intuition.",
			"Weak models: call exactly the Only next tool with the shown minimum params; if a tool is blocked, do not call it.",
			"Follow Only next tool and Current step lock exactly.",
			"Do not call blocked tools listed by task_next.",
		],
		parameters: Type.Object({}),
		execute: async () =>
			textResult(
				formatTaskNext(store.getState()),
				buildTaskResume(store.getState()),
			),
	});

	registerGuidedTool<Record<string, never>>(pi, {
		name: "task_focus",
		label: "Task Focus",
		description:
			"Show the active task's current allowed step, expected output, linked criteria, required evidence, and drift warnings.",
		promptSnippet:
			"Inspect the current pi-tasks focus before acting, then work only on the active step",
		promptGuidelines: [
			"Call task_focus before implementation, verification, or step completion work.",
			"Smart models: compare intended work to the current step lock before acting; record drift before off-step work.",
			"Weak models: copy the current step ID, criterion IDs, and evidence IDs exactly into the next tool call.",
			"If Granularity is not atomic, follow the displayed next action; decompose below the depth limit, or explicitly block at the limit.",
			"If intended work does not match the active step, record scope_change or off_plan with task_update first.",
			"Use task_evidence before marking an evidence-required step done.",
		],
		parameters: Type.Object({}),
		execute: async () =>
			textResult(
				formatTaskFocus(store.getState()),
				buildTaskResume(store.getState()),
			),
	});

	registerGuidedTool<Record<string, never>>(pi, {
		name: "task_resume",
		label: "Task Resume",
		description:
			"Return the compact resume contract needed to continue work after context compaction or session resume.",
		promptSnippet:
			"Resume pi-tasks work from the current compact execution contract before acting",
		promptGuidelines: [
			"Call task_resume after context compaction, session resume, or when unsure what to do next.",
			"Smart models: trust the persisted resume contract after compaction; do not reconstruct stale plan state from memory.",
			"Weak models: read recommendedTool, blockedTools, and minimumParams, then call only the recommended tool.",
			"Follow next allowed actions; do not complete tasks while verification gaps remain.",
			"Use task_decompose when the resume instruction says the current step is not atomic; at maximum depth, use the displayed task_update blocker recovery instead.",
		],
		parameters: Type.Object({}),
		execute: async () => {
			if (Object.keys(store.getState().tasks).length > 0) {
				activateTaskTools(pi);
			}
			return textResult(
				formatTaskResume(store.getState()),
				buildTaskResume(store.getState()),
			);
		},
	});

	registerGuidedTool<TaskCheckpointParams>(pi, {
		name: "task_checkpoint",
		label: "Task Checkpoint",
		description:
			"Persist a compact pi-tasks snapshot with resume fields for compaction-safe continuation.",
		promptSnippet:
			"Create a pi-tasks checkpoint before risky context transitions or long pauses",
		promptGuidelines: [
			"Use task_checkpoint before long-running work, major decomposition changes, or when the user asks for a restartable handoff.",
			"Smart models: checkpoint only at real handoff or risk boundaries; do not use snapshots as proof of work.",
			"Weak models: provide at most a short reason, then continue with task_next or task_focus.",
			"Checkpoint is not evidence and does not satisfy acceptance criteria.",
		],
		parameters: Type.Object({
			reason: Type.Optional(Type.String()),
		}),
		execute: async (_toolCallId, params, _signal, _onUpdate, ctx) => {
			const state = store.getState();
			if (Object.keys(state.tasks).length === 0) {
				return textResult(
					"No pi-tasks state to checkpoint.",
					buildTaskResume(state),
				);
			}
			const event = baseEvent(
				"task.snapshot",
				state.activeTaskId ?? "snapshot",
				ctx,
				{
					state: snapshotState(state),
					resume: buildTaskResume(state),
					reason: "manual",
				},
			);
			return appendAndReport(
				pi,
				store,
				ctx,
				event,
				`Checkpointed pi-tasks state${params.reason ? `: ${params.reason}` : ""}`,
			);
		},
	});

	registerGuidedTool<TaskGranularityCheckParams>(pi, {
		name: "task_granularity_check",
		label: "Task Granularity Check",
		description:
			"Report whether a task step is atomic enough to execute or must be recursively decomposed.",
		promptSnippet:
			"Check whether the current pi-tasks step is atomic before implementation",
		promptGuidelines: [
			"Use this before implementation when task_focus shows a non-atomic step.",
			"Smart models: classify any hidden subtask, second output, or second verification method as non-atomic.",
			"Weak models: follow the returned next action; decompose below the depth limit, or block at the limit.",
			"Atomic means one agent action, one observable output, one verification method, and no hidden subtasks.",
			"If the step is not atomic, call task_decompose with smaller child steps unless the returned guidance says the maximum depth was reached.",
		],
		parameters: Type.Object({
			task_id: Type.Optional(Type.String()),
			step_id: Type.Optional(Type.String()),
		}),
		execute: async (_toolCallId, params) => {
			const state = store.getState();
			const task = selectTask(state, params.task_id);
			if (!task) {
				return {
					...textResult("Error: no active task", buildTaskResume(state)),
					isError: true,
				};
			}
			const step = selectStep(task, params.step_id);
			if (!step) {
				return {
					...textResult("Error: no matching open step", buildTaskResume(state)),
					isError: true,
				};
			}
			const check = step.granularityCheck;
			return textResult(
				[
					`Step: ${step.id} ${step.text}`,
					`Granularity: ${step.decompositionStatus}`,
					`Atomic: ${check.isAtomic}`,
					`One agent action: ${check.canBeDoneInOneAgentAction}`,
					`Single observable output: ${check.hasSingleObservableOutput}`,
					`Single verification method: ${check.hasSingleVerificationMethod}`,
					`No hidden subtasks: ${check.hasNoHiddenSubtasks}`,
					`Reason: ${check.reason}`,
					step.decompositionStatus === "atomic"
						? "Next allowed action: task_focus or execution work"
						: isAtMaximumDecompositionDepth(step)
							? `Next allowed action: task_update ${step.id} to blocked; maximum decomposition depth reached`
							: `Next allowed action: task_decompose ${step.id}`,
				].join("\n"),
				buildTaskResume(state),
			);
		},
	});

	registerGuidedTool<TaskDecomposeParams>(pi, {
		name: "task_decompose",
		label: "Task Decompose",
		description:
			"Replace a non-atomic plan step with smaller child steps until each executable step is atomic.",
		promptSnippet:
			"Recursively break down a non-atomic pi-tasks step into atomic child steps",
		promptGuidelines: [
			"Use task_decompose when task_focus or task_granularity_check says the current step needs breakdown.",
			"Smart models: preserve the parent objective and criteria; do not add unsolicited features or release gates.",
			"Make each child describe one intended operation with one observable output; copy criterionIds only from task_focus/task_resume.",
			"Each child step must include text and expectedOutput. evidenceRequired and allowedActions remain optional.",
			"Omit child step criterionIds or pass an empty array unless you are carrying forward known generated IDs from task_focus or task_resume; either form auto-links the parent criteria.",
			"The configured native host model assesses child specificity, atomicity, outputs, verification methods, and hidden subtasks.",
			"Do not use task_decompose for execution evidence; record execution evidence with task_evidence.",
			"At maximum decomposition depth, do not retry task_decompose; explicitly block the task and carry remaining scope into a flat successor task.",
		],
		parameters: Type.Object({
			task_id: Type.String(),
			step_id: Type.String(),
			reason: Type.String(),
			child_steps: Type.Array(
				Type.Object({
					text: Type.String(),
					expectedOutput: Type.String(),
					criterionIds: Type.Optional(
						Type.Array(
							Type.String({
								description:
									"Known generated criterion IDs from task_focus/task_resume. Omit to inherit all task criteria.",
							}),
						),
					),
					evidenceRequired: Type.Optional(Type.Boolean()),
					allowedActions: Type.Optional(Type.Array(Type.String())),
				}),
			),
		}),
		execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
			if (params.child_steps.length < 2) {
				return {
					...textResult(
						"Error: decomposition requires at least two child steps",
						buildTaskResume(store.getState()),
					),
					isError: true,
				};
			}
			const beforeTask = store.getState().tasks[params.task_id];
			const beforeStep = beforeTask?.planSteps.find(
				(step) => step.id === params.step_id,
			);
			if (!beforeTask || !beforeStep) {
				return {
					...textResult(
						`Error: plan step ${params.step_id} not found`,
						buildTaskResume(store.getState()),
					),
					isError: true,
				};
			}
			const beforeFingerprint = stepAssessmentFingerprint(beforeStep);
			try {
				const run = await assessPlanSemantics(
					ctx,
					{
						title: beforeTask.title,
						objective: beforeTask.objective,
						acceptanceCriteria: beforeTask.acceptanceCriteria.map(
							(criterion) => criterion.text,
						),
						steps: params.child_steps,
					},
					signal,
				);
				const currentStep = store
					.getState()
					.tasks[params.task_id]?.planSteps.find(
						(step) => step.id === params.step_id,
					);
				if (
					!currentStep ||
					stepAssessmentFingerprint(currentStep) !== beforeFingerprint
				) {
					return {
						...textResult(
							`Error: plan step ${params.step_id} changed while semantic assessment was running; retry task_decompose with current state`,
							buildTaskResume(store.getState()),
						),
						isError: true,
						...(run.usage ? { usage: run.usage } : {}),
					};
				}
				const event = baseEvent("task.steps_decomposed", params.task_id, ctx, {
					parentStepId: params.step_id,
					childSteps: params.child_steps,
					reason: params.reason,
					semanticAssessment: run.assessment,
				});
				return appendAndReport(
					pi,
					store,
					ctx,
					event,
					`Decomposed step ${params.step_id} for task ${params.task_id}`,
					undefined,
					run.usage,
				);
			} catch (error) {
				return semanticAssessmentFailureResult(
					error,
					store.getState(),
					"task_decompose",
				);
			}
		},
	});

	registerGuidedTool<TaskListParams>(pi, {
		name: "task_list",
		label: "Task List",
		description: "List pi-tasks tasks on the current session branch.",
		promptSnippet:
			"Inspect current pi-tasks task status, blockers, and verification gaps",
		promptGuidelines: [
			"Use task_list before resuming work after session reload or branch navigation.",
			"Smart models: use task_list for selection or debugging only, then switch to task_focus/task_next for execution control.",
			"Weak models: if an active task exists, do not choose manually from the list; call task_next.",
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
				buildTaskResume(filtered),
			);
		},
	});

	registerGuidedTool<TaskUpdateParams>(pi, {
		name: "task_update",
		label: "Task Update",
		description:
			"Update task progress, ordered plan step, status, next action, or blocker state.",
		promptSnippet:
			"Update pi-tasks progress, current ordered step, next action, status, or blocker details",
		promptGuidelines: [
			"Use step_id with step_status=done when the current planned step is finished.",
			"Smart models: record one state transition per call; do not bundle drift, evidence, and completion into one update.",
			"Weak models: use task_focus current step_id; for done, include step_evidence_ids when evidence was just recorded.",
			"Only atomic steps can be marked done; use task_decompose below the depth limit, or explicitly block at the limit.",
			"Evidence-required steps need linked evidence before step_status=done.",
			"Do not skip ahead; ordered plan steps must be completed or skipped in the displayed order.",
			"Use activity with scope=within_step, scope_change, or off_plan to document meaningful work and drift; setting scope requires activity, and scope_change/off_plan also require scope_reason.",
			"Use resolve_warnings to explicitly close scope drift warnings before task_complete.",
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
			activity: Type.Optional(
				Type.String({
					description:
						"Meaningful work performed; required whenever scope is provided.",
				}),
			),
			scope: Type.Optional(
				Type.Enum(["within_step", "scope_change", "off_plan"] as const, {
					description:
						"Activity classification; requires activity. scope_change and off_plan also require scope_reason.",
				}),
			),
			scope_reason: Type.Optional(
				Type.String({
					description:
						"Required for scope_change and off_plan; not required for within_step.",
				}),
			),
			note: Type.Optional(Type.String()),
			resolve_warnings: Type.Optional(Type.Array(Type.String())),
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
				...(params.activity !== undefined ? { activity: params.activity } : {}),
				...(params.scope !== undefined ? { scope: params.scope } : {}),
				...(params.scope_reason !== undefined
					? { scopeReason: params.scope_reason }
					: {}),
				...(params.note !== undefined ? { note: params.note } : {}),
				...(params.reason !== undefined ? { reason: params.reason } : {}),
				...(params.resolve_warnings !== undefined
					? { resolveWarnings: params.resolve_warnings }
					: {}),
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

	registerGuidedTool<TaskEvidenceParams>(pi, {
		name: "task_evidence",
		label: "Task Evidence",
		description:
			"Attach verification evidence to a task and optionally satisfy acceptance criteria.",
		promptSnippet:
			"Record verification evidence before claiming a task is complete",
		promptGuidelines: [
			"Use task_evidence for tests, commands, reviews, files, dogfood, or explicit user acceptance.",
			"Smart models: record the exact observed result; do not turn failed evidence into a note or hide it from linked step/criterion lineage.",
			"Weak models: copy task_focus IDs exactly; use passed=false for failed runs and passed=true only for observed passes.",
			"Passing non-note evidence must use a verification level stronger than not_verified.",
			"Attach criterion IDs when evidence proves specific acceptance criteria.",
			"Attach step_ids when evidence proves specific atomic steps, especially when multiple steps share the same criterion.",
			"When a passing rerun resolves prior linked failed evidence, set supersedes to the failed evidence IDs and link the rerun to the same step_ids/criterion_ids.",
			"Always provide references plus quality.source, quality.reproducible, quality.verifier, quality.command, quality.artifactRefs, and quality.observedOutput; for non-command evidence, quality.command should name the verification action.",
		],
		parameters: taskEvidenceParametersSchema(),
		execute: async (_toolCallId, params, signal, _onUpdate, ctx) => {
			const duplicate = findDuplicateEvidenceForParams(
				store.getState().tasks[params.task_id],
				params,
			);
			if (
				duplicate &&
				criteriaAlreadyLinked(store.getState(), params, duplicate)
			) {
				return textResult(
					`Evidence already recorded as ${duplicate.id} for task ${params.task_id}\n\n${formatTaskResume(store.getState())}`,
					buildTaskResume(store.getState()),
				);
			}
			const parsedPassed = parsePassed(params.passed);
			const draftEvent = evidenceEvent(params, "semantic-preflight", ctx);
			if (parsedPassed !== true) {
				try {
					reduceTaskState(store.getState(), draftEvent);
				} catch (error) {
					return rejectedMutationResult(error, store.getState(), draftEvent);
				}
				const evidenceId = idGenerator.next("E");
				return appendAndReport(
					pi,
					store,
					ctx,
					evidenceEvent(params, evidenceId, ctx),
					duplicate
						? `Linked existing evidence ${duplicate.id} for task ${params.task_id}`
						: `Recorded evidence ${evidenceId} for task ${params.task_id}`,
				);
			}
			try {
				reduceTaskState(store.getState(), { ...draftEvent, version: 1 });
			} catch (error) {
				return rejectedMutationResult(error, store.getState(), draftEvent);
			}
			try {
				const input = evidenceAssessmentInput(params);
				const run = await assessEvidenceSemantics(ctx, input, signal);
				const currentDuplicate = findDuplicateEvidenceForParams(
					store.getState().tasks[params.task_id],
					params,
				);
				if (
					currentDuplicate &&
					criteriaAlreadyLinked(store.getState(), params, currentDuplicate)
				) {
					return {
						...textResult(
							`Evidence already recorded as ${currentDuplicate.id} for task ${params.task_id}\n\n${formatTaskResume(store.getState())}`,
							buildTaskResume(store.getState()),
						),
						...(run.usage ? { usage: run.usage } : {}),
					};
				}
				const assessedDraftEvent = evidenceEvent(
					params,
					"semantic-preflight",
					ctx,
					run.assessment,
				);
				try {
					reduceTaskState(store.getState(), assessedDraftEvent);
				} catch (error) {
					return rejectedMutationResult(
						error,
						store.getState(),
						assessedDraftEvent,
						run.usage,
					);
				}
				const evidenceId = idGenerator.next("E");
				const event = evidenceEvent(params, evidenceId, ctx, run.assessment);
				const success = currentDuplicate
					? `Linked existing evidence ${currentDuplicate.id} for task ${params.task_id}`
					: `Recorded evidence ${evidenceId} for task ${params.task_id}`;
				return appendAndReport(
					pi,
					store,
					ctx,
					event,
					success,
					undefined,
					run.usage,
				);
			} catch (error) {
				return semanticAssessmentFailureResult(
					error,
					store.getState(),
					"task_evidence",
				);
			}
		},
	});

	registerGuidedTool<TaskDecisionParams>(pi, {
		name: "task_decision",
		label: "Task Decision",
		description:
			"Record a user or agent decision that affects task scope or implementation.",
		promptSnippet:
			"Record explicit decisions that affect pi-tasks scope, tradeoffs, or acceptance",
		promptGuidelines: [
			"Use task_decision for user-facing scope choices and meaningful agent tradeoffs.",
			"Smart models: record only durable choices that affect scope, tradeoffs, or implementation; do not log routine observations.",
			"Weak models: set question to the choice, decision to the selected option, and impact to what changes next.",
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

	registerGuidedTool<TaskCompleteParams>(pi, {
		name: "task_complete",
		label: "Task Complete",
		description:
			"Mark a task complete only after evidence and criteria support completion.",
		promptSnippet:
			"Complete a pi-tasks task only when acceptance criteria have evidence",
		promptGuidelines: [
			"Call task_complete only after task_evidence has recorded supporting evidence.",
			"Smart models: complete only after gaps are empty and all linked failures are superseded by later passing evidence.",
			"Weak models: copy evidence_ids from task_resume/task_focus; if rejected, call task_next instead of retrying the same call.",
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

function taskEvidenceParametersSchema() {
	return Type.Object({
		task_id: Type.String(),
		type: Type.Enum(EVIDENCE_TYPES),
		level: Type.Enum(VERIFICATION_LEVELS),
		summary: Type.String({
			maxLength: MAX_EVIDENCE_SUMMARY_LENGTH,
			description: `Concise evidence summary, at most ${MAX_EVIDENCE_SUMMARY_LENGTH} characters; store long output in an artifact and reference it via quality.artifactRefs`,
		}),
		passed: Type.Enum(["true", "false", "unknown"] as const),
		references: Type.Array(
			Type.String({
				maxLength: MAX_EVIDENCE_REFERENCE_LENGTH,
				description: `Artifact path or command reference, at most ${MAX_EVIDENCE_REFERENCE_LENGTH} characters`,
			}),
		),
		criterion_ids: Type.Optional(Type.Array(Type.String())),
		step_ids: Type.Optional(Type.Array(Type.String())),
		supersedes: Type.Optional(
			Type.Array(
				Type.String({
					description:
						"Prior failed evidence IDs resolved by this passing rerun; rerun must link the same step_ids/criterion_ids.",
				}),
			),
		),
		quality: evidenceQualitySchema(),
		override_reason: Type.Optional(
			Type.String({
				description:
					"Required only when attaching evidence outside the current step lock.",
			}),
		),
	});
}

function evidenceQualitySchema() {
	return Type.Object({
		source: Type.String({
			maxLength: MAX_EVIDENCE_REFERENCE_LENGTH,
			description: `Evidence source, at most ${MAX_EVIDENCE_REFERENCE_LENGTH} characters`,
		}),
		reproducible: Type.Boolean(),
		verifier: Type.Enum(["agent", "tool", "user", "external"] as const),
		command: Type.String({
			maxLength: MAX_EVIDENCE_REFERENCE_LENGTH,
			description: `Exact command or verification action, at most ${MAX_EVIDENCE_REFERENCE_LENGTH} characters; store a longer command in an artifact and reference it via artifactRefs`,
		}),
		artifactRefs: Type.Array(
			Type.String({
				maxLength: MAX_EVIDENCE_REFERENCE_LENGTH,
				description: `Artifact reference, at most ${MAX_EVIDENCE_REFERENCE_LENGTH} characters`,
			}),
		),
		observedOutput: Type.String({
			maxLength: MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH,
			description: `Concise observed output, at most ${MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH} characters; store long logs in an artifact and reference it via artifactRefs`,
		}),
	});
}

function planStepInputs(
	planSteps: SemanticTaskStepInput[] | undefined,
	initialSteps: string[] | undefined,
): TaskStepInput[] {
	if (planSteps) {
		return planSteps.map((step) => ({
			text: step.text,
			expectedOutput: step.expectedOutput,
			...(step.criterionIds ? { criterionIds: step.criterionIds } : {}),
			...(step.evidenceRequired !== undefined
				? { evidenceRequired: step.evidenceRequired }
				: {}),
			...(step.allowedActions ? { allowedActions: step.allowedActions } : {}),
		}));
	}
	return (initialSteps ?? []).map((text) => ({
		text,
		expectedOutput: `Verified output for: ${text}`,
		evidenceRequired: true,
		allowedActions: [],
	}));
}

function evidenceAssessmentInput(
	params: TaskEvidenceParams,
): EvidenceAssessmentInput {
	return {
		type: params.type,
		level: params.level,
		summary: params.summary,
		references: params.references,
		quality: params.quality,
	};
}

function evidenceEvent(
	params: TaskEvidenceParams,
	evidenceId: string,
	ctx: ExtensionContext,
	semanticAssessment?: EvidenceSemanticAssessment,
): Extract<TaskEvent, { type: "task.evidence_added" }> {
	return baseEvent("task.evidence_added", params.task_id, ctx, {
		evidence: {
			id: evidenceId,
			type: params.type,
			level: params.level,
			summary: params.summary,
			passed: parsePassed(params.passed),
			references: params.references,
			quality: params.quality,
			...(params.supersedes ? { supersedes: params.supersedes } : {}),
		},
		...(semanticAssessment ? { semanticAssessment } : {}),
		...(params.criterion_ids ? { criterionIds: params.criterion_ids } : {}),
		...(params.step_ids ? { stepIds: params.step_ids } : {}),
		...(params.override_reason
			? { overrideReason: params.override_reason }
			: {}),
	});
}

function stepAssessmentFingerprint(step: Task["planSteps"][number]): string {
	return JSON.stringify({
		id: step.id,
		text: step.text,
		expectedOutput: step.expectedOutput,
		status: step.status,
		decompositionStatus: step.decompositionStatus,
		depth: step.depth,
		childStepIds: step.childStepIds,
		criterionIds: step.criterionIds,
	});
}

function semanticAssessmentFailureResult(
	error: unknown,
	state: TaskState,
	retryWith: "task_plan" | "task_decompose" | "task_evidence",
): ToolResult {
	const assessmentError =
		error instanceof SemanticAssessmentError ? error : undefined;
	const reason = assessmentError?.message ?? errorText(error);
	const resume = buildTaskResume(state);
	const details = {
		rejected: true,
		reason,
		retry_with: retryWith,
		do_not_retry_same_call: assessmentError?.code !== "aborted",
		native_model_required: true,
		resume,
	};
	return {
		...textResult(
			[
				`Error: ${reason}`,
				"",
				"Semantic assessment recovery:",
				`- retry_with: ${retryWith}`,
				`- native_model_required: true`,
				`- do_not_retry_same_call: ${details.do_not_retry_same_call}`,
				"- no_regex_fallback: true",
				"",
				"Configure or restore a native Pi/Oh My Pi model capability, then retry the rejected mutation.",
			].join("\n"),
			details,
		),
		isError: true,
		...(assessmentError?.usage ? { usage: assessmentError.usage } : {}),
	};
}

function rejectedMutationResult(
	error: unknown,
	state: TaskState,
	event: TaskEvent,
	usage?: ModelUsage,
): ToolResult {
	const resumeText = formatTaskResume(state);
	const recovery = buildRejectionRecovery(error, state, event);
	return {
		...textResult(
			[
				`Error: ${errorText(error)}`,
				"",
				"Recovery:",
				`- retry_with: ${recovery.retry_with}`,
				`- minimum_params: ${JSON.stringify(recovery.minimum_params)}`,
				`- do_not_retry_same_call: ${recovery.do_not_retry_same_call}`,
				`- reason: ${recovery.reason}`,
				...(recovery.retry_example
					? [
							"",
							"task_evidence retry template (replace angle-bracket placeholders with observed values):",
							"```json",
							JSON.stringify(recovery.retry_example, null, 2),
							"```",
						]
					: []),
				"",
				...(!recovery.correct_rejected_call_first &&
				recovery.retry_with === recovery.resume.recommendedTool
					? ["Recovery guidance:", resumeText]
					: [
							"Recovery guidance: correct the rejected call above, then call task_resume for the next task action.",
						]),
			].join("\n"),
			recovery,
		),
		isError: true,
		...(usage ? { usage } : {}),
	};
}

function appendAndReport(
	pi: ExtensionAPI,
	store: TaskRuntimeStore,
	ctx: ExtensionContext,
	event: TaskEvent,
	success: string,
	onPersisted?: () => void,
	usage?: ModelUsage,
): ToolResult {
	try {
		const state = store.append(event, (customType, data) => {
			pi.appendEntry(customType, data);
		});
		updateTaskUi(pi, ctx, state, "task_mutation");
		onPersisted?.();
		const warning =
			event.type === "task.completed" && event.forceWithReason
				? `\nWarning: forced completion: ${event.forceWithReason}`
				: "";
		return {
			...textResult(
				`${success}${warning}\n\n${formatTaskResume(state)}`,
				buildTaskResume(state),
			),
			...(usage ? { usage } : {}),
		};
	} catch (error) {
		return rejectedMutationResult(error, store.getState(), event, usage);
	}
}

function buildRejectionRecovery(
	error: unknown,
	state: TaskState,
	event?: TaskEvent,
) {
	const resume = buildTaskResume(state);
	const retryExample = buildEvidenceRetryExample(event);
	const scopeRecovery = buildScopeUpdateRecovery(error, event);
	return {
		rejected: true,
		reason: errorText(error),
		retry_with:
			scopeRecovery?.retry_with ??
			resume.recommendedTool ??
			resume.nextAllowedActions[0] ??
			"task_resume",
		minimum_params: scopeRecovery?.minimum_params ?? resume.minimumParams ?? {},
		correct_rejected_call_first: scopeRecovery !== undefined,
		do_not_retry_same_call: true,
		...(retryExample ? { retry_example: retryExample } : {}),
		resume,
	};
}

function buildScopeUpdateRecovery(
	error: unknown,
	event: TaskEvent | undefined,
):
	| {
			retry_with: "task_update";
			minimum_params: Record<string, unknown>;
	  }
	| undefined {
	if (
		!(error instanceof TaskTransitionError) ||
		event?.type !== "task.updated"
	) {
		return undefined;
	}
	if (error.code === "scope_activity_required") {
		return {
			retry_with: "task_update",
			minimum_params: {
				task_id: event.taskId,
				activity: "<meaningful activity performed>",
				...(event.scope ? { scope: event.scope } : {}),
				...(event.scope === "scope_change" || event.scope === "off_plan"
					? {
							scope_reason:
								event.scopeReason?.trim() ||
								"<why this scope change or off-plan activity was necessary>",
						}
					: {}),
			},
		};
	}
	if (error.code === "scope_reason_required") {
		return {
			retry_with: "task_update",
			minimum_params: {
				task_id: event.taskId,
				activity: event.activity?.trim() || "<meaningful activity performed>",
				scope: event.scope,
				scope_reason:
					"<why this scope change or off-plan activity was necessary>",
			},
		};
	}
	return undefined;
}

function buildEvidenceRetryExample(
	event: TaskEvent | undefined,
): Record<string, unknown> | undefined {
	if (event?.type !== "task.evidence_added") return undefined;
	if (
		event.evidence.type !== "command" &&
		event.evidence.type !== "test" &&
		event.evidence.type !== "dogfood"
	) {
		return undefined;
	}
	const referencePlaceholder = "<short-artifact-or-command-reference>";
	const references =
		event.evidence.references.length > 0
			? event.evidence.references.map((reference) =>
					boundedRetryText(
						reference,
						MAX_EVIDENCE_REFERENCE_LENGTH,
						referencePlaceholder,
					),
				)
			: [referencePlaceholder];
	const originalArtifactRefs = event.evidence.quality?.artifactRefs;
	const artifactRefs =
		originalArtifactRefs && originalArtifactRefs.length > 0
			? originalArtifactRefs.map((artifactRef) =>
					boundedRetryText(
						artifactRef,
						MAX_EVIDENCE_REFERENCE_LENGTH,
						"<short-artifact-reference>",
					),
				)
			: references;
	const originalCommand = event.evidence.quality?.command?.trim();
	const command = originalCommand
		? boundedRetryText(
				originalCommand,
				MAX_EVIDENCE_REFERENCE_LENGTH,
				"<exact verification command or action; full command in artifactRefs>",
			)
		: "<exact verification command or action>";
	const quality: Record<string, unknown> = {
		source: boundedRetryText(
			event.evidence.quality?.source,
			MAX_EVIDENCE_REFERENCE_LENGTH,
			"<concise evidence source>",
		),
		reproducible: true,
		verifier: event.evidence.quality?.verifier ?? "tool",
		command,
		artifactRefs,
		observedOutput: boundedRetryText(
			event.evidence.quality?.observedOutput,
			MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH,
			"<concise observed output from the command/test/dogfood run>",
		),
	};
	const example: Record<string, unknown> = {
		task_id: event.taskId,
		type: event.evidence.type,
		level: event.evidence.level,
		summary: boundedRetryText(
			event.evidence.summary,
			MAX_EVIDENCE_SUMMARY_LENGTH,
			"<concise evidence summary; put long output in quality.artifactRefs>",
		),
		passed: String(event.evidence.passed),
		references,
		quality,
	};
	if (event.criterionIds) example.criterion_ids = event.criterionIds;
	if (event.stepIds) example.step_ids = event.stepIds;
	if (event.evidence.supersedes) example.supersedes = event.evidence.supersedes;
	if (event.overrideReason) example.override_reason = event.overrideReason;
	return example;
}

function boundedRetryText(
	value: string | undefined,
	maxLength: number,
	placeholder: string,
): string {
	const normalized = value?.trim();
	return normalized && normalized.length <= maxLength
		? normalized
		: placeholder;
}

function selectTask(state: TaskState, taskId?: string): Task | undefined {
	if (taskId) return state.tasks[taskId];
	return state.activeTaskId ? state.tasks[state.activeTaskId] : undefined;
}

function nextTaskId(state: TaskState): string {
	const maxId = Object.keys(state.tasks).reduce((max, id) => {
		const match = /^T(\d+)$/.exec(id);
		return match ? Math.max(max, Number(match[1])) : max;
	}, 0);
	return `T${maxId + 1}`;
}

function selectStep(
	task: Task,
	stepId?: string,
): Task["planSteps"][number] | undefined {
	if (stepId) return task.planSteps.find((step) => step.id === stepId);
	return task.planSteps.find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
}

function baseEvent<TType extends TaskEvent["type"]>(
	type: TType,
	taskId: string,
	_ctx: ExtensionContext,
	payload: Omit<
		Extract<TaskEvent, { type: TType }>,
		"version" | "id" | "type" | "taskId" | "createdAt" | "source"
	>,
): Extract<TaskEvent, { type: TType }> {
	const createdAt = new Date().toISOString();
	return {
		version: 2,
		id: createEventId(taskId, createdAt, type),
		type,
		taskId,
		createdAt,
		source: "tool",
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
				normalizedReferences(references) &&
			normalizedReferences(evidence.supersedes ?? []) ===
				normalizedReferences(params.supersedes ?? []),
	);
}

function criteriaAlreadyLinked(
	state: TaskState,
	params: TaskEvidenceParams,
	evidence: TaskEvidence,
): boolean {
	const task = state.tasks[params.task_id];
	if (!task) return false;
	const criteriaLinked = (params.criterion_ids ?? []).every((criterionId) =>
		task.acceptanceCriteria
			.find((criterion) => criterion.id === criterionId)
			?.evidenceIds.includes(evidence.id),
	);
	const stepsLinked = (params.step_ids ?? []).every((stepId) =>
		task.planSteps
			.find((step) => step.id === stepId)
			?.evidenceIds.includes(evidence.id),
	);
	return criteriaLinked && stepsLinked;
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
