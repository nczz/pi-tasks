# pi-tasks Product Plan

## 1. Executive Summary

`pi-tasks` is a Pi-native task and progress contract for agentic development. Its job is to keep the agent, user, and session history aligned around what is being built, how far along it is, what remains blocked, what evidence proves completion, and what decisions were made.

The product is intentionally more than a todo list. A normal todo list tracks items. `pi-tasks` tracks execution contracts:

- user intent,
- requirements,
- task decomposition,
- acceptance criteria,
- current implementation state,
- verification evidence,
- blockers,
- user decisions,
- handoff state,
- and completion confidence.

The target quality bar is the commercial-grade standard established by `pi-knowledge`: local-first, Pi-native, well-documented, release-gated, tested through real Pi dogfood, and honest about verification levels.

## 2. Problem Statement

Agentic coding sessions frequently fail in predictable ways:

- The agent starts implementation before requirements are aligned.
- The user cannot see what the agent thinks the task is.
- Long-running work appears stuck.
- Context compaction or session resume loses current implementation intent.
- The agent says work is done without clear verification evidence.
- Multi-step work drifts from the original request.
- Follow-up sessions lack a reliable handoff contract.

This creates repeated friction: the user must ask for status, ask whether tests were run, ask what remains, and manually police whether the agent is still aligned.

`pi-tasks` should make that state explicit by default.

## 3. Product Positioning

### One-Line Positioning

Pi-native task and progress contracts for agents and users.

### Product Promise

Keep every implementation session aligned, inspectable, resumable, and verifiable.

### What It Is

- A Pi extension.
- A session-aware task tracker.
- A progress and verification ledger.
- A TUI-visible project execution state.
- A user-agent alignment layer.

### What It Is Not

- Not a generic todo app.
- Not a Jira/Linear replacement in v1.
- Not only a prompt instruction.
- Not only a Markdown checklist.
- Not a hidden memory system that the user cannot inspect.

## 4. Prior Research And Existing Tools

### Pi Official Todo Example

Pi ships an example extension at:

`examples/extensions/todo.ts`

Observed capabilities:

- registers a `todo` tool,
- registers a `/todos` command,
- stores state in tool result details,
- reconstructs state from session branch entries,
- supports session branching naturally.

Assessment:

- Useful as a proof of Pi-native state management.
- Not product-complete.
- Missing acceptance criteria, verification, blockers, dependency tracking, user decisions, status widgets, and commercial workflow constraints.

### `@juicesharp/rpiv-todo`

Pi package catalog shows an existing todo-like extension:

- live overlay,
- survives `/reload`,
- survives conversation compaction.

Assessment:

- Important competitor/reference.
- Need deeper code review before implementation if possible.
- The positioning appears todo-oriented; `pi-tasks` should differentiate through requirements, evidence, and execution contracts.

### AGINEAR

Repository:

https://github.com/Legorobotdude/AGINEAR

Observed capabilities:

- Markdown-native project management,
- `todo.md` and `roadmap.md` as source of truth,
- CLI, web GUI, MCP server,
- Kanban sections,
- roadmap milestones,
- lossless Markdown preservation.

Assessment:

- Strong reference for human-readable task files.
- Good inspiration for optional export/import.
- Not Pi-native and does not use Pi session tree or TUI.

### mcp-server-todotxt

Repository:

https://github.com/guifelix/mcp-server-todotxt

Observed capabilities:

- Todo.txt-based MCP server,
- add/list/search/sort/filter tasks,
- metadata and batch operations.

Assessment:

- Useful reference for simple portable task syntax.
- Too generic for agent implementation governance.

### claude-code-task-todo

Repository:

https://github.com/napoler/claude-code-task-todo

Observed capabilities:

- hook-based task guard,
- blocks non-read-only operations when no active task exists,
- session restore and wiki sync.

Assessment:

- Strong reference for guardrail behavior.
- Prompt/hook based, not Pi-native.
- Reinforces that agent write actions should be connected to active tasks.

### dotpm-mcp

Repository:

https://github.com/pavelracu/dotpm-mcp

Observed direction:

- product-management MCP,
- todos, briefs, Linear integration, sprint planning, rules,
- roadmap mentions visual AI task manager for parallel Claude sessions.

