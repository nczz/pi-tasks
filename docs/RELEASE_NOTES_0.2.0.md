# Release Notes 0.2.0

## Highlights

- Added a Pi-native custom task UI integration seam through `pi-tasks:state`.
- Exported `TASK_STATE_EVENT`, `TASK_WIDGET_ID`, `TaskStateEvent`, and `TaskStateEventReason` from the package root.
- Published cloned task-state snapshots after default UI refresh for session replay, session tree navigation, successful task mutations, and compaction snapshot persistence.
- Preserved the default pi-tasks widget when no subscriber is installed, while allowing synchronous subscribers to replace it through the stable widget id.

## Security and Privacy

`pi-tasks:state` intentionally publishes derived task state to local Pi extension subscribers. Payloads omit raw task event history but can include task text, acceptance criteria, decisions, blockers, and evidence references. Treat subscribers as same-session, same-trust local extensions.

Published payloads are structured-cloned so consumer mutation does not alter pi-tasks runtime state. Observer failures are isolated from successful task persistence.

## Verification Status

- Passed: `npm run release:check`.
- Passed: source Pi dogfood for task creation, task update, `/tasks`, session resume, fork replay, custom UI state-event subscription, and clean `/quit`.
- Passed: clean tarball install, `import("pi-tasks")`, and installed-package Pi state-event smoke.
- Unit covered: compaction snapshot persistence publishes `pi-tasks:state`.
- Pending before claiming release-grade compaction dogfood: rerun manual `/compact` in a large enough real Pi session. The 2026-07-22 attempt was skipped by Pi with `Nothing to compact (session too small)`.
