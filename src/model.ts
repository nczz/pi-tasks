export const TASK_EVENT_CUSTOM_TYPE = "pi-tasks:event";
export const TASK_SNAPSHOT_CUSTOM_TYPE = "pi-tasks:snapshot";

export type TaskStatus =
	| "pending"
	| "active"
	| "blocked"
	| "review"
	| "done"
	| "cancelled";
export type TaskPriority = "low" | "normal" | "high" | "urgent";
export type TaskStepStatus = "pending" | "active" | "done" | "skipped";

export type VerificationLevel =
	| "not_verified"
	| "static_read"
	| "unit_test"
	| "integration_test"
	| "e2e_smoke"
	| "release_grade_e2e"
	| "pi_dogfood"
	| "external_unverified";

export type EvidenceType =
	| "test"
	| "command"
	| "review"
	| "file"
	| "commit"
	| "dogfood"
	| "user_acceptance"
	| "external"
	| "note";

export interface TaskEvidence {
	id: string;
	taskId: string;
	type: EvidenceType;
	level: VerificationLevel;
	summary: string;
	passed: boolean | "unknown";
	references: string[];
	createdAt: string;
}

export interface AcceptanceCriterion {
	id: string;
	text: string;
	status: "pending" | "satisfied" | "failed" | "skipped";
	evidenceIds: string[];
	note?: string;
}

export interface TaskDecision {
	id: string;
	taskId: string;
	question: string;
	decision: string;
	decidedBy: "user" | "agent";
	rationale?: string;
	impact?: string;
	createdAt: string;
}

export interface TaskBlocker {
	id: string;
	taskId: string;
	reason: string;
	blockedBy: "user" | "external" | "environment" | "dependency" | "ambiguity";
	neededToUnblock: string;
	since: string;
	resolvedAt?: string;
}

export interface TaskStep {
	id: string;
	taskId: string;
	text: string;
	expectedOutput: string;
	status: TaskStepStatus;
	evidenceIds: string[];
	criterionIds: string[];
	evidenceRequired: boolean;
	allowedActions: string[];
	note?: string;
	startedAt?: string;
	completedAt?: string;
}

export interface TaskStepInput {
	text: string;
	expectedOutput: string;
	criterionIds?: string[];
	evidenceRequired?: boolean;
	allowedActions?: string[];
}

export interface Task {
	id: string;
	title: string;
	objective: string;
	status: TaskStatus;
	priority: TaskPriority;
	progress: number;
	currentStep?: string;
	nextAction?: string;
	planSteps: TaskStep[];
	acceptanceCriteria: AcceptanceCriterion[];
	evidence: TaskEvidence[];
	decisions: TaskDecision[];
	blockers: TaskBlocker[];
	parentId?: string;
	dependencies: string[];
	tags: string[];
	linkedFiles: string[];
	linkedCommits: string[];
	confidence?: number;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
	cancelledAt?: string;
	completionSummary?: string;
	warnings: string[];
}

export interface TaskState {
	tasks: Record<string, Task>;
	activeTaskId?: string;
	events: TaskEvent[];
	lastUpdatedAt?: string;
	warnings: string[];
}

export interface TaskEventBase {
	version: 1;
	id: string;
	type: string;
	taskId: string;
	createdAt: string;
	source: "tool" | "command" | "system" | "import";
}

export interface TaskCreatedEvent extends TaskEventBase {
	type: "task.created";
	title: string;
	objective: string;
	acceptanceCriteria: string[];
	initialSteps?: string[];
	planSteps?: TaskStepInput[];
	priority?: TaskPriority;
	tags?: string[];
	parentId?: string;
	dependencies?: string[];
	linkedFiles?: string[];
	activate?: boolean;
}

export interface TaskUpdatedEvent extends TaskEventBase {
	type: "task.updated";
	status?: TaskStatus;
	progress?: number;
	currentStep?: string;
	nextAction?: string;
	stepId?: string;
	stepStatus?: TaskStepStatus;
	stepEvidenceIds?: string[];
	activity?: string;
	scope?: "within_step" | "scope_change" | "off_plan";
	scopeReason?: string;
	note?: string;
	blocker?: Omit<TaskBlocker, "id" | "taskId" | "since" | "resolvedAt">;
	reason?: string;
}

export interface TaskEvidenceAddedEvent extends TaskEventBase {
	type: "task.evidence_added";
	evidence: Omit<TaskEvidence, "taskId" | "createdAt">;
	criterionIds?: string[];
}

export interface TaskDecisionRecordedEvent extends TaskEventBase {
	type: "task.decision_recorded";
	decision: Omit<TaskDecision, "taskId" | "createdAt">;
}

export interface TaskCompletedEvent extends TaskEventBase {
	type: "task.completed";
	summary: string;
	evidenceIds: string[];
	criterionResults?: Array<{
		criterionId: string;
		status: AcceptanceCriterion["status"];
		evidenceIds?: string[];
		note?: string;
	}>;
	forceWithReason?: string;
}

export interface TaskCancelledEvent extends TaskEventBase {
	type: "task.cancelled";
	reason: string;
}

export interface TaskSnapshotEvent extends TaskEventBase {
	type: "task.snapshot";
	state: Omit<TaskState, "events">;
	reason: "compaction" | "resume_repair" | "manual";
}

export type TaskEvent =
	| TaskCreatedEvent
	| TaskUpdatedEvent
	| TaskEvidenceAddedEvent
	| TaskDecisionRecordedEvent
	| TaskCompletedEvent
	| TaskCancelledEvent
	| TaskSnapshotEvent;

export interface ReplayResult {
	state: TaskState;
	malformedEvents: string[];
}

export function createEmptyState(): TaskState {
	return { tasks: {}, events: [], warnings: [] };
}
