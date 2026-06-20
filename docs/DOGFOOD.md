# pi-tasks Dogfood Checklist

This document tracks real Pi dogfood evidence. Skipped items are not counted as passed.

## Current Status

Date: 2026-06-19

Result: passed for the scoped MVP dogfood gate and release-hardening dogfood gate.

Environment:

- Extension path: `./index.ts`
- Session directory: `/private/tmp/pi-tasks-dogfood/sessions`
- Primary session ID: `pi-tasks-dogfood-mvp-2`
- Primary transcript: `/private/tmp/pi-tasks-dogfood/sessions/2026-06-18T09-50-13-716Z_pi-tasks-dogfood-mvp-2.jsonl`
- Blocked-task transcript: `/private/tmp/pi-tasks-dogfood/sessions/2026-06-18T09-51-59-892Z_pi-tasks-dogfood-blocked-2.jsonl`
- Forked replay transcript: `/private/tmp/pi-tasks-dogfood/sessions/2026-06-18T10-00-01-165Z_019eda2c-5d8d-7544-a5ea-630b98aae3d5.jsonl`
- Release-hardening session directory: `/private/tmp/pi-tasks-release-dogfood/sessions`
- Normal ordered-step session ID: `pi-tasks-release-normal`
- Adversarial dedupe session ID: `pi-tasks-release-adversarial-dedupe`
- Blocked/decision session ID: `pi-tasks-release-blocked-decision`
- Installed-package session ID: `pi-tasks-release-installed-package`
- Commercial contract session directory: `/private/tmp/pi-tasks-commercial-dogfood/sessions`
- Commercial contract session ID: `pi-tasks-commercial-contract`
- Recursive decomposition session directory: `/private/tmp/pi-tasks-decomposition-dogfood/sessions`
- Recursive decomposition session ID: `pi-tasks-recursive-decomposition-step-evidence`
- Installed decomposition tools session ID: `pi-tasks-installed-decomposition-tools`
- Compaction resume session directory: `/private/tmp/pi-tasks-compaction-dogfood/sessions`
- Compaction resume session ID: `pi-tasks-compaction-resume`
- Weak-model quality session directory: `/private/tmp/pi-tasks-weakmodel-dogfood/sessions`
- English plan gate session ID: `weakmodel-plan-gate-en`
- English evidence gate session ID: `weakmodel-evidence-gate-en2`
- Chinese plan gate session ID: `weakmodel-plan-gate-zh`
- Installed package quality gate session ID: `weakmodel-installed-plan-gate`
- Readiness regression session directory: `/private/tmp/pi-tasks-id-regression/sessions`
- Readiness regression session ID: `id-regression-1`
- Branch navigation session ID: `branch-live-fork-1`
- Installed ID regression session directory: `/private/tmp/pi-tasks-installed-smoke-3/sessions`
- Installed ID regression session ID: `installed-id-regression-1`
- Final release session directory: `/private/tmp/pi-tasks-final-release/sessions`
- Final installed package smoke session ID: `final-installed-smoke-1`
- Token output session directory: `/private/tmp/pi-tasks-token-smoke/sessions`
- Token output session ID: `token-output-smoke-1`
- Installed token output session directory: `/private/tmp/pi-tasks-token-release-check/sessions`
- Installed token output session ID: `token-installed-smoke-1`

## Passed Scenarios