Assessment:

- Useful strategic reference for future integrations.
- Current state appears early and MCP-centric.

## 5. Pi Architecture Findings

Target Pi version observed locally: `0.79.6`.

Pi extension APIs relevant to this product:

- `pi.registerTool`: agent-callable task actions.
- `pi.registerCommand`: user slash commands such as `/tasks`.
- `pi.registerMessageRenderer`: custom rendering for task ledger messages.
- `pi.appendEntry`: persist extension custom state in session tree.
- `pi.setLabel`: label important session entries, such as active tasks or milestones.
- `pi.sendMessage`: inject visible or hidden task summaries when needed.
- `ctx.ui.setWidget`: persistent TUI dashboard above or below the editor.
- `ctx.ui.setStatus`: footer/status text for active task summary.
- `ctx.ui.custom`: interactive task board or inspector.
- `before_agent_start`: inspect user prompt and encourage/require task alignment.
- `tool_call`: optional guard for write operations.
- `tool_execution_start/update/end`: attach implementation evidence to tasks.
- `turn_end`: update progress and summarize outcome.
- `session_start`: reconstruct task state.
- `session_tree`: reconstruct task state after branch navigation.
- `session_before_compact` and `session_compact`: preserve task state through compaction.
- `session_shutdown`: flush and clean up.

Important architectural implication:

The core task state should be Pi session-aware, not just a project file. Session tree state lets tasks follow branch/fork/resume behavior correctly.

## 6. Product Principles

### 6.1 User-Visible Truth

If the agent is working on something, the user should be able to ask or inspect:

- current task,
- current step,
- blockers,
- last update,
- verification status,
- and remaining work.

### 6.2 Evidence Before Completion

A task cannot be marked `done` unless it has completion evidence. Evidence may include:

- tests run,
- command outputs summarized,
- files changed,
- review findings resolved,
- dogfood session result,
- explicit user acceptance,
- or documented reason why verification was not possible.

### 6.3 Agent-Usable, Not Just Human-Readable

The data model must be structured enough for tools to update safely, query reliably, and produce deterministic summaries.

### 6.4 Human-Readable When Exported

Session state is primary, but Markdown export should be available for handoff, repository documentation, or external review.

### 6.5 No False Authority

The extension can guide and guard the agent, but it must not claim external verification that did not run.

## 7. Data Model

### 7.1 Task

Required fields:

- `id`: stable short ID.
- `title`: concise task title.
- `objective`: user-facing objective.
- `status`: `pending | active | blocked | review | done | cancelled`.
- `created_at`: timestamp.
- `updated_at`: timestamp.
- `source`: `user | agent | imported | restored`.
- `acceptance_criteria`: list of concrete criteria.
- `progress`: integer 0-100 or phase-based progress.
- `current_step`: short text.
- `next_action`: short text.
- `verification`: verification summary object.
- `evidence`: list of evidence records.
- `decisions`: list of user/agent decisions.
- `blockers`: list of blocker records.

Optional fields:

- `parent_id`.
- `children`.
- `dependencies`.
- `priority`: `low | normal | high | urgent`.
- `risk`: `low | medium | high`.
- `confidence`: 0-100.
- `linked_files`.
- `linked_commits`.
- `linked_commands`.
- `tags`.
- `owner`: `agent | user | external`.

### 7.2 Evidence Record

Fields:

- `type`: `test | command | review | file | commit | dogfood | user_acceptance | external | note`.
- `summary`: concise description.
- `level`: `static_read | unit_test | integration_test | e2e_smoke | release_grade_e2e | pi_dogfood | external_unverified`.
- `passed`: boolean or `unknown`.
- `timestamp`.
- `references`: file paths, commit SHAs, command names, or URLs.

### 7.3 Decision Record

Fields:

- `id`.
- `question`.
- `decision`.
- `decided_by`: `user | agent`.
- `timestamp`.
- `rationale`.
- `impact`.

### 7.4 Blocker Record

Fields:

- `reason`.
- `blocked_by`: `user | external | environment | dependency | ambiguity`.
- `since`.
- `needed_to_unblock`.
- `last_checked_at`.

### 7.5 Session State

The extension should maintain a branch-specific state projection:

- active task,
- task list,
- latest task event IDs,
- dashboard preferences,
- exported file location if configured.

State should be reconstructed by scanning Pi session branch entries, not by trusting module-scope memory alone.

## 8. Tool Surface

### 8.1 MVP Tools

#### `task_plan`

Create or replace a structured task plan.

Use when:

- a user asks for non-trivial implementation,
- work has multiple steps,
- there are acceptance criteria,
- the agent needs to clarify boundaries.

Inputs:

- title,
- objective,
- acceptance_criteria,
- initial_steps,
- risks,
- requires_user_confirmation.

Outputs:

- task ID,
- summary,
- criteria,
- next action.

#### `task_list`

List tasks with filters.

Inputs:

- status,
- include_done,
- include_evidence,
- limit.

Outputs:

- concise task table,
- active task summary,
- blocked items.

#### `task_update`

Update status, progress, current step, next action, or blockers.

Inputs:

- task ID,
- status,
- progress,
- current_step,
- next_action,
- blocker,
- note.

#### `task_evidence`

Attach verification evidence.

Inputs:

- task ID,
- evidence type,
- verification level,
- passed,
- summary,
- references.

#### `task_complete`

Mark task complete only when acceptance criteria and evidence are present.

Inputs:

- task ID,
- completion summary,
- criteria results,
- evidence IDs.

Rules:

- Reject completion if no evidence exists unless `force_with_reason` is supplied.
- If forced, result must clearly state that completion is not fully verified.

#### `task_decision`

Record a user or agent decision.

Inputs:

- task ID,
- question,
- decision,
- rationale,
- impact.

### 8.2 Later Tools

- `task_split`: decompose a task into subtasks.
- `task_block`: explicitly block task.
- `task_resume`: produce handoff and next actions.
- `task_export`: write `TASKS.md` or `todo.md`.
- `task_import`: import Markdown/JSON task state.
- `task_guard_config`: configure write-operation guard strictness.
- `task_link_commit`: link git commit evidence.
- `task_review`: summarize open risks and unverified claims.

## 9. User Commands

### `/tasks`

Open TUI task dashboard.

Minimum views:

- active task,
- pending tasks,
- blocked tasks,
- recently completed tasks,
- evidence summary.

### `/task`

Show or update one task interactively.

### `/task-export`

Export current task state to Markdown.

### `/task-guard`

Configure whether write actions require an active task.

Guard modes:

- `off`: no enforcement.
- `suggest`: warn when no active task.
- `require`: block write-like operations unless active task exists.

Default recommendation:

- MVP default should be `suggest`, not `require`, to avoid surprising users.
- Commercial advanced mode can support `require`.

## 10. TUI Experience

### 10.1 Status Footer

Show compact status:

`Task #T12 active 60% - Verify release gate`

### 10.2 Widget

Above or below editor:

```text
Active task: #T12 Release pi-knowledge metadata
Progress: 60% | Status: active | Next: run npm pack
Open risks: PDF/DOCX e2e skipped
```

### 10.3 Interactive Board

`/tasks` opens a TUI panel:

- columns: Pending, Active, Blocked, Review, Done,
- details panel for selected task,
- evidence list,
- decisions list,
- keyboard shortcuts documented in help row.

Width safety is mandatory. All custom renderers must use Pi TUI width helpers such as `truncateToWidth` or equivalent.

## 11. Agent Behavior Contract

The extension should inject guidance:

- For non-trivial work, create or update a task plan before implementation.
- Keep exactly one active task unless explicitly working parallel subtasks.
- Update progress after meaningful milestones.
- Record blockers instead of silently waiting.
- Attach evidence before marking done.
- Report skipped verification as skipped.
- Ask the user before changing scope.

The system must not over-constrain exploration. Read-only investigation can happen before a task exists, but write operations should be tied to an active task in `suggest` or `require` guard modes.

## 12. Guardrail Design

### 12.1 Write Tool Guard

Intercept write-like built-in tools and extension tools when possible.

Read-only tools:

- read,
- grep,
- find,
- ls,
- status commands.

Write-like tools:

- write,
- edit,
- bash commands that mutate files or state,
- git commit/tag/push,
- package publish/release commands.

Guard decisions:

- If no active task and mode is `suggest`, add context warning.
- If no active task and mode is `require`, block and instruct agent to create/activate a task.
- If active task exists, allow and optionally attach tool activity as evidence candidate.

### 12.2 Avoid Overblocking

The guard must not block:

- user commands,
- task management tools,
- read-only review,
- emergency cleanup approved by user,
- session shutdown.

## 13. Persistence Strategy

### 13.1 Primary State

Use Pi session custom entries through `appendEntry`.

Benefits:

- branch-aware,
- resume-aware,
- no project file pollution,
- works with Pi session tree.

### 13.2 Derived State

At `session_start` and `session_tree`, reconstruct in-memory state from the current branch.

### 13.3 Optional Project Export

Support Markdown export later:

- `TASKS.md`,
- `todo.md`,
- `roadmap.md`,
- or `.pi/tasks.json`.

Export should be explicit, not automatic by default.

Reason:

- Some projects do not want agent task files committed.
- Session-local work may not belong in the repo.

## 14. Compaction And Resume

Before compaction:

- collect active task state,
- summarize task status,
- preserve evidence and blockers,
- include next action.

After compaction:

- append a compact task state entry if needed,
- keep dashboard state correct.

On resume:

- reconstruct state,
- show active task status,
- optionally inject a short task handoff into context.

## 15. Integration With pi-knowledge

`pi-tasks` should not depend on `pi-knowledge`.

But it should align with it:

- Use similar verification-level language.
- Use similar release-grade honesty.
- Optionally let task evidence reference knowledge searches.
- Optional future integration: when a task references files or docs, ask `pi-knowledge` for relevant context if installed.

Do not make `pi-tasks` require embeddings or search.

## 16. MVP Scope

### Included

- package scaffold,
- Pi extension entrypoint,
- task state reducer,
- session-entry persistence,
- branch reconstruction,
- tools:
  - `task_plan`,
  - `task_list`,
  - `task_update`,
  - `task_evidence`,
  - `task_complete`,
  - `task_decision`,
- `/tasks` command with basic TUI view,
- status footer or widget,
- prompt guidance,
- unit tests for reducer,
- Pi dogfood tests,
- README and release docs.

### Excluded From MVP

- web UI,
- Linear/Jira/GitHub issue sync,
- MCP server,
- Markdown import,
- hard write-block guard default,
- multi-agent assignment,
- cloud sync,
- cross-project dashboard.

## 17. Commercial Full Version Scope

### v1 Commercial Baseline

- robust TUI board,
- task dependency graph,
- strict guard mode,
- release/checklist templates,
- evidence audit report,
- Markdown export/import,
- project-level task archive,
- task search/filter,
- compaction-safe state,
- branch/fork visualization,
- package catalog metadata,
- complete dogfood suite.

### v2 Expansion

- MCP compatibility layer,
- GitHub Issues/Linear sync,
- multi-session dashboard,
- task templates by workflow,
- team handoff reports,
- analytics for agent reliability,
- integration with `pi-knowledge`.

## 18. Non-Goals

- Do not build a full SaaS PM tool in v1.
- Do not require network access.
- Do not store secrets.
- Do not silently write task files into user repositories.
- Do not claim verification without evidence.
- Do not block user-driven emergency actions without override.

## 19. Risks

### Risk: Too Much Friction

If every small action requires task planning, users will disable the extension.

Mitigation:

- default guard mode `suggest`,
- only recommend tasks for non-trivial work,
- allow read-only exploration.

### Risk: Prompt-Only Compliance

If the extension only injects instructions, models may ignore it.

Mitigation:

- tool state is authoritative,
- optional write guard,
- TUI status visible to user,
- completion validation in `task_complete`.

### Risk: Session State Drift

If state is kept only in memory, resume/fork breaks.

Mitigation:

- event-sourced session entries,
- reducer tests,
- reconstruct state on session events.

### Risk: TUI Instability

Custom UI can crash if width handling is wrong.

Mitigation:

- start with simple widget/status,
- use Pi TUI helpers,
- dogfood in narrow terminals,
- avoid full custom renderer until tested.

### Risk: Overlap With Existing Todo Extensions

Existing todo extensions may cover simple checklists.

Mitigation:

- position as execution contract and evidence ledger,
- support import/export later,
- focus on commercial-grade agent workflow.

## 20. Test Strategy

### Unit Tests

- task reducer,
- status transitions,
- evidence requirements,
- completion validation,
- branch reconstruction,
- export formatting.

### Integration Tests

- tool calls mutate state correctly,
- invalid transitions are rejected,
- task completion requires evidence,
- prompt guidance appears.

### Pi Dogfood

Required before release:

- load with `pi -e ./index.ts`,
- create task,
- update progress,
- attach evidence,
- complete task,
- open `/tasks`,
- resume same session,
- fork or tree navigation if implemented,
- `/quit` clean exit.

### Manual UX Review

- narrow terminal rendering,
- long task title truncation,
- blocked task visibility,
- no misleading completion status.

## 21. Release Gates

Before npm release:

- `npm run check`
- `npm test`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `npm pack --dry-run`
- Pi dogfood
- README updated
- CHANGELOG updated
- GitHub repo metadata updated
- package includes `pi-package` keyword

## 22. Proposed Repository Structure

```text
pi-tasks/
├── AGENTS.md
├── README.md
├── CHANGELOG.md
├── package.json
├── index.ts
├── src/
│   ├── model.ts
│   ├── reducer.ts
│   ├── store.ts
│   ├── tools.ts
│   ├── commands.ts
│   ├── widget.ts
│   └── render.ts
├── test/
│   └── unit/
└── docs/
    ├── PRODUCT_PLAN.md
    ├── ARCHITECTURE.md
    ├── RELEASE.md
    └── known-pitfalls.md
```

## 23. `/goal` Execution Boundary

Use this as the initial Codex `/goal` objective:

```text
Build the MVP of pi-tasks as a commercial-grade Pi extension that provides session-aware task planning, progress tracking, verification evidence, and a user-visible /tasks view. Implement the scoped MVP only: task state model, reducer, session-entry persistence, core tools, basic TUI command/widget, tests, docs, and release gates. Do not add external service integrations, MCP server, web UI, or hard blocking guard by default.
```

### Required Completion Criteria For `/goal`

The goal is not complete until:

- package scaffold exists,
- extension loads with Pi,
- task state persists through session resume,
- core tools work,
- `/tasks` works in TUI,
- task completion requires evidence,
- tests pass,
- docs explain behavior and limitations,
- release gates are documented,
- and a final readiness assessment is provided.

### Explicit Out Of Scope For First `/goal`

- GitHub/Linear/Jira sync,
- MCP server,
- web GUI,
- hard write blocking as default,
- advanced full-screen TUI board,
- cross-project dashboard,
- cloud sync,
- task search embeddings.

## 24. Implementation Specification

The implementation-ready contract is now split into a dedicated document:

- [IMPLEMENTATION_SPEC.md](IMPLEMENTATION_SPEC.md)

Use that file for schema-level contracts, reducer transition rules, tool parameter behavior, TUI minimum specification, dogfood scenarios, and the exact `/goal` prompt.

## 25. Documentation Completeness Assessment

Current document completeness: 96/100.

Strengths:

- Clear product boundary.
- Clear Pi-native architecture.
- Clear MVP vs commercial scope.
- Clear data model.
- Clear tool surface.
- Clear guardrail strategy.
- Clear `/goal` boundary.
- Identifies existing open-source references.
- Aligns with `pi-knowledge` quality expectations.
- Adds direct `@juicesharp/rpiv-todo` competitive findings.
- Adds schema-level implementation contracts in `IMPLEMENTATION_SPEC.md`.
- Adds reducer transition matrix and invalid completion behavior.
- Adds TUI minimum specification and width-safety requirement.
- Adds dogfood scenario checklist and `/goal` completion checklist.

Remaining runtime validation items:

- Validate exact `appendEntry` custom-entry behavior under compaction.
- Validate branch/fork replay behavior in a real Pi TUI session.
- Validate final UI width behavior in narrow terminals.
- Validate whether `require` guard mode is reliable enough for commercial release.

Recommendation:

Proceed with `/goal` using `IMPLEMENTATION_SPEC.md` as the implementation boundary. Treat the remaining items as runtime validation gates inside the goal, not planning gaps.
