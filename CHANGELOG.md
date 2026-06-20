# Changelog

## [0.1.3] - 2026-06-20

### Changed
- Added a token-efficient output contract: mutation tools now return compact `task_resume` guidance instead of full task/evidence dumps.
- Tool `details` now carry compact resume context instead of full task state for normal tool responses.
- `/tasks` now defaults to compact task summaries; `/tasks detail` explicitly requests full task details.
- Detailed task/evidence rendering now truncates long text and references to keep debug output bounded.
- Rejection responses now include structured recovery details with `retry_with`, `minimum_params`, and `do_not_retry_same_call`.
- Atomic plan quality scoring now rejects obvious compound wording in atomic step text, expected output, and allowed actions.
- Evidence recording now enforces current-step lock unless `override_reason` is supplied.
- Evidence quality now enforces text budgets for summaries, references, artifact refs, command strings, source strings, and observed output.

### Added
- Unit coverage for compact `/tasks`, explicit detail mode, compact tool `details`, and bounded evidence rendering.
- Added `task_next` for weak or small-context models to get one recommended next tool, current-step lock, blocked tools, and minimum params.
- Unit coverage for `task_next`, structured rejection recovery, compound atomic rejection, evidence budgets, and current-step evidence locking.
- Added `npm run release:check` to rerun typecheck, lint/format checks, unit tests, build, source/dist import smokes, pack dry-run, clean tarball install, and audit.
- Added fixed English and Traditional Chinese weak-model dogfood prompts for release validation.

## [0.1.2] - 2026-06-20

Internal release candidate. Superseded by `0.1.3` before npm publication.

## [0.1.1] - 2026-06-19

Initial public release candidate.

### Added
- Initial product planning for a Pi-native task and progress contract extension.
- MVP source modules for task/event modeling, reducer validation, branch replay, tool registration, `/tasks`, and compact UI status/widget updates.
- Unit coverage for reducer transitions, custom-entry replay, rendering, registered tools, evidence enforcement, and replay after tool appends.
- Real Pi dogfood evidence for task lifecycle, evidence-enforced completion, resume replay, blocked display, `/tasks`, `/quit`, and forked-session replay.
- Release-hardening dogfood evidence for ordered-step misuse, duplicate evidence rejection, decision/blocker rendering, install, tarball import, and installed-package Pi smoke.
- Commercial contract dogfood evidence for structured `plan_steps`, `task_focus`, evidence-required step completion, and scope drift warnings.
- Final release evidence for real Pi manual compaction, post-compaction resume replay, live `/tree` branch navigation, and 50-column TUI rendering.
- Recursive decomposition tools and tests for non-atomic step rejection, granularity checks, and child-step replacement.
- Compaction-resilient resume contract with `task_resume`, `task_checkpoint`, snapshot resume fields, and snapshot replay tests.
- Plan quality and evidence quality gates for weak-model resistance, plus recovery guidance on tool rejection.
- Release process and dogfood checklist documents.

### Changed
- `initial_steps` now become ordered plan steps; `task_update` must advance the current step in order and `task_complete` rejects open steps unless forced.
- Added structured step contracts with expected output, linked criteria, required evidence, allowed actions, and the `task_focus` tool.
- Added recursive decomposition gating with `task_granularity_check` and `task_decompose`; non-atomic steps cannot be marked done.
- Added `task_evidence.step_ids` and narrowed automatic step evidence linking to avoid satisfying multiple child steps from one broad criterion match.
- `task_complete` now rejects unresolved scope drift warnings unless forced or explicitly resolved.
- Evidence-required steps now reject `done` until linked evidence exists.
- `task_update` can record `within_step`, `scope_change`, and `off_plan` activity; drift requires a reason and appears in task warnings.
- Progress now derives upward from plan steps, satisfied criteria, and evidence so active tasks do not stay at 1% after verification work is complete.
- Duplicate `task_evidence` calls now reuse the existing evidence record instead of appending noisy duplicates.
- Detailed task output now includes decisions and resolved blocker audit history.
- Published package metadata now points to compiled `dist/index.js` and generated declarations instead of raw TypeScript under `node_modules`.
- Added `package-lock.json` and pinned the dependency audit surface with an `esbuild` override.
- Rejected `task_plan` calls no longer consume task IDs, so a failed plan quality attempt followed by a valid task still creates the first task as `T1`.
- Tool guidance now tells agents to omit `plan_steps.criterionIds` during new task creation unless generated criterion IDs are already known.