- Created an active task with two acceptance criteria through `task_plan`.
- Updated progress and next action through `task_update`.
- Attempted `task_complete` without evidence and received the expected rejection: `Task T1 has no evidence`.
- Listed the task with `include_evidence=true` and confirmed criterion IDs were visible for evidence attachment.
- Attached passing evidence to both criteria with `task_evidence`.
- Completed the task with evidence through `task_complete`.
- Listed completed task state with `include_done=true` and `include_evidence=true`.
- Resumed the same session ID and confirmed custom-entry replay restored the completed task and evidence records.
- Created a blocked task and confirmed `/task_list` output includes blocked status, blocker source, blocker reason, and unblock condition.
- Opened `/tasks` in a live TTY session and confirmed it rendered the replayed completed task and evidence details.
- Exited the live TTY session with `/quit` and received a clean exit.
- Forked the primary session and confirmed the fork transcript replayed copied `pi-tasks:event` entries into completed task state.
- Confirmed ordered plan-step flow: T1-S1 completed before T1-S2, then evidence and completion.
- Confirmed out-of-order step update is rejected: `Plan step T1-S3 cannot be updated before T1-S1`.
- Confirmed premature completion is rejected while a plan step remains open.
- Confirmed duplicate `task_evidence` call returns `Evidence already recorded as E1` and does not create E2.
- Confirmed blocked task flow records a resolved blocker plus explicit user decision in detailed task output.
- Confirmed skipping a plan step without a reason is rejected, while skipping with a note is accepted.
- Confirmed `pi install ./` records the local package in an isolated Pi config.
- Confirmed npm tarball install contains `dist/` runtime and supports `import("pi-tasks")`.
- Confirmed installed package Pi smoke passes with `--extension ./node_modules/pi-tasks/dist/index.js`.
- Confirmed commercial `plan_steps` flow uses expected output, linked criteria, evidence requirement, and allowed actions.
- Confirmed `task_focus` returns the current active step contract before work proceeds.
- Confirmed evidence-required steps reject `done` before linked evidence exists.
- Confirmed `off_plan` activity without `scope_reason` is rejected, and `off_plan` with `scope_reason` is recorded as a warning.
- Confirmed non-atomic steps reject `done` until recursively decomposed with `task_decompose`.
- Confirmed `task_granularity_check` reports atomicity booleans and directs the agent to decomposition for coarse steps.
- Confirmed decomposition replaces `T1-S1` with atomic child steps `T1-S1.1` and `T1-S1.2`.
- Confirmed step-scoped evidence with `step_ids` prevents evidence for `T1-S1.1` from satisfying `T1-S1.2`, even when both share the same acceptance criterion.
- Confirmed installed package runtime exposes `task_granularity_check` and `task_decompose`, and can replace an installed-package non-atomic step with child steps.
- Confirmed `task_resume` reports current decomposed child step, lineage, next allowed actions, and verification gaps.
- Confirmed `task_checkpoint` persists a snapshot with resume fields and `task_resume` remains stable after checkpoint.
- Confirmed same-session replay after checkpoint restores the current child step `T1-S1.2` and next allowed action `task_evidence`.
- Confirmed English bad atomic plan is rejected by the plan quality gate and returns `pi-tasks resume` recovery guidance.
- Confirmed Chinese bad atomic plan is rejected by the plan quality gate and returns `pi-tasks resume` recovery guidance.
- Confirmed low-quality test evidence without `quality.observedOutput` is rejected and returns `pi-tasks resume` recovery guidance.
- Confirmed valid evidence with `quality.source`, `quality.reproducible`, `quality.verifier`, `quality.artifactRefs`, and `quality.observedOutput` can be recorded and linked to a step.
- Confirmed installed package runtime rejects a bad atomic plan through the same quality gate and returns `pi-tasks resume` recovery guidance.
- Confirmed rejected `task_plan` calls do not consume task IDs; after a rejected invalid plan, the first successful task was still created as `T1`.
- Confirmed weak-model guidance works better when `plan_steps.criterionIds` is omitted during new task creation; generated IDs such as `T1-AC1` are auto-linked after creation.
- Confirmed live PTY `/tasks` renders the active task, step contract, criterion, and verification gaps.
- Confirmed live PTY `/quit` exits cleanly with Pi's resume instruction.
- Confirmed installed package runtime preserves rejected-plan ID behavior through `./node_modules/pi-tasks/dist/index.js`.
- Confirmed final clean tarball install supports `import("pi-tasks")`.
- Confirmed final installed package runtime rejects invalid `task_plan`, then creates the first valid installed-package task as `T1`.
- Confirmed real Pi manual `/compact` fired a native compaction event and a `pi-tasks` snapshot with `reason: compaction`.
- Confirmed post-compaction replay with `task_resume` restores active task `T1`, current step `T1-S1`, allowed action `task_evidence`, and completion gaps.
- Confirmed interactive `/tree` navigation in a forked live PTY can move to the branch point before valid task creation, where `/tasks` correctly reports `No tasks on this branch.`
- Confirmed 50-column live Pi TUI rendering keeps status/widget lines readable with truncation and does not cover the input line.
- Confirmed token-efficient tool output returns compact `task_resume` guidance rather than full evidence dumps.
- Confirmed `/tasks` defaults to compact one-line task summary and `/tasks detail` explicitly expands step and criterion details.
- Confirmed installed 0.1.2 tarball runtime preserves compact `task_list` output through `./node_modules/pi-tasks/dist/index.js`.

