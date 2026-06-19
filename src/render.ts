import type {
	Task,
	TaskResumeContext,
	TaskResumeStep,
	TaskState,
	TaskStatus,
	TaskStep,
} from "./model.ts";

const STATUS_ORDER: TaskStatus[] = [
	"active",
	"blocked",
	"review",
	"pending",
	"done",
	"cancelled",
];

export function truncateText(text: string, maxWidth: number): string {
	if (maxWidth <= 0) return "";
	if (text.length <= maxWidth) return text;
	if (maxWidth === 1) return "…";
	return `${text.slice(0, maxWidth - 1)}…`;
}

export function formatStatusText(
	state: TaskState,
	maxWidth = 80,
): string | undefined {
	const active = state.activeTaskId
		? state.tasks[state.activeTaskId]
		: undefined;
	if (!active) return undefined;
	const marker =
		active.status === "blocked"
			? "blocked"
			: `${active.status} ${active.progress}%`;
	return truncateText(
		`Task ${active.id} ${marker} - ${active.nextAction ?? active.title}`,
		maxWidth,
	);
}

export function formatWidgetLines(
	state: TaskState,
	maxWidth = 80,
): string[] | undefined {
	const active = state.activeTaskId
		? state.tasks[state.activeTaskId]
		: undefined;
	if (!active) return undefined;
	const gaps = getVerificationGaps(active);
	const lines = [
		`Active task: ${active.id} ${active.title}`,
		`Progress: ${active.progress}% | ${active.status} | Next: ${active.nextAction ?? "unset"}`,
		`Criteria: ${countCriteria(active, "satisfied")}/${active.acceptanceCriteria.length} satisfied | Evidence: ${active.evidence.length}`,
	];
	if (active.blockers.some((blocker) => !blocker.resolvedAt)) {
		lines.push(
			`Blocked: ${active.blockers.find((blocker) => !blocker.resolvedAt)?.reason ?? "unresolved blocker"}`,
		);
	}
	if (gaps.length > 0) lines.push(`Gaps: ${gaps.join("; ")}`);
	return lines.slice(0, 5).map((line) => truncateText(line, maxWidth));
}

export function formatTaskList(
	state: TaskState,
	options: {
		includeDone?: boolean;
		includeEvidence?: boolean;
		limit?: number;
	} = {},
): string {
	const tasks = sortTasks(
		Object.values(state.tasks),
		state.activeTaskId,
	).filter((task) => options.includeDone || task.status !== "done");
	const limited = tasks.slice(0, options.limit ?? 20);
	if (limited.length === 0) return "No tasks on this branch.";
	const lines = limited.flatMap((task) => {
		const unresolvedBlockerCount = task.blockers.filter(
			(blocker) => !blocker.resolvedAt,
		).length;
		const criteria = `${countCriteria(task, "satisfied")}/${task.acceptanceCriteria.length}`;
		const evidence = options.includeEvidence
			? ` evidence:${task.evidence.length}`
			: "";
		const blockerText =
			unresolvedBlockerCount > 0 ? ` blockers:${unresolvedBlockerCount}` : "";
		const summary = `${task.id} [${task.status}] ${task.progress}% criteria:${criteria}${evidence}${blockerText} - ${task.title}`;
		if (!options.includeEvidence) return [summary];
		const blockerLines = task.blockers.map(
			(blocker) =>
				`  - blocker ${blocker.id} [${blocker.resolvedAt ? "resolved" : blocker.blockedBy}] ${blocker.reason}; unblock: ${blocker.neededToUnblock}`,
		);
		const planSteps = (task.planSteps ?? []).map(
			(step) =>
				`  - ${step.id} step [${step.status}/${step.decompositionStatus}] ${step.text}; output: ${step.expectedOutput}${step.parentStepId ? `; parent:${step.parentStepId}` : ""}; atomic:${step.granularityCheck.isAtomic}; planQuality:${step.planQuality.score}${step.planQuality.issues.length ? ` (${step.planQuality.issues.join("; ")})` : ""}${step.evidenceRequired ? "; evidence required" : ""}${step.criterionIds.length ? `; criteria:${step.criterionIds.join(",")}` : ""}${step.evidenceIds.length ? `; evidence:${step.evidenceIds.join(",")}` : ""}`,
		);
		const decisions = task.decisions.map(
			(decision) =>
				`  - ${decision.id} decision [${decision.decidedBy}] ${decision.question}: ${decision.decision}${decision.rationale ? `; rationale: ${decision.rationale}` : ""}`,
		);
		return [
			summary,
			...task.warnings.map((warning) => `  - warning ${warning}`),
			...blockerLines,
			...decisions,
			...planSteps,
			...task.acceptanceCriteria.map(
				(criterion) =>
					`  - ${criterion.id} [${criterion.status}] ${criterion.text}${criterion.evidenceIds.length ? ` evidence:${criterion.evidenceIds.join(",")}` : ""}`,
			),
			...task.evidence.map(
				(item) =>
					`  - ${item.id} evidence ${item.level} ${item.passed}: ${item.summary}; source:${item.quality.source}; reproducible:${item.quality.reproducible}${item.references.length ? ` (${item.references.join(", ")})` : ""}`,
			),
		];
	});
	const warnings =
		state.warnings.length > 0
			? ["", "Warnings:", ...state.warnings.map((warning) => `- ${warning}`)]
			: [];
	return [...lines, ...warnings].join("\n");
}

