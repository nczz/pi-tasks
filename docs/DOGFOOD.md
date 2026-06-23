# pi-tasks Dogfood Checklist

This document tracks real Pi dogfood evidence. Skipped items are not counted as passed.

## Current Status

Date: 2026-06-23

Result: passed for the scoped MVP dogfood gate, release-hardening dogfood gate, weak-model release gate, installed-package smoke, and 0.1.5 receiver-bound append compatibility release gate.

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
- Weak-model hardening session directory: `/private/tmp/pi-tasks-weakmodel-hardening/sessions`
- Weak-model hardening session ID: `weakmodel-hardening-1`
- Installed weak-model hardening session directory: `/private/tmp/pi-tasks-weakmodel-release-check/sessions`
- Installed weak-model hardening session ID: `weakmodel-installed-hardening-1`
- 0.1.3 release dogfood session directory: `/private/tmp/pi-tasks-release-013-dogfood/sessions`
- 0.1.3 English weak-model session ID: `release-013-weak-en`
- 0.1.3 Chinese weak-model session ID: `release-013-weak-zh`
- 0.1.3 final installed package session directory: `/private/tmp/pi-tasks-release-013-installed-final/sessions`
- 0.1.3 final installed weak-model session ID: `release-013-installed-final-weak`
- 0.1.5 release dogfood session directory: `/private/tmp/pi-tasks-release-015-dogfood/sessions`
- 0.1.5 source lifecycle session ID: `release-015-source-lifecycle`
- 0.1.5 fork replay session name: `release-015-fork-replay`
- 0.1.5 final installed package smoke directory: `/private/tmp/pi-tasks-release-015-installed-final2`
- 0.1.5 final installed package smoke session ID: `release-015-installed-final2-smoke`

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
- Confirmed `task_next` returns one-step weak-model guidance with only next tool, current-step lock, blocked tools, and minimum params.
- Confirmed compound atomic step wording is rejected by the plan quality gate.
- Confirmed future-step evidence is rejected unless current-step lock is overridden with an explicit reason.
- Confirmed oversized evidence summary is rejected and long output is directed to artifact references.
- Confirmed installed 0.1.2 tarball runtime exposes `task_next` and structured recovery for compound atomic rejection.
- Confirmed `npm run release:check` passes for 0.1.3, including typecheck, check, unit tests, build, source/dist import smokes, pack dry-run, clean tarball install, and audit.
- Confirmed fixed weak-model dogfood prompts are stored under `docs/dogfood-prompts/`.
- Confirmed 0.1.3 source runtime rejects English compound atomic wording, oversized evidence summaries, and future-step evidence without override while `task_next` returns the current-step lock and only next tool.
- Confirmed 0.1.3 source runtime rejects Chinese compound atomic wording and returns structured recovery with `retry_with` and `do_not_retry_same_call`.
- Confirmed 0.1.3 installed tarball runtime exposes `task_next` and structured recovery through `./node_modules/pi-tasks/dist/index.js`.
- Confirmed 0.1.5 source runtime creates and completes task `T1` with decision `D1`, evidence `E1`, status `done`, 100% progress, and criterion `1/1` for receiver-bound append compatibility dogfood.
- Confirmed 0.1.5 same-session resume restores completed task `T1`, evidence `E1`, and decision `D1`.
- Confirmed 0.1.5 fork replay restores completed task `T1`, evidence `E1`, decision `D1`, and satisfied criterion state.
- Confirmed live TTY `/tasks` default excludes done tasks, while `/tasks detail` renders `T1 [done]`, decision `D1`, evidence `E1`, and criterion `T1-AC1`.
- Confirmed live TTY `/quit` exits cleanly and prints the Pi resume command.
- Confirmed 0.1.5 clean tarball install supports `import("pi-tasks")` and installed-package Pi runtime creates task `T1` through `./node_modules/pi-tasks/dist/index.js`.

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

Weak-model hardening dogfood:

```sh
rm -rf /private/tmp/pi-tasks-weakmodel-hardening
mkdir -p /private/tmp/pi-tasks-weakmodel-hardening/sessions
gtimeout 180s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-weakmodel-hardening/sessions \
  pi --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_next,task_plan,task_evidence,task_list \
  --session-id weakmodel-hardening-1 \
  --name weakmodel-hardening-1 \
  -p "Weak-model hardening dogfood. First call task_next with no active task. Then call task_plan once with a deliberately invalid atomic step text 'Run tests and update docs' so compound wording is rejected. Then create a valid task named Weak Model Hardening with one acceptance criterion and two atomic plan steps; omit criterionIds manually; each step must have one action, one output, one verification method, allowedActions [\"task_evidence\"], and no compound wording. Then call task_evidence once targeting future step T1-S2 while current step is T1-S1 so current-step lock rejects it. Then call task_evidence once with a summary longer than 501 characters so evidence budget rejects it. Finally call task_next and task_list without include_evidence, and report exact rejections plus the only next tool."
```