## Commands

Primary task lifecycle:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-dogfood/sessions \
  pi --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_list,task_update,task_evidence,task_decision,task_complete \
  --session-id pi-tasks-dogfood-mvp-2 \
  --name pi-tasks-dogfood-2 \
  -p "Create one pi-tasks dogfood task with two acceptance criteria, update it to 50%, try to complete it before adding evidence, list the criteria ids, add evidence for both criteria, complete it, and list it with evidence."
```

Resume replay:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-dogfood/sessions \
  pi --extension ./index.ts --no-builtin-tools \
  --tools task_list \
  --session-id pi-tasks-dogfood-mvp-2 \
  -p "Resume verification: list current pi-tasks state with done tasks and evidence."
```

Blocked-task display:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-dogfood/sessions \
  pi --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_update,task_list \
  --session-id pi-tasks-dogfood-blocked-2 \
  --name pi-tasks-dogfood-blocked-2 \
  -p "Create one task, mark it blocked with reason, blockedBy external, and neededToUnblock, then list with evidence."
```

Live TTY command and clean exit:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-dogfood/sessions \
  pi --extension ./index.ts --session-id pi-tasks-dogfood-mvp-2
```

Then run `/tasks` and `/quit` in the TTY.

Forked replay:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-dogfood/sessions \
  pi --extension ./index.ts --no-builtin-tools \
  --tools task_list \
  --fork pi-tasks-dogfood-mvp-2 \
  -p "List current pi-tasks state with done tasks and evidence."
```

Release-hardening adversarial scenario:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-dogfood/sessions \
  pi --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_list,task_update,task_evidence,task_decision,task_complete \
  --session-id pi-tasks-release-adversarial-dedupe \
  --name pi-tasks-release-adversarial-dedupe \
  -p "Create a task with three ordered initial steps, then intentionally try out-of-order step completion, premature completion, and duplicate evidence."
```

Installed package smoke:

```sh
npm pack --pack-destination /private/tmp/pi-tasks-release-tarball
cd /private/tmp/pi-tasks-release-consumer
npm install /private/tmp/pi-tasks-release-tarball/pi-tasks-0.1.0.tgz
node -e "import('pi-tasks')"
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-dogfood/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list \
  --session-id pi-tasks-release-installed-package \
  -p "Installed package smoke: create one task with one initial step and one acceptance criterion, mark the step done, add evidence, complete it, and list the final state with evidence."
```

Commercial contract scenario:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-commercial-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_focus,task_update,task_evidence,task_complete,task_list \
  --session-id pi-tasks-commercial-contract \
  --name pi-tasks-commercial-contract \
  -p "Create one task using structured plan_steps, call task_focus, reject step done before evidence, record evidence, close steps, reject off_plan without scope_reason, record off_plan with scope_reason, complete, and list final evidence."
```

Recursive decomposition and step-scoped evidence scenario:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-decomposition-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_focus,task_granularity_check,task_decompose,task_update,task_evidence,task_complete,task_list \
  --session-id pi-tasks-recursive-decomposition-step-evidence \
  --name pi-tasks-recursive-decomposition-step-evidence \
  -p "Create one non-atomic plan step, confirm task_focus and task_granularity_check show needs_breakdown, reject marking it done, decompose it into two atomic child steps that share one criterion, record evidence for only T1-S1.1 with step_ids, reject T1-S1.2 done before its own evidence, then record T1-S1.2 evidence, complete, and list final evidence."
```

Compaction-resilient resume scenario:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-compaction-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_decompose,task_resume,task_checkpoint,task_evidence,task_update,task_list \
  --session-id pi-tasks-compaction-resume \
  --name pi-tasks-compaction-resume \
  -p "Create one non-atomic task, decompose it into atomic child steps, call task_resume, create a task_checkpoint, then report the current child step, lineage, next allowed actions, and verification gaps."