export function formatTaskFocus(state: TaskState): string {
	const task = state.activeTaskId ? state.tasks[state.activeTaskId] : undefined;
	if (!task) return "No active pi-tasks task. Create one with task_plan.";
	const step = (task.planSteps ?? []).find(
		(item) => item.status !== "done" && item.status !== "skipped",
	);
	const lines = [
		`Active task: ${task.id} ${task.title}`,
		`Status: ${task.status} ${task.progress}%`,
	];
	if (!step) {
		lines.push("Current step: none open");
	} else {
		lines.push(`Current step: ${step.id} [${step.status}] ${step.text}`);
		lines.push(`Granularity: ${step.decompositionStatus}`);
		lines.push(`Atomicity reason: ${step.granularityCheck.reason}`);
		lines.push(
			`Plan quality: ${step.planQuality.score}${step.planQuality.issues.length ? ` (${step.planQuality.issues.join("; ")})` : ""}`,
		);
		if (step.parentStepId) lines.push(`Parent step: ${step.parentStepId}`);
		lines.push(`Expected output: ${step.expectedOutput}`);
		lines.push(
			`Evidence: ${step.evidenceIds.length ? step.evidenceIds.join(",") : "none"}${step.evidenceRequired ? " (required)" : ""}`,
		);
		if (step.criterionIds.length > 0) {
			lines.push(`Linked criteria: ${step.criterionIds.join(",")}`);
		}
		if (step.allowedActions.length > 0) {
			lines.push(`Allowed actions: ${step.allowedActions.join(", ")}`);
		}
		if (step.decompositionStatus !== "atomic") {
			lines.push(`Next allowed action: task_decompose ${step.id}`);
		}
	}
	const gaps = getVerificationGaps(task);
	if (gaps.length > 0) lines.push(`Gaps: ${gaps.join("; ")}`);
	if (task.warnings.length > 0) {
		lines.push("Warnings:");
		lines.push(...task.warnings.map((warning) => `- ${warning}`));
	}
	return lines.join("\n");
}

