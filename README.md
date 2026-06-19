# pi-tasks

Pi-native task and progress contract for agents and users.

`pi-tasks` is a Pi extension that keeps implementation work aligned with explicit requirements, visible progress, verification evidence, and user decisions. It is not a generic todo list. It is a session-aware execution contract for agentic development.

## MVP Capabilities

- Typed task, acceptance criterion, evidence, decision, blocker, and event model.
- Pure reducer with transition validation and evidence-before-completion enforcement.
- Ordered plan steps from `initial_steps`; agents must complete or skip the current step before advancing.
- Duplicate evidence detection by type, level, passed status, summary, and references.
- Branch-aware persistence through Pi custom entries with custom type `pi-tasks:event`.
- Session replay from `ctx.sessionManager.getBranch()` on `session_start` and `session_tree`.
- Agent tools: `task_plan`, `task_list`, `task_update`, `task_evidence`, `task_decision`, and `task_complete`.
- User command: `/tasks`.
- Compact status and above-editor widget through `ctx.ui.setStatus` and `ctx.ui.setWidget`.
- Compaction snapshot hook via `session_before_compact`.
- npm package runtime is built to `dist/`; source `index.ts` remains usable for local extension development.

## Completion Rules

`task_complete` rejects unsupported completion when:

- no evidence exists,
- any ordered plan step is still active or pending,
- required criteria are not satisfied or skipped,
- a criterion is marked satisfied without evidence,
- there is an unresolved blocker,
- or all completion evidence is only `not_verified`.

Forced completion requires `force_with_reason`; the task is marked done with confidence below 80 and a warning.

## Verification

Current local verification:

- `tsc --noEmit`
- `biome check --write --error-on-warnings index.ts src test docs README.md CHANGELOG.md package.json package-lock.json tsconfig.json tsconfig.build.json`
- `vitest --run test/unit/`
- `tsc -p tsconfig.build.json`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `node -e "import('./dist/index.js')"`
- `npm pack --dry-run` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`
- tarball install plus `node -e "import('pi-tasks')"`
- `npm audit --audit-level=low` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`

Real Pi dogfood passed on 2026-06-18 and 2026-06-19 with isolated session storage under `/private/tmp/pi-tasks-dogfood/sessions` and `/private/tmp/pi-tasks-release-dogfood/sessions`:

- task creation, progress update, evidence rejection, evidence attachment, completion, and detailed listing,
- ordered step completion and rejection of out-of-order step updates,
- duplicate evidence rejection without creating an extra evidence record,
- same-session resume with replayed custom entries,
- blocked task display with blocker source, resolved blocker audit trail, explicit user decision, and unblock condition,
- live TTY `/tasks` command and clean `/quit`,
- forked-session replay of copied `pi-tasks:event` custom entries,
- `pi install ./`, tarball install, installed-package import, and installed `dist/index.js` Pi smoke.

Start here:

- [Product Plan](docs/PRODUCT_PLAN.md) - product positioning, scope, research, and `/goal` boundary.
- [Implementation Specification](docs/IMPLEMENTATION_SPEC.md) - typed data contracts, reducer rules, tool contracts, TUI minimum spec, and completion checklist.
- [Dogfood Checklist](docs/DOGFOOD.md) - real Pi dogfood scenarios and current status.
- [Release Process](docs/RELEASE_PROCESS.md) - gates required before publishing.
