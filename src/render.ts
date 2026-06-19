import type { Task, TaskState, TaskStatus } from "./model.ts";

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
				`  - ${step.id} step [${step.status}] ${step.text}${step.evidenceIds.length ? ` evidence:${step.evidenceIds.join(",")}` : ""}`,
		);
		const decisions = task.decisions.map(
			(decision) =>
				`  - ${decision.id} decision [${decision.decidedBy}] ${decision.question}: ${decision.decision}${decision.rationale ? `; rationale: ${decision.rationale}` : ""}`,
		);
		return [
			summary,
			...blockerLines,
			...decisions,
			...planSteps,
			...task.acceptanceCriteria.map(
				(criterion) =>
					`  - ${criterion.id} [${criterion.status}] ${criterion.text}${criterion.evidenceIds.length ? ` evidence:${criterion.evidenceIds.join(",")}` : ""}`,
			),
			...task.evidence.map(
				(item) =>
					`  - ${item.id} evidence ${item.level} ${item.passed}: ${item.summary}${item.references.length ? ` (${item.references.join(", ")})` : ""}`,
			),
		];
	});
	const warnings =
		state.warnings.length > 0
			? ["", "Warnings:", ...state.warnings.map((warning) => `- ${warning}`)]
			: [];
	return [...lines, ...warnings].join("\n");
}

export function getVerificationGaps(task: Task): string[] {
	const gaps: string[] = [];
	const incompleteStep = (task.planSteps ?? []).find(
		(step) => step.status !== "done" && step.status !== "skipped",
	);
	if (incompleteStep) gaps.push(`${incompleteStep.id} step pending`);
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