export function buildTaskResume(state: TaskState): TaskResumeContext {
	const task = state.activeTaskId ? state.tasks[state.activeTaskId] : undefined;
	if (!task) {
		return {
			currentStepLineage: [],
			evidenceIds: [],
			criterionIds: [],
			allowedActions: [],
			nextAllowedActions: ["task_plan"],
			verificationGaps: [],
			blockers: [],
			decisions: [],
			warnings: [...state.warnings],
			resumeInstruction:
				"No active pi-tasks task. Create one with task_plan before implementation work.",
		};
	}
	const step = getCurrentOpenStep(task);
	const gaps = getVerificationGaps(task);
	const blockers = task.blockers
		.filter((blocker) => !blocker.resolvedAt)
		.map((blocker) => `${blocker.id}: ${blocker.reason}`);
	const decisions = task.decisions
		.slice(-3)
		.map(
			(decision) =>
				`${decision.id}: ${decision.question} -> ${decision.decision}`,
		);
	const nextAllowedActions = step
		? getNextAllowedActions(step, blockers.length > 0)
		: ["task_complete"];
	return {
		...(state.activeTaskId ? { activeTaskId: state.activeTaskId } : {}),
		taskId: task.id,
		title: task.title,
		status: task.status,
		progress: task.progress,
		...(step
			? {
					currentStepId: step.id,
					currentStepText: step.text,
					currentStepLineage: getStepLineage(task, step),
					expectedOutput: step.expectedOutput,
					evidenceRequired: step.evidenceRequired,
					evidenceIds: [...step.evidenceIds],
					criterionIds: [...step.criterionIds],
					allowedActions: [...step.allowedActions],
				}
			: {
					currentStepLineage: [],
					evidenceIds: [],
					criterionIds: [],
					allowedActions: [],
				}),
		nextAllowedActions,
		verificationGaps: gaps,
		blockers,
		decisions,
		warnings: [...state.warnings, ...task.warnings],
		resumeInstruction: buildResumeInstruction(
			task,
			step,
			gaps,
			nextAllowedActions,
		),
	};
}

export function formatTaskResume(state: TaskState): string {
	const resume = buildTaskResume(state);
	const lines = ["pi-tasks resume"];
	if (!resume.taskId) {
		lines.push(`Instruction: ${resume.resumeInstruction}`);
		return lines.join("\n");
	}
	lines.push(
		`Task: ${resume.taskId} [${resume.status}] ${resume.progress}% - ${resume.title}`,
	);
	if (resume.currentStepId) {
		lines.push(
			`Current step: ${resume.currentStepId} ${resume.currentStepText ?? ""}`,
		);
		if (resume.currentStepLineage.length > 0) {
			lines.push(
				`Lineage: ${resume.currentStepLineage.map((step) => `${step.id}:${step.decompositionStatus}`).join(" > ")}`,
			);
		}
		if (resume.expectedOutput) {
			lines.push(`Expected output: ${resume.expectedOutput}`);
		}
		lines.push(
			`Evidence: ${resume.evidenceIds.length ? resume.evidenceIds.join(",") : "none"}${resume.evidenceRequired ? " (required)" : ""}`,
		);
		if (resume.criterionIds.length > 0) {
			lines.push(`Linked criteria: ${resume.criterionIds.join(",")}`);
		}
		if (resume.allowedActions.length > 0) {
			lines.push(`Allowed actions: ${resume.allowedActions.join(", ")}`);
		}
	} else {
		lines.push("Current step: none open");
	}
	lines.push(`Next allowed actions: ${resume.nextAllowedActions.join(", ")}`);
	if (resume.verificationGaps.length > 0) {
		lines.push(`Cannot complete yet: ${resume.verificationGaps.join("; ")}`);
	}
	if (resume.blockers.length > 0) {
		lines.push(`Blockers: ${resume.blockers.join("; ")}`);
	}
	if (resume.decisions.length > 0) {
		lines.push(`Recent decisions: ${resume.decisions.join("; ")}`);
	}
	if (resume.warnings.length > 0) {
		lines.push(`Warnings: ${resume.warnings.join("; ")}`);
	}
	lines.push(`Instruction: ${resume.resumeInstruction}`);
	return lines.join("\n");
}