Observed result:

- compound atomic rejection: `Plan step 1 failed quality gate: step text uses vague or broad wording; step text appears to contain multiple actions`
- future-step evidence rejection: `Evidence step_ids must target current step T1-S1; overrideReason is required for T1-S2`
- oversized evidence rejection: `Evidence summary exceeds 500 characters; put long output in artifactRefs`
- final `task_next`: only next tool `task_evidence`, current step lock `T1-S1`, minimum params include `task_id`, `step_ids`, `criterion_ids`, and `references`
- compact `task_list`: `T1 [active] 1% criteria:0/1 - Weak Model Hardening`

Installed 0.1.2 weak-model hardening smoke:

```sh
rm -rf /private/tmp/pi-tasks-weakmodel-release-check
mkdir -p /private/tmp/pi-tasks-weakmodel-release-check/tarball /private/tmp/pi-tasks-weakmodel-release-check/consumer /private/tmp/pi-tasks-weakmodel-release-check/sessions
npm pack --pack-destination /private/tmp/pi-tasks-weakmodel-release-check/tarball
cd /private/tmp/pi-tasks-weakmodel-release-check/consumer
npm init -y
npm install /private/tmp/pi-tasks-weakmodel-release-check/tarball/pi-tasks-0.1.2.tgz
node -e "import('pi-tasks')"
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-weakmodel-release-check/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_next,task_plan \
  --session-id weakmodel-installed-hardening-1 \
  --name weakmodel-installed-hardening-1 \
  -p "Installed weak-model smoke. Call task_next with no active task. Then call task_plan with one deliberately invalid atomic step text 'Run tests and update docs' and report whether compound wording is rejected with structured recovery."
```

Observed result: installed runtime exposed `task_next`; compound atomic step was rejected; structured recovery included `retry_with: task_plan`, `do_not_retry_same_call: true`, a reason, and resume guidance.

0.1.3 release check:

```sh
npm run release:check
```

Observed result: passed. The gate ran typecheck, Biome check, 48 unit tests, build, source import smoke, dist import smoke, npm pack dry-run, clean tarball install plus `node -e "import('pi-tasks')"`, and `npm audit --audit-level=low`.

0.1.3 source weak-model hardening dogfood:

```sh
rm -rf /private/tmp/pi-tasks-release-013-dogfood
mkdir -p /private/tmp/pi-tasks-release-013-dogfood/sessions
gtimeout 180s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-013-dogfood/sessions \
  pi --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_next,task_plan,task_evidence,task_list \
  --session-id release-013-weak-en \
  --name release-013-weak-en \
  -p "<docs/dogfood-prompts/weak-model-en.md source extension prompt>"
```

Observed result:

- compound atomic rejection: `Plan step 1 failed quality gate: step text uses vague or broad wording; step text appears to contain multiple actions`
- oversized evidence rejection: `Evidence summary exceeds 500 characters; put long output in artifactRefs`
- final `task_next`: only next tool `task_evidence`, current step lock `T1-S1`
- compact `task_list`: `T1 [active] 1% criteria:0/1 - Weak Model Hardening`

0.1.3 current-step lock probe:

```sh
gtimeout 90s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-013-dogfood/sessions \
  pi --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_evidence,task_next \
  --session-id release-013-weak-en \
  --name release-013-weak-en \
  -p "Current-step lock probe. The active task is T1 and the current step should be T1-S1. Call task_evidence once for task_id T1 targeting future step_ids [\"T1-S2\"] and criterion_ids [\"T1-AC1\"]. Use complete quality fields and do not provide override_reason. Report the exact rejection and then call task_next."
```

Observed result: `Evidence step_ids must target current step T1-S1; overrideReason is required for T1-S2`; `task_next` still reported only next tool `task_evidence` and current step lock `T1-S1`.

0.1.3 Chinese weak-model smoke:

```sh
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-013-dogfood/sessions \
  pi --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_next,task_plan,task_list \
  --session-id release-013-weak-zh \
  --name release-013-weak-zh \
  -p "<docs/dogfood-prompts/weak-model-zh-TW.md installed package smoke prompt>"
```

Observed result: no active task caused `task_next` to recommend `task_plan`; Chinese compound wording was rejected; structured recovery included `retry_with: task_plan` and `do_not_retry_same_call: true`.

0.1.3 final installed package weak-model smoke:

```sh
rm -rf /private/tmp/pi-tasks-release-013-installed-final
mkdir -p /private/tmp/pi-tasks-release-013-installed-final/tarball /private/tmp/pi-tasks-release-013-installed-final/consumer /private/tmp/pi-tasks-release-013-installed-final/sessions
npm pack --pack-destination /private/tmp/pi-tasks-release-013-installed-final/tarball
cd /private/tmp/pi-tasks-release-013-installed-final/consumer
npm init -y
npm install /private/tmp/pi-tasks-release-013-installed-final/tarball/pi-tasks-0.1.3.tgz
node -e "import('pi-tasks')"
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-013-installed-final/sessions \
  pi --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_next,task_plan \
  --session-id release-013-installed-final-weak \
  --name release-013-installed-final-weak \
  -p "<docs/dogfood-prompts/weak-model-en.md installed package smoke prompt>"
```

