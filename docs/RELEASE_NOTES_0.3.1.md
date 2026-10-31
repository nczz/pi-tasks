# Release Notes 0.3.1

## Highlight

Version 0.3.1 adds proactive diagnostics for the native semantic model boundary introduced in 0.3.0. Unsupported environments now surface the problem at session startup instead of waiting for `task_plan`, `task_decompose`, or passing `task_evidence` to fail.

## Startup Experience

On `session_start` and `session_tree`, pi-tasks performs a static capability check for:

- Pi classifier discovery plus `classify()`;
- Pi `modelRegistry.streamSimple()` with a selected model; and
- Oh My Pi `runEphemeralTurn()`.

The check does not send a model request. Healthy sessions remain silent and clear stale semantic status. If no native strategy is available, pi-tasks sets a separate `pi-tasks-semantic` status and emits one warning per unchanged outage with a direct `/tasks doctor` recovery path.

The preflight runs after the default task UI refresh and `pi-tasks:state` publication, preserving the existing state-event ordering contract and consumer widget behavior.

## Semantic Doctor

`/tasks doctor` reports the static strategy matrix, preferred strategy, selected model, protected mutations, and recovery guidance without inference.

`/tasks doctor live` is an explicit opt-in probe. It sends one fixed synthetic plan assessment through the production semantic boundary and reports:

- the strategy, provider, and model actually used;
- elapsed time;
- model token usage when the host exposes it; or
- a typed assessment failure and recovery path.

Neither mode reads task branch entries, allocates IDs, appends task events, or mutates runtime task state. The OMP host may still include the current conversation under its documented side-turn contract.

## Compatibility

No provider SDK or direct model endpoint was added. The implementation uses only Pi and Oh My Pi native APIs and preserves the fail-closed mutation behavior from 0.3.0.

The package remains ESM-only, requires Node.js 22 or newer, and continues to expose `dist/index.js` through `pi.extensions`.

## Verification

- Passed `PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.4.0/node_modules/@earendil-works/pi-coding-agent npm run release:check`: strict typecheck, Biome, 112 unit tests, 7 native Pi SDK tests, build, source/dist imports, `npm pack --dry-run`, clean tarball install/import, and zero-vulnerability audit.
- Passed real Pi 1.4.0 startup, static doctor, live Pi chat probe, task creation/update, `/tasks`, same-session resume, fork replay, and clean `/quit` with `openai-codex/gpt-5.6-sol`.
- Passed real Oh My Pi 18.14.1 startup, static doctor, live `runEphemeralTurn()` probe, task creation/update, `/tasks`, same-session resume, and clean `/quit` with `google-antigravity/gemini-2.5-flash`.
- Passed an installed `pi-tasks-0.3.1.tgz` Pi smoke through `node_modules/pi-tasks/dist/index.js`, including static and live doctor modes and clean `/quit`.

## Publishing

The GitHub release contains the verified source and package metadata for `0.3.1`. npm publication remains a separate manual maintainer action and was not run during this release process.