```

Weak-model quality gate scenarios:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-weakmodel-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_resume \
  --session-id weakmodel-plan-gate-en \
  --name weakmodel-plan-gate-en \
  -p "Plan quality gate dogfood. Call task_plan once with a deliberately bad atomic step and report the exact error and recovery guidance."
```

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-weakmodel-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_evidence,task_resume \
  --session-id weakmodel-evidence-gate-en2 \
  --name weakmodel-evidence-gate-en2 \
  -p "Create a valid task, then record test evidence without quality.observedOutput and report the exact rejection."
```

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-weakmodel-dogfood/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_resume \
  --session-id weakmodel-plan-gate-zh \
  --name weakmodel-plan-gate-zh \
  -p "中文品質閘門測試。請呼叫 task_plan 建立一個故意很差的 atomic step，回報 exact error，並確認 recovery guidance 是否包含 pi-tasks resume。"
```

Rejected-plan ID regression and live PTY command:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_plan,task_list \
  --session-id id-regression-1 \
  --name id-regression-1 \
  -p "First call task_plan with a deliberately invalid vague atomic step missing allowedActions so it is rejected. Then call task_plan with a valid task named ID Regression, one acceptance criterion, and one atomic plan step with allowedActions [\"task_evidence\"]. Do not set criterionIds manually. Finally call task_list and report the created task id."
```

Then open the same session in a PTY and run `/tasks` and `/quit`:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --session-id id-regression-1
```

Manual compaction and post-compaction resume:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --session-id id-regression-1
```

Then run `/compact pi-tasks commercial release dogfood: preserve task state and resume contract` and `/quit`.

Observed transcript evidence:

- transcript: `/private/tmp/pi-tasks-id-regression/sessions/2026-06-19T10-15-30-295Z_id-regression-1.jsonl`
- native compaction: `2cfcc4a9`, `tokensBefore: 3663`
- pi-tasks snapshot: `snapshot-2026-06-19T13:31:35.340Z`
- snapshot reason: `compaction`
- snapshot resume task: `T1`
- snapshot gaps: `T1-S1 step pending`, `T1-AC1 pending`, `no evidence`

Then verify replay after compaction:

```sh
gtimeout 60s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_list \
  --session-id id-regression-1 \
  -p "After manual compaction, call task_resume and task_list. Report the active task id, current step, and verification gaps."
```

Observed result: active task `T1`, current step `T1-S1`, allowed action `task_evidence`, gaps `no evidence` and `T1-AC1 pending`.

Interactive branch divergence navigation:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --fork id-regression-1 --name branch-live-fork-1
```

Then run `/tasks`, run `/tree`, select the point after the rejected invalid `task_plan` but before valid `T1` creation, choose `No summary`, and run `/tasks`.

Observed result: Pi reports `Navigated to selected point`, and `/tasks` reports `No tasks on this branch.`

Narrow terminal live TUI:

```sh
stty cols 50 rows 24
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-id-regression/sessions \
  pi --no-extensions --extension ./index.ts --session-id id-regression-1
```

Then run `/tasks` and `/quit`.

Observed result: at 50 columns, the active-task widget wraps/truncates long `next` and `gaps` text, `/tasks` output wraps inside the terminal width, and the input line remains usable.

Installed package ID regression:

```sh
rm -rf /private/tmp/pi-tasks-installed-smoke-3
mkdir -p /private/tmp/pi-tasks-installed-smoke-3/consumer /private/tmp/pi-tasks-installed-smoke-3/sessions
cd /private/tmp/pi-tasks-installed-smoke-3/consumer
npm init -y
npm install /private/tmp/pi-tasks-release-check-3/tarball/pi-tasks-0.1.0.tgz
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-installed-smoke-3/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_list \
  --session-id installed-id-regression-1 \
  --name installed-id-regression-1 \
  -p "First call task_plan with a deliberately invalid vague atomic step missing allowedActions so it is rejected. Then create a valid task named Installed ID Regression with one criterion and one atomic plan step with allowedActions [\"task_evidence\"]. Do not set criterionIds manually. Call task_list and report the created task id."
```

Final clean tarball install and installed-package runtime:

```sh
rm -rf /private/tmp/pi-tasks-final-release
mkdir -p /private/tmp/pi-tasks-final-release/tarball /private/tmp/pi-tasks-final-release/consumer /private/tmp/pi-tasks-final-release/sessions
npm pack --pack-destination /private/tmp/pi-tasks-final-release/tarball
cd /private/tmp/pi-tasks-final-release/consumer
npm init -y
npm install /private/tmp/pi-tasks-final-release/tarball/pi-tasks-0.1.0.tgz
node -e "import('pi-tasks')"
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-final-release/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_list \
  --session-id final-installed-smoke-1 \
  --name final-installed-smoke-1 \
  -p "Installed package final smoke. First call task_plan with a deliberately invalid vague atomic step missing allowedActions so it is rejected. Then create a valid task named Final Installed Smoke with one acceptance criterion and one atomic plan step with allowedActions [\"task_evidence\"]. Do not set criterionIds manually. Call task_list and report the created task id."
```

Observed result: invalid `task_plan` rejected with `expected output is too short; step text uses vague or broad wording; allowedActions are required`; valid installed-package task created as `T1: Final Installed Smoke`; `task_list` confirmed `T1` active.

Token-efficient output smoke:

```sh
rm -rf /private/tmp/pi-tasks-token-smoke
mkdir -p /private/tmp/pi-tasks-token-smoke/sessions
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-token-smoke/sessions \
  pi --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_plan,task_list,task_resume \
  --session-id token-output-smoke-1 \
  --name token-output-smoke-1 \
  -p "Token output smoke. Create a valid task named Token Output Smoke with one acceptance criterion and one atomic plan step with allowedActions [\"task_evidence\"]. Do not set criterionIds manually. After task_plan, call task_list without include_evidence and task_resume. Report whether the task_plan result was compact resume guidance rather than a full evidence dump."
```

Observed result: created `T1: Token Output Smoke`; `task_plan` returned compact `pi-tasks resume` guidance; `task_list` without `include_evidence` returned only `T1 [active] 1% criteria:0/1 - Token Output Smoke`.

Then open the same session in a PTY:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-token-smoke/sessions \
  pi --no-extensions --extension ./index.ts --session-id token-output-smoke-1
```

Observed result:

- `/tasks` returned compact summary only: `T1 [active] 1% criteria:0/1 - Token Output Smoke`.
- `/tasks detail` expanded step and criterion details, including `criteria:T1-AC1`.
- `/quit` exited cleanly.

Installed 0.1.2 token output smoke:

```sh
rm -rf /private/tmp/pi-tasks-token-release-check
mkdir -p /private/tmp/pi-tasks-token-release-check/tarball /private/tmp/pi-tasks-token-release-check/consumer /private/tmp/pi-tasks-token-release-check/sessions
npm pack --pack-destination /private/tmp/pi-tasks-token-release-check/tarball
cd /private/tmp/pi-tasks-token-release-check/consumer
npm init -y
npm install /private/tmp/pi-tasks-token-release-check/tarball/pi-tasks-0.1.2.tgz
node -e "import('pi-tasks')"
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-token-release-check/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_list \
  --session-id token-installed-smoke-1 \
  --name token-installed-smoke-1 \
  -p "Installed token output smoke. Create a valid task named Installed Token Smoke with one acceptance criterion and one atomic plan step with allowedActions [\"task_evidence\"]. Do not set criterionIds manually. Then call task_list without include_evidence and report whether the result is compact."
```

Observed result: installed runtime created `T1: Installed Token Smoke`; `task_list` without `include_evidence` returned compact single-line summary without evidence details.

## Package Gates

Also passed on 2026-06-19:

- `npm run typecheck`
- `npm run check`
- `npm test` (42 unit tests)
- `npm run build`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `node -e "import('./dist/index.js')"`
- `npm pack --dry-run` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`
- `npm pack --pack-destination /private/tmp/pi-tasks-final-release/tarball`
- clean consumer `npm install /private/tmp/pi-tasks-final-release/tarball/pi-tasks-0.1.0.tgz`
- clean consumer `node -e "import('pi-tasks')"`
- `npm audit --audit-level=low` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`
- installed-package Pi smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.1.2 clean tarball install plus `node -e "import('pi-tasks')"`
- 0.1.2 installed-package token-output Pi smoke through `./node_modules/pi-tasks/dist/index.js`

## Remaining Runtime Coverage

No remaining runtime coverage gaps are known for the 0.1.0 release scope.

Known runtime note:

- Long multi-step Pi self-correction prompts can still stall at the external agent layer; short staged prompts are verified and should remain the recommended release dogfood style.
