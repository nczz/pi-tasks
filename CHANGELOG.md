# Changelog

## [0.1.0] - Unreleased

### Added
- Initial product planning for a Pi-native task and progress contract extension.
- MVP source modules for task/event modeling, reducer validation, branch replay, tool registration, `/tasks`, and compact UI status/widget updates.
- Unit coverage for reducer transitions, custom-entry replay, rendering, registered tools, evidence enforcement, and replay after tool appends.
- Real Pi dogfood evidence for task lifecycle, evidence-enforced completion, resume replay, blocked display, `/tasks`, `/quit`, and forked-session replay.
- Release-hardening dogfood evidence for ordered-step misuse, duplicate evidence rejection, decision/blocker rendering, install, tarball import, and installed-package Pi smoke.
- Commercial contract dogfood evidence for structured `plan_steps`, `task_focus`, evidence-required step completion, and scope drift warnings.
- Release process and dogfood checklist documents.

### Changed
- `initial_steps` now become ordered plan steps; `task_update` must advance the current step in order and `task_complete` rejects open steps unless forced.
- Added structured step contracts with expected output, linked criteria, required evidence, allowed actions, and the `task_focus` tool.
- Evidence-required steps now reject `done` until linked evidence exists.
- `task_update` can record `within_step`, `scope_change`, and `off_plan` activity; drift requires a reason and appears in task warnings.
- Progress now derives upward from plan steps, satisfied criteria, and evidence so active tasks do not stay at 1% after verification work is complete.
- Duplicate `task_evidence` calls now reuse the existing evidence record instead of appending noisy duplicates.
- Detailed task output now includes decisions and resolved blocker audit history.
- Published package metadata now points to compiled `dist/index.js` and generated declarations instead of raw TypeScript under `node_modules`.
- Added `package-lock.json` and pinned the dependency audit surface with an `esbuild` override.
