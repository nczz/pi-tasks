# pi-tasks Implementation Specification

## 1. Purpose

This document turns the product plan into an implementation-ready contract for the first Codex `/goal` run.

The MVP must produce a Pi extension that can:

- create a structured implementation task,
- keep task state persistent and branch-aware,
- show task progress to the user,
- let the agent update progress and attach evidence,
- reject unsupported completion claims,
- survive session resume,
- and document what was verified.

The MVP must not become a generic project-management system. Its first job is agent/user alignment inside Pi.

## 2. Research Delta Since Product Plan

### 2.1 `@juicesharp/rpiv-todo`

Package:

- `@juicesharp/rpiv-todo`
- npm version observed: `1.20.0`
- repository: `https://github.com/juicesharp/rpiv-todo`
- moved package source: `https://github.com/juicesharp/rpiv-mono/tree/main/packages/rpiv-todo`

Observed from README and package metadata:

- registers a `todo` tool,
- registers `/todos`,
- renders a persistent above-editor overlay,
- replaces Claude Code's `TaskCreate`/`TaskUpdate` tool family,
- supports a 4-state machine: `pending -> in_progress -> completed`, plus deleted tombstone,
- supports `blockedBy` dependency tracking,
- includes cycle detection,
- persists through branch replay,
- survives compaction and `/reload`,
- collapses overlay after 12 lines and drops completed tasks first.

Implication for `pi-tasks`:

- Do not compete as "another todo list".
- Borrow the proven Pi-native concepts: branch replay, overlay, dependency checks, compact display.
- Differentiate on execution contracts: objective, requirements, acceptance criteria, verification evidence, user decisions, blockers, and completion confidence.

### 2.2 Pi Official Todo Example

Pi's bundled `examples/extensions/todo.ts` validates:

- state can be reconstructed from session branch entries,
- tool details can be used as a state ledger,
- custom `/todos` TUI command is viable.

MVP should keep this mental model but use stronger event records and reducer tests.

## 3. Final MVP Boundary

### In Scope

- Minimal package scaffold.
- Pi extension entrypoint.
- Event-sourced task state model.
- Reducer with explicit transition validation.
- Session branch reconstruction.
- Core task tools.
- `/tasks` command.
- A compact TUI widget or status line.
- Completion evidence enforcement.
- Prompt guidance.
- Unit tests.
- Pi dogfood checklist.
- Documentation and release gates.

### Out Of Scope

- Web UI.
- MCP server.
- Linear/Jira/GitHub sync.
- Markdown import.
- Cloud sync.
- Cross-project dashboard.
- Hard write blocking as default.
- Full-screen advanced board.
- Embedding/search over tasks.

## 4. Storage Model

### 4.1 Primary Storage

Use Pi session custom entries as the primary event log.

Custom type:

```text
pi-tasks:event
```

Each task change is appended as an immutable event. Runtime state is reconstructed by replaying branch entries from `ctx.sessionManager.getBranch()`.

Reasons:

- branch-aware,
- resume-aware,
- no project file pollution,
- compatible with Pi session tree,
- easy to audit.

### 4.2 Optional Tool Result Details

Tool results may include a state snapshot in `details` for better rendering, but the authoritative ledger must be custom entries.

Reason:

- the official todo example stores state in tool result details,
- but a dedicated event custom entry is clearer for migration, reducer tests, compaction, and custom renderers.

### 4.3 Project File Export

Do not write project files by default.

Future explicit export targets:

- `TASKS.md`
- `todo.md`
- `.pi/tasks.json`

Export must require explicit user request or config.

## 5. TypeScript Data Contracts

### 5.1 Task Status

```ts
export type TaskStatus = "pending" | "active" | "blocked" | "review" | "done" | "cancelled";
```

### 5.2 Verification Level

```ts
export type VerificationLevel =
	| "not_verified"
	| "static_read"
	| "unit_test"
	| "integration_test"
	| "e2e_smoke"
	| "release_grade_e2e"
	| "pi_dogfood"
	| "external_unverified";
```

### 5.3 Evidence

```ts
export interface TaskEvidence {
	id: string;
	taskId: string;
	type: "test" | "command" | "review" | "file" | "commit" | "dogfood" | "user_acceptance" | "external" | "note";
	level: VerificationLevel;
	summary: string;
	passed: boolean | "unknown";
	references: string[];
	createdAt: string;
}
```

Rules:

- `summary` is required.
- `passed: true` requires a non-`not_verified` level unless type is `note`.
- `external_unverified` is allowed but cannot satisfy release-grade evidence by itself.

### 5.4 Acceptance Criterion

```ts
export interface AcceptanceCriterion {
	id: string;
	text: string;
	status: "pending" | "satisfied" | "failed" | "skipped";
	evidenceIds: string[];
	note?: string;
}
```