export function getVerificationGaps(task: Task): string[] {
	const gaps: string[] = [];
	const incompleteStep = (task.planSteps ?? []).find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
	if (incompleteStep) gaps.push(`${incompleteStep.id} step pending`);
	for (const step of task.planSteps ?? []) {
		if (
			step.status !== "done" &&
			step.status !== "skipped" &&
			step.decompositionStatus !== "atomic"
		) {
			gaps.push(`${step.id} needs breakdown`);
		}
	}
	for (const step of task.planSteps ?? []) {
		if (
			step.evidenceRequired &&
			(step.status === "done" || step.status === "skipped") &&
			step.evidenceIds.length === 0
		) {
			gaps.push(`${step.id} lacks evidence`);
		}
	}
	for (const criterion of task.acceptanceCriteria) {
		if (criterion.status !== "satisfied" && criterion.status !== "skipped")
			gaps.push(`${criterion.id} pending`);
		if (criterion.status === "satisfied" && criterion.evidenceIds.length === 0)
			gaps.push(`${criterion.id} lacks evidence`);
	}
	if (task.evidence.length === 0) gaps.push("no evidence");
	if (
		task.evidence.length > 0 &&
		task.evidence.every((evidence) => evidence.level === "not_verified")
	) {
		gaps.push("only not_verified evidence");
	}
	return gaps;
}

function getCurrentOpenStep(task: Task): TaskStep | undefined {
	return task.planSteps.find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
}

function getNextAllowedActions(step: TaskStep, hasBlockers: boolean): string[] {
	if (hasBlockers) return ["task_update"];
	if (step.decompositionStatus !== "atomic") {
		return ["task_decompose", "task_decision", "task_update"];
	}
	if (step.evidenceRequired && step.evidenceIds.length === 0) {
		return [...step.allowedActions, "task_evidence"].filter(Boolean);
	}
	return ["task_update", "task_evidence", ...step.allowedActions].filter(
		Boolean,
	);
}

function getStepLineage(task: Task, step: TaskStep): TaskResumeStep[] {
	const lineage: TaskResumeStep[] = [];
	let current: TaskStep | undefined = step;
	while (current) {
		lineage.unshift({
			id: current.id,
			text: current.text,
			status: current.status,
			decompositionStatus: current.decompositionStatus,
		});
		if (!current.parentStepId) break;
		const parent = task.planSteps.find(
			(candidate) => candidate.id === current?.parentStepId,
		);
		if (!parent) {
			lineage.unshift({
				id: current.parentStepId,
				text: "decomposed parent step",
				status: "done",
				decompositionStatus: "breaking_down",
			});
			break;
		}
		current = parent;
	}
	return lineage;
}

function buildResumeInstruction(
	task: Task,
	step: TaskStep | undefined,
	gaps: string[],
	nextAllowedActions: string[],
): string {
	if (task.status === "blocked") {
		return "Resolve the blocker with task_update before continuing execution.";
	}
	if (!step) {
		return gaps.length > 0
			? "No open step remains, but verification gaps remain. Resolve gaps before task_complete."
			: "No open step remains. Use task_complete with supporting evidence.";
	}
	if (step.decompositionStatus !== "atomic") {
		return `Resume by decomposing ${step.id}; do not execute or mark it done until it is atomic.`;
	}
	if (step.evidenceRequired && step.evidenceIds.length === 0) {
		return `Resume ${step.id} by performing one allowed action, then record step-scoped evidence with task_evidence.step_ids before task_update done.`;
	}
	return `Resume ${step.id} with ${nextAllowedActions.join(" or ")}; keep ordered step progression.`;
}

function countCriteria(
	task: Task,
	status: Task["acceptanceCriteria"][number]["status"],
): number {
	return task.acceptanceCriteria.filter(
		(criterion) => criterion.status === status,
	).length;
}

function sortTasks(tasks: Task[], activeTaskId?: string): Task[] {
	return [...tasks].sort((a, b) => {
		if (a.id === activeTaskId) return -1;
		if (b.id === activeTaskId) return 1;
		const statusDelta =
			STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
		if (statusDelta !== 0) return statusDelta;
		return a.createdAt.localeCompare(b.createdAt);
	});
}