Observed result: installed runtime exposed `task_next`; compound atomic step was rejected; structured recovery included `retry_with: task_plan`, `do_not_retry_same_call: true`, and no-active-task resume guidance. Final tarball shasum: `9a3d50a4b97088fb551e36e024b29f5547091e59`.

0.1.5 receiver-bound append compatibility source dogfood:

```sh
gtimeout 180s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-015-dogfood/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_decision,task_complete,task_list \
  --session-id release-015-source-lifecycle \
  --name release-015-source-lifecycle \
  -p "Release 0.1.5 source dogfood. Create a valid task named Receiver Append Compatibility with one acceptance criterion and one atomic plan step. Do not set criterionIds manually. Update progress to 50 and next_action to record evidence. Record one agent decision about supporting receiver-bound appendEntry methods. Record passing test evidence for T1-AC1 and T1-S1 with complete quality fields. Mark T1-S1 done with evidence E1. Complete T1 with evidence E1. Call task_list with include_done=true and include_evidence=true. Report created task id, decision id, evidence id, and final status."
```

Observed result: created task `T1`, decision `D1`, evidence `E1`, final status `done`, progress `100%`, criteria `1/1`, evidence `1`.

0.1.5 same-session resume:

```sh
gtimeout 90s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-015-dogfood/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list,task_resume \
  --session-id release-015-source-lifecycle \
  -p "Release 0.1.5 resume dogfood. Call task_resume and task_list with include_done=true and include_evidence=true. Report whether task T1 is restored as done with evidence E1 and decision D1."
```

Observed result: `T1` restored as done, evidence `E1` present, decision `D1` present, and no active task after completion.

0.1.5 fork replay:

```sh
gtimeout 90s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-015-dogfood/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list \
  --fork release-015-source-lifecycle \
  --name release-015-fork-replay \
  -p "Release 0.1.5 fork replay dogfood. Call task_list with include_done=true and include_evidence=true. Report whether fork replay restored task T1 as done with evidence E1."
```

Observed result: fork replay restored `T1` as done with evidence `E1`, decision `D1`, and acceptance criteria `1/1` satisfied.

0.1.5 live TTY `/tasks` and clean exit:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-015-dogfood/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --session-id release-015-source-lifecycle
```

Observed result: `/tasks` returned `No tasks on this branch.` because compact default excludes completed tasks; `/tasks detail` rendered `T1 [done]`, decision `D1`, evidence `E1`, and `T1-AC1`; `/quit` exited cleanly and printed the Pi resume command.

0.1.5 final installed package smoke:

```sh
mkdir -p /private/tmp/pi-tasks-release-015-installed-final2/tarball /private/tmp/pi-tasks-release-015-installed-final2/consumer /private/tmp/pi-tasks-release-015-installed-final2/sessions
env npm_config_cache=/private/tmp/pi-tasks-release-015-installed-final2/npm-cache \
  npm pack --pack-destination /private/tmp/pi-tasks-release-015-installed-final2/tarball
cd /private/tmp/pi-tasks-release-015-installed-final2/consumer
npm init -y
env npm_config_cache=/private/tmp/pi-tasks-release-015-installed-final2/npm-cache \
  npm install /private/tmp/pi-tasks-release-015-installed-final2/tarball/pi-tasks-0.1.5.tgz
node -e "import('pi-tasks')"
gtimeout 120s env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-015-installed-final2/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_list \
  --session-id release-015-installed-final2-smoke \
  --name release-015-installed-final2-smoke \
  -p "Release 0.1.5 final installed package smoke. Create a valid task named Final Installed Receiver Smoke with one acceptance criterion and one atomic plan step. Do not set criterionIds manually. Call task_list and report the created task id and current status."
```

Observed result: tarball `pi-tasks-0.1.5.tgz` was created; clean consumer import passed; installed runtime created task `T1` with status `active`.

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
- weak-model hardening Pi dogfood for `task_next`, compound plan rejection, current-step evidence lock, and evidence budget rejection
- 0.1.2 installed-package weak-model smoke for `task_next` and structured recovery
- 0.1.3 `npm run release:check`
- 0.1.3 source weak-model English and Chinese dogfood
- 0.1.3 installed-package weak-model smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.1.5 source lifecycle, same-session resume, fork replay, live `/tasks detail`, and clean `/quit`
- 0.1.5 clean tarball install plus installed-package Pi smoke through `./node_modules/pi-tasks/dist/index.js`

## Remaining Runtime Coverage

No remaining runtime coverage gaps are known for the 0.1.0 release scope.

Known runtime note:

- Long multi-step Pi self-correction prompts can still stall at the external agent layer; short staged prompts are verified and should remain the recommended release dogfood style.