Rules:

- `satisfied` requires at least one evidence ID.
- `skipped` requires a note.

### 5.5 Decision

```ts
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
```

### 5.6 Blocker

```ts
export interface TaskBlocker {
	id: string;
	taskId: string;
	reason: string;
	blockedBy: "user" | "external" | "environment" | "dependency" | "ambiguity";
	neededToUnblock: string;
	since: string;
	resolvedAt?: string;
}
```

### 5.7 TaskStep

```ts
export interface TaskStep {
	id: string;
	taskId: string;
	text: string;
	status: "pending" | "active" | "done" | "skipped";
	evidenceIds: string[];
	note?: string;
	startedAt?: string;
	completedAt?: string;
}
```

Rules:

- `initial_steps` become ordered task steps with IDs such as `T1-S1`.
- The first step is active when the task is activated.
- Agents must complete or skip the current open step before advancing.
- Skipping a step requires a reason or note.

### 5.8 Task

```ts
export interface Task {
	id: string;
	title: string;
	objective: string;
	status: TaskStatus;
	priority: "low" | "normal" | "high" | "urgent";
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
}
```

Rules:

- `progress` is clamped to 0-100.
- `done` forces progress to 100.
- `cancelled` must not imply completion.
- only one task should be `active` by default unless explicit parallel mode exists later.

### 5.8 Task Event

```ts
export type TaskEvent =
	| TaskCreatedEvent
	| TaskUpdatedEvent
	| TaskEvidenceAddedEvent
	| TaskDecisionRecordedEvent
	| TaskBlockedEvent
	| TaskUnblockedEvent
	| TaskCompletedEvent
	| TaskCancelledEvent;

export interface TaskEventBase {
	id: string;
	type: string;
	taskId: string;
	createdAt: string;
	source: "tool" | "command" | "system" | "import";
}
```

Each event must include enough data to replay state deterministically.

## 6. Reducer Contract

Reducer signature:

```ts
export function reduceTaskState(state: TaskState, event: TaskEvent): TaskState;
```

State:

```ts
export interface TaskState {
	tasks: Record<string, Task>;
	activeTaskId?: string;
	events: TaskEvent[];
	lastUpdatedAt?: string;
}
```

Reducer requirements:

- pure function,
- no filesystem access,
- no Pi API access,
- deterministic,
- rejects malformed transitions with actionable errors,
- preserves unknown future event types only if explicitly versioned.

## 7. Status Transition Matrix

Allowed transitions:

| From | To | Allowed | Requirements |
|---|---|---:|---|
| pending | active | yes | none |
| pending | cancelled | yes | reason |
| active | blocked | yes | blocker |
| active | review | yes | at least one progress/evidence update |
| active | done | yes | all required criteria satisfied or forced with reason |
| active | cancelled | yes | reason |
| blocked | active | yes | blocker resolved |
| blocked | cancelled | yes | reason |
| review | active | yes | rework reason |
| review | done | yes | criteria evidence |
| review | blocked | yes | blocker |
| done | active | no by default | use reopen event in future version |
| cancelled | active | no by default | create new task instead |

Completion rejection cases:

- no evidence,
- unsatisfied required criteria,
- active unresolved blocker,
- `passed: false` evidence attached to required criterion,
- verification level only `not_verified`.

Forced completion:

- allowed only with `force_with_reason`,
- must mark confidence below 80,
- must produce a visible warning in tool result.

## 8. Tool Contracts

### 8.1 `task_plan`

Purpose:

Create a task with objective and acceptance criteria.

Required parameters:

- `title`
- `objective`
- `acceptance_criteria`

Optional parameters:

- `initial_steps`
- `priority`
- `risks`
- `tags`
- `activate`

Behavior:

- creates task event,
- converts `initial_steps` to ordered plan steps,
- optionally activates it,
- if activating, deactivates previous active task by moving it to `pending` unless explicit parallel support exists,
- returns task summary and next action.

### 8.2 `task_list`

Purpose:

List tasks for agent/user status.

Parameters:

- `status`
- `include_done`
- `include_evidence`
- `limit`

Behavior:

- no mutation,
- returns active task first,
- includes blockers and verification gaps.

### 8.3 `task_update`

Purpose:

Update progress and working state.

Parameters:

- `task_id`
- `status`
- `progress`
- `current_step`
- `next_action`
- `step_id`
- `step_status`
- `step_evidence_ids`
- `note`

Behavior:

- validates transition,
- rejects attempts to update a later plan step before the current open step,
- advances to the next plan step after the current step is marked `done` or `skipped`,
- rejects skipping a plan step without a reason or note,
- appends event,
- updates widget/status.

