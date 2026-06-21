# pi-tasks

> Pi-native execution contracts for AI agents — no more "trust me, it's done."

## Why pi-tasks?

AI coding agents say "done" without proof. Context compaction loses progress. Multi-step work drifts without anyone noticing. You end up asking "what's the status?" over and over.

**pi-tasks** gives your Pi agent a binding execution contract: structured plans, evidence gates, ordered execution, and compaction-safe resume — all visible in your TUI.

## What makes it different

Every other task tool for AI agents is just a todo list. pi-tasks enforces three hard contracts no competitor offers:

| Contract | What it means |
|----------|---------------|
| **Evidence-gated completion** | Agents cannot mark work done without traceable, reproducible proof |
| **Atomic step decomposition** | Vague or compound steps are rejected; non-atomic steps must be broken down before execution |
| **Compaction-safe resume** | Context window limits don't lose your progress — snapshot replay picks up exactly where you left off |

Plus: ordered step execution, scope drift detection, weak-model recovery guidance, decision/blocker audit trails, and branch-aware persistence.

## Competitive landscape

Different tools solve different parts of the agentic workflow. Pick based on what matters most to your team:

| Tool | Focus | Strengths | Trade-offs |
|------|-------|-----------|------------|
| **Claude Code Tasks** (built-in) | Cross-session coordination | Shared task lists, dependency tracking, zero setup | No completion verification, no step-level contracts |
| **rpiv-pi** (9.4K/mo, 413★) | Structured workflows | 6 end-to-end flows, 12 subagents, code-review loops | Workflow-oriented; task visibility via separate rpiv-todo |
| **@tintinweb/pi-tasks** (3.2K/mo, 113★) | Task tracking & subagents | Dependency DAG, auto-cascade, file/session/project scoping | Tracks progress; completion is self-reported |
| **Microsoft hve-core** (1,183★) | RPI workflow for Copilot | Research→Plan→Implement→Review, custom agents | Copilot-native; not designed for Pi |
| **pi-tasks** (this project) | Execution contracts | Evidence-gated completion, atomic decomposition, compaction-safe resume | Narrower scope; no subagent orchestration (yet) |

**pi-tasks is for you if** your core problem is agents claiming "done" without proof, plans drifting mid-execution, or context compaction losing progress. If you need workflow orchestration or multi-agent coordination, the tools above may be a better fit — or complement pi-tasks.

## Install

```sh
pi install npm:pi-tasks
```

For local development:

```sh
pi install ./
```

## How it works

```
task_plan → ordered steps with acceptance criteria
    ↓
task_focus → agent sees exactly what's in scope
    ↓
task_update → step-by-step execution with evidence lock
    ↓
task_evidence → attach proof before marking done
    ↓
task_complete → only succeeds when all gates pass
```

The agent gets 12 tools. The user gets `/tasks`. Everything persists in Pi's session tree.

## Agent Tools

| Tool | Purpose |
|------|---------|
| `task_plan` | Create a task with objectives, criteria, and ordered steps |
| `task_next` | One-step guidance for weak/small-context models |
| `task_focus` | What work is in scope right now |
| `task_resume` | Recover state after compaction or session switch |
| `task_checkpoint` | Save a durable snapshot for compaction resilience |
| `task_granularity_check` | Verify a step is truly atomic |
| `task_decompose` | Break non-atomic steps into child steps |
| `task_list` | List tasks with optional filtering |
| `task_update` | Advance steps, record activity, flag scope drift |
| `task_evidence` | Attach verification evidence to steps/criteria |
| `task_decision` | Record explicit user decisions |
| `task_complete` | Close a task (only if all gates pass) |

## Completion Gates

`task_complete` rejects when:

- No evidence exists
- Any ordered plan step is still active or pending
- Required criteria are not satisfied
- A criterion is satisfied without evidence
- Unresolved blockers remain
- Unresolved scope drift warnings remain
- All evidence is only `not_verified`

Forced completion requires `force_with_reason` and produces a low-confidence warning.

## Token Efficiency

Normal tool results return only the compact resume contract needed for the next action — not the full task state.

```text
# Compact defaults during work:
task_next
task_resume
/tasks

# Detailed view only when debugging:
/tasks detail
task_list include_evidence=true
```

## Technical Details

### Capabilities

- Typed task, acceptance criterion, evidence, decision, blocker, and event model
- Pure reducer with transition validation and evidence-before-completion enforcement
- Ordered plan steps; agents must complete or skip the current step before advancing
- Step-level contracts with expected output, linked criteria, required evidence, and allowed actions
- Plan quality gate rejects vague, unverifiable, or over-broad atomic steps
- Stricter atomic scoring rejects compound wording (`and`, `then`, `並且`, `然後`)
- Recursive decomposition gate for non-atomic steps
- Step-scoped evidence through `task_evidence.step_ids`
- Current-step evidence lock unless explicit `override_reason` is supplied
- Evidence quality gate: traceable, reproducible, with artifact references
- Evidence budget gate: oversized text is rejected to keep context lean
- Tool rejections include structured recovery details + `task_resume` guidance
- `task_next` one-step weak-model contract with mode, current-step lock, recommended tool, blocked tools, minimum params
- Scope drift recording for `scope_change` and `off_plan` activity
- Derived progress from completed steps, satisfied criteria, and evidence
- Duplicate evidence detection
- Branch-aware persistence via Pi custom entries (`pi-tasks:event`)
- Session replay from `ctx.sessionManager.getBranch()` on `session_start` and `session_tree`
- Compaction snapshot hook via `session_before_compact`
- Compact status bar and above-editor widget

### Verification

Local verification suite:

- `npm run release:check` (typecheck + lint + test + build + import smoke + pack + audit)
- Real Pi dogfood passed on 2026-06-18, 2026-06-19, and 2026-06-20

Dogfood coverage includes: task lifecycle, evidence enforcement, ordered step rejection, structured plan steps, recursive decomposition, compaction-safe resume, duplicate evidence rejection, blocked task display, forked-session replay, tarball install, and weak-model smoke.

## Documentation

- [Product Plan](docs/PRODUCT_PLAN.md) — positioning, scope, research, and `/goal` boundary
- [Implementation Specification](docs/IMPLEMENTATION_SPEC.md) — data contracts, reducer rules, tool contracts, TUI spec
- [Dogfood Checklist](docs/DOGFOOD.md) — real Pi dogfood scenarios and status
- [Weak-Model Prompts](docs/dogfood-prompts/) — English and Traditional Chinese validation prompts
- [Release Process](docs/RELEASE_PROCESS.md) — gates required before publishing

## License

MIT