### 8.4 `task_evidence`

Purpose:

Attach verification evidence.

Parameters:

- `task_id`
- `type`
- `level`
- `summary`
- `passed`
- `references`
- `criterion_ids`

Behavior:

- appends evidence,
- marks referenced criteria satisfied only when `passed: true`,
- never marks task done by itself.

### 8.5 `task_decision`

Purpose:

Record decision and rationale.

Parameters:

- `task_id`
- `question`
- `decision`
- `decided_by`
- `rationale`
- `impact`

Behavior:

- appends decision,
- visible in task details.

### 8.6 `task_complete`

Purpose:

Complete task with evidence.

Parameters:

- `task_id`
- `summary`
- `criterion_results`
- `evidence_ids`
- `force_with_reason`

Behavior:

- rejects unsupported completion,
- rejects completion while any plan step is still active or pending unless forced with a reason,
- appends completion event,
- sets progress to 100,
- updates widget/status,
- returns final handoff summary.

## 9. Command Contracts

### 9.1 `/tasks`

Minimum behavior:

- works in TUI mode,
- shows active task,
- groups pending/blocked/review/done,
- shows progress and next action,
- shows verification gaps.

Fallback behavior:

- in non-TUI mode, print text summary or notify unsupported.

### 9.2 `/task-export`

Out of MVP unless implementation finishes early with tests.

## 10. TUI Minimum Specification

### 10.1 Status

Use `ctx.ui.setStatus("pi-tasks", text)`.

Format:

```text
Task T12 active 60% - Verify release gate
```

Rules:

- truncate long titles,
- clear status when no active task,
- show `blocked` before progress when blocked.

### 10.2 Widget

Use `ctx.ui.setWidget("pi-tasks", lines, { placement: "aboveEditor" })`.

Minimum lines:

```text
Active task: T12 Release pi-knowledge metadata
Progress: 60% | active | Next: run npm pack
Gaps: PDF/DOCX release-grade e2e skipped
```

Rules:

- max 5 lines in MVP,
- hide when no tasks unless configured,
- no custom component until width handling is dogfooded,
- string-array widget first; custom component later.

### 10.3 Width Safety

All visible lines must be truncated before display.

MVP can use plain string arrays if Pi handles wrapping, but custom components must use Pi TUI helpers such as `truncateToWidth`.

## 11. Session Reconstruction

At `session_start` and `session_tree`:

1. clear in-memory state,
2. read `ctx.sessionManager.getBranch()`,
3. filter custom entries with `customType === "pi-tasks:event"`,
4. replay events in branch order,
5. update status/widget.

If malformed event exists:

- keep loading valid events,
- report warning,
- expose warning in `/tasks`.

## 12. Compaction Strategy

MVP requirement:

- state must survive compaction through event replay or a compacted summary event.

If Pi branch after compaction excludes old custom entries, then add a `session_before_compact` hook that appends a task snapshot event or compaction details.

Spike required before implementation completion:

- create task,
- trigger compaction if feasible,
- reload/resume,
- confirm state.

## 13. Guard Mode Specification

MVP default:

```text
suggest
```

Modes:

| Mode | Behavior |
|---|---|
| off | no warning |
| suggest | warn when write-like operation has no active task |
| require | block write-like operation without active task |

MVP may implement only `off` and `suggest` if `tool_call` behavior is confirmed late. `require` is commercial full version unless simple and well-tested.

Write-like operations:

- edit/write file,
- bash mutation commands,
- git commit/tag/push,
- release/publish commands.

Read-only exploration remains allowed.

## 14. Dogfood Scenarios

MVP is not done until these are tested or explicitly marked blocked:

1. Create active task with criteria.
2. Update progress.
3. Attach passing evidence.
4. Attempt completion without evidence and confirm rejection.
5. Complete with evidence.
6. Resume same session and confirm state.
7. Open `/tasks` in TUI.
8. Verify widget/status updates.
9. Create blocked task and confirm blocker display.
10. Run `node --experimental-strip-types -e "import('./index.ts')"`.
11. Run `npm pack --dry-run`.
12. Exit Pi with `/quit` cleanly.

Branch/fork and compaction scenarios are required for commercial baseline. If not completed in MVP, docs must state the exact limitation.

## 15. Unit Test Matrix

Required reducer tests:

- create task,
- activate task,
- only one active task by default,
- update progress clamps 0-100,
- block task,
- unblock task,
- add evidence,
- satisfy criterion with passing evidence,
- reject satisfied criterion without evidence,
- reject completion without evidence,
- reject completion with unresolved blocker,
- forced completion records warning/confidence,
- cancel task,
- replay events reconstructs same state.

Required formatting tests:

- active status text,
- blocked status text,
- truncated long title,
- Markdown export later if implemented.

## 16. File Layout

```text
src/
├── model.ts       # types and constants
├── reducer.ts     # pure state reducer
├── store.ts       # Pi session event replay and append helpers
├── tools.ts       # task_* tools
├── commands.ts    # /tasks command
├── widget.ts      # setStatus/setWidget helpers
├── render.ts      # width-safe formatting helpers
└── ids.ts         # deterministic short IDs
```

No module should import Pi virtual modules at root unless startup smoke remains valid. If types are imported, prefer type-only imports.

## 17. Implementation Order

1. Scaffold `src/model.ts`.
2. Build reducer and unit tests.
3. Build store replay abstraction with fake session entries tests.
4. Register tools without TUI custom renderers.
5. Add `/tasks` command with text summary first.
6. Add status/widget.
7. Add Pi dogfood.
8. Add docs and release gates.

Do not start with the UI. State correctness comes first.

## 18. `/goal` Prompt

Use this exact objective:

```text
Build the MVP of pi-tasks as a commercial-grade Pi extension. Implement the scoped MVP only: typed task/event model, pure reducer with transition validation, session custom-entry persistence and branch replay, task_plan/task_list/task_update/task_evidence/task_decision/task_complete tools, /tasks command, compact status/widget UI, unit tests, Pi dogfood, and docs. Completion requires evidence enforcement and session resume correctness. Do not add external integrations, MCP server, web UI, hard require-mode guard by default, or advanced full-screen board.
```

## 19. `/goal` Completion Checklist

The goal can be marked complete only when:

- TypeScript project scaffold is complete.
- `index.ts` imports startup-light.
- Task model and reducer are implemented.
- Reducer unit tests pass.
- Session replay works from Pi branch entries or a tested abstraction.
- Core task tools work.
- `/tasks` command works.
- Status/widget updates work.
- Completion without evidence is rejected.
- Completion with evidence succeeds.
- `npm run check` passes.
- `npm test` passes.
- `npm run build` passes.
- `node --experimental-strip-types -e "import('./index.ts')"` passes.
- `node -e "import('./dist/index.js')"` passes.
- `npm pack --dry-run` passes.
- tarball-installed package import passes.
- Pi dogfood passes for create/update/evidence/complete/resume/quit.
- README and docs state implemented behavior without overclaiming.

## 20. Current Implementation Status

As of 2026-06-18, the repo contains an MVP implementation for:

- typed model and event contracts in `src/model.ts`,
- pure reducer and transition validation in `src/reducer.ts`,
- ordered plan-step enforcement for `initial_steps`, `task_update`, and completion gating,
- duplicate evidence deduplication in tool execution and replay,
- branch custom-entry replay in `src/store.ts`,
- tool registration in `src/tools.ts`,
- `/tasks` command registration in `src/commands.ts`, including detailed step, blocker, decision, criterion, and evidence output,
- compact status/widget formatting in `src/render.ts` and `src/widget.ts`,
- startup-light extension registration in `index.ts`,
- compiled npm runtime in `dist/`,
- unit tests in `test/unit/`.

Verified locally:

- strict source typecheck with `tsc --noEmit`,
- Biome check,
- unit tests,
- build with `tsc -p tsconfig.build.json`,
- strip-types import smoke,
- compiled `dist/index.js` import smoke,
- `npm pack --dry-run` using an isolated npm cache,
- tarball install and `import("pi-tasks")`,
- `npm audit --audit-level=low` using an isolated npm cache.

Verified with real Pi dogfood:

- task creation, ordered step update, evidence rejection, evidence attachment, completion, and listing,
- adversarial rejection of out-of-order step update, premature completion, duplicate evidence, and skip-without-reason,
- same-session resume from persisted `pi-tasks:event` custom entries,
- blocked task display with blocker source, reason, unblock condition, resolved blocker audit trail, and explicit user decision,
- live TTY `/tasks` command output and clean `/quit`,
- forked-session replay of copied custom entries,
- installed-package Pi smoke through `node_modules/pi-tasks/dist/index.js`.

Remaining runtime coverage:

- compaction behavior after real Pi context trimming,
- narrow-terminal visual QA in a live Pi TUI session,
- interactive branch divergence navigation inside a live Pi session tree.

## 21. Documentation Completeness Assessment

After the MVP implementation and dogfood pass, documentation completeness is 98/100.

Remaining 2 points are intentionally withheld until runtime checks verify:

- exact `appendEntry` custom entry behavior under compaction,
- final UI width behavior in narrow terminals.

These are runtime validation items, not planning gaps. Branch replay and forked-session replay are covered by unit tests and real Pi dogfood; interactive branch divergence navigation remains future coverage.
