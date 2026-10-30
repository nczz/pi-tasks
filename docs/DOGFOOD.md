# pi-tasks Dogfood Checklist

This document tracks real Pi dogfood evidence. Skipped items are not counted as passed.

## Current Status

Date: 2026-10-30

Result: passed through the 0.3.0 native semantic assessment release gate, including real Pi and Oh My Pi model boundaries, deterministic replay, English and Traditional Chinese semantic cases, and prior release scopes.

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
- 0.2.0 release dogfood session directory: `/private/tmp/pi-tasks-release-020-dogfood/sessions`
- 0.2.0 source lifecycle session ID: `release-020-source-lifecycle-2`
- 0.2.0 fork replay session ID: `release-020-fork-replay`
- 0.2.0 observer extension path: `/private/tmp/pi-tasks-state-observer.ts`
- 0.2.0 observer event log: `/private/tmp/pi-tasks-state-events-020.jsonl`
- 0.2.0 installed package smoke directory: `/private/tmp/pi-tasks-release-020-installed`
- 0.2.0 installed package session ID: `release-020-installed-smoke`
- 0.2.0 large compaction session directory: `/private/tmp/pi-tasks-release-020-compact/sessions`
- 0.2.0 large compaction session ID: `release-020-large-compact`
- 0.2.0 large compaction seed prompt: `/private/tmp/pi-tasks-large-compact-prompt.md`
- 0.2.4 Issue #3 weak-model session root: `/private/tmp/pi-tasks-issue3-ornith15-fixed`
- 0.2.4 Issue #3 weak-model summary: `/private/tmp/pi-tasks-issue3-ornith15-fixed/summary2.json`
- 0.2.4 Issue #3 weak-model model: `llama.cpp/bartowski/Ornith-1.5-35B-A3B-GGUF:Q6_K_L`
- 0.2.5 Issue #4 source session root: `/private/tmp/pi-tasks-release-025/sessions`
- 0.2.5 Issue #4 source lifecycle session ID: `release-025-source-lifecycle`
- 0.2.5 Issue #4 fork replay session name: `release-025-fork-replay`
- 0.2.5 Issue #4 installed package smoke root: `/private/tmp/pi-tasks-release-025-installed`
- 0.2.5 Issue #4 installed package session ID: `release-025-installed-smoke`
- 0.2.5 weak-model prompt session root: `/private/tmp/pi-tasks-release-025-weak/sessions`
- 0.2.5 English weak-model session ID: `release-025-weak-en-final`
- 0.2.5 Traditional Chinese weak-model session ID: `release-025-weak-zh-final`
- 0.2.5 installed weak-model session ID: `release-025-installed-weak`
- 0.2.6 vague evidence source session root: `/private/tmp/pi-tasks-release-026/sessions`
- 0.2.6 source Chinese vague evidence session ID: `release-026-source-vague`
- 0.2.6 English weak-model session ID: `release-026-weak-en`
- 0.2.6 resume session ID: `release-026-resume`
- 0.2.6 fork replay session ID: `release-026-fork`
- 0.2.6 installed package smoke root: `/private/tmp/pi-tasks-release-026-installed`
- 0.2.6 installed package session ID: `release-026-installed-vague`
- 0.3.0 dogfood root: `/tmp/pi-tasks-030`
- 0.3.0 Pi version/model: `1.3.0`, `openai-codex/gpt-5.6-sol`
- 0.3.0 Pi lifecycle transcript: `/tmp/pi-tasks-030/pi-sessions/2026-10-30T18-19-33-176Z_pi-tasks-030-lifecycle-2.jsonl`
- 0.3.0 Pi English semantic transcript: `/tmp/pi-tasks-030/weak-pi/2026-10-30T18-32-14-908Z_weak-en-final.jsonl`
- 0.3.0 Oh My Pi version/model: `18.14.0`, `google-antigravity/gemini-2.5-flash`
- 0.3.0 OMP lifecycle transcript: `/tmp/pi-tasks-030/omp-sessions/2026-10-30T18-26-31-223Z_01a18e10-3cb7-762f-bc1f-77654068ea7d.jsonl`
- 0.3.0 OMP Traditional Chinese semantic transcript: `/tmp/pi-tasks-030/weak-omp-final/2026-10-30T18-32-50-660Z_01a18e16-06e4-7156-91c8-ef54de7742ef.jsonl`
- 0.3.0 installed-tarball Pi transcript: `/tmp/pi-tasks-030/installed/2026-10-30T18-40-32-511Z_installed-semantic-release-final.jsonl`

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
- Confirmed 0.2.0 source runtime publishes `pi-tasks:state` on `session_start` and successful task mutations with stable widget id `pi-tasks`, active task `T1`, and no raw `events` field.
- Confirmed 0.2.0 same-session resume restores active task `T1` and publishes a `session_start` state event.
- Confirmed 0.2.0 fork replay restores active task `T1` and publishes a `session_start` state event.
- Confirmed 0.2.0 live TTY `/tasks` renders active task `T1`; `/quit` exits cleanly.
- Confirmed 0.2.0 installed tarball supports `import("pi-tasks")` and installed runtime publishes `pi-tasks:state` for `session_start` and `task_mutation`.
- Confirmed 0.2.0 large-session manual `/compact` compacted from 56,203 tokens and emitted a `task_mutation` state event for active task `T1` without raw `events`.
- Confirmed 0.2.4 Oh My Pi weak-model schema compatibility for `task_evidence type=command`: ornith1.5 recorded passing command evidence on the first attempt with `quality.command`, `quality.observedOutput`, `quality.artifactRefs`, and top-level `references`.
- Confirmed 0.2.4 Issue #3 recovery flow: ornith1.5 intentionally submitted invalid command evidence once, then used the rejected call's copyable retry example shape to submit corrected evidence without duplicating the failed payload.
- Confirmed 0.2.4 `task_evidence type=test` and `type=review` remain usable with the flat OMP-compatible quality schema; review evidence uses `quality.command` as a verification-action label rather than a fake shell command.
- Confirmed 0.2.4 Traditional Chinese weak-model command evidence records successfully on the first attempt after `references` was made schema-required.
- Confirmed 0.2.4 Issue #3 transcript analysis found zero duplicate `task_evidence` payload loops across final ornith1.5 sessions.
- Confirmed 0.2.5 `task_complete` accepts a step/criterion-linked failed evidence item only after a later passing evidence item explicitly lists it in `supersedes` and links to the same step/criterion.
- Confirmed 0.2.5 `task_list include_evidence=true` renders `supersedes:E1` so the failed gate stays visible in lineage.
- Confirmed 0.2.5 same-session resume restores completed task `T1` with `E2 supersedes:E1` and evidence `E3`.
- Confirmed 0.2.5 fork replay restores completed task `T1` with superseded failed evidence lineage intact.
- Confirmed 0.2.5 live TTY `/tasks` default excludes completed tasks, `/tasks detail` renders completed supersedes evidence, and `/quit` exits cleanly with exit code 0.
- Confirmed 0.2.5 installed package runtime creates and completes a supersedes smoke task through `./node_modules/pi-tasks/dist/index.js`.
- Confirmed 0.2.5 English weak-model source prompt rejects compound atomic wording, future-step evidence without override, and oversized evidence summary while `task_next` keeps `task_evidence` as the only next tool.
- Confirmed 0.2.5 Traditional Chinese weak-model source prompt rejects compound atomic wording, future-step evidence without override, and oversized evidence summary while `task_next` keeps `task_evidence` as the only next tool.
- Confirmed 0.2.5 installed weak-model smoke rejects compound atomic wording and returns structured recovery with `retry_with: task_plan` and `do_not_retry_same_call: true`.

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

0.2.0 state-event source dogfood:

```sh
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-builtin-tools \
  --tools task_plan,task_update,task_list,state_event_report \
  --session-dir /private/tmp/pi-tasks-release-020-dogfood/sessions \
  --session-id release-020-source-lifecycle-2 \
  --name release-020-source-lifecycle-2 \
  -p "Release dogfood for pi-tasks 0.2.0. Use only the enabled tools. Step 1 call task_plan to create an active task titled \"0.2.0 state hook dogfood\" with objective \"Verify state hook publication\" and one acceptance criterion \"State hook publishes after mutation\". Include one atomic plan step with expected output \"Observed state_event_report output\" and evidenceRequired false. Step 2 call task_update to set progress to 50 and next_action to \"Inspect state hook report\". Step 3 call state_event_report. Step 4 call task_list. In your final answer, include the state_event_report JSON exactly."
```

Observed result: `state_event_report` returned `count: 3`, reasons `session_start`, `task_mutation`, `task_mutation`, stable widget id `pi-tasks`, active task `T1`, and `lastHasRawEvents: false`.

0.2.0 same-session resume:

```sh
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-builtin-tools \
  --tools task_list,state_event_report \
  --session-dir /private/tmp/pi-tasks-release-020-dogfood/sessions \
  --session-id release-020-source-lifecycle-2 \
  -p "Resume dogfood for pi-tasks 0.2.0. Use task_list to list the current active task, then call state_event_report. Final answer must include the state_event_report JSON exactly and mention whether T1 replayed."
```

Observed result: `T1` replayed; `state_event_report` returned `count: 1`, reason `session_start`, stable widget id `pi-tasks`, active task `T1`, and `lastHasRawEvents: false`.

0.2.0 fork replay:

```sh
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-builtin-tools \
  --tools task_list,state_event_report \
  --session-dir /private/tmp/pi-tasks-release-020-dogfood/sessions \
  --fork release-020-source-lifecycle-2 \
  --session-id release-020-fork-replay \
  -p "Fork replay dogfood for pi-tasks 0.2.0. Use task_list to list the current active task, then call state_event_report. Final answer must include the state_event_report JSON exactly and mention whether T1 replayed in the fork."
```

Observed result: `T1` replayed in the fork; `state_event_report` returned `count: 1`, reason `session_start`, stable widget id `pi-tasks`, active task `T1`, and `lastHasRawEvents: false`.

0.2.0 live TTY `/tasks`, `/compact`, and clean exit:

```sh
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --session-dir /private/tmp/pi-tasks-release-020-dogfood/sessions \
  --session-id release-020-source-lifecycle-2
```

Observed result: `/tasks` rendered active task `T1`; `/compact` on the small source lifecycle session reported `Compaction failed: Nothing to compact (session too small)` and was not counted as manual compaction coverage; `/quit` exited cleanly with exit code 0.

0.2.0 large-session manual `/compact`:

```sh
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-builtin-tools \
  --tools task_plan,state_event_report \
  --session-dir /private/tmp/pi-tasks-release-020-compact/sessions \
  --session-id release-020-large-compact \
  --name release-020-large-compact \
  -p "Create a pi-tasks 0.2.0 large compaction dogfood task. Use task_plan to create an active task titled \"0.2.0 large compaction dogfood\" with objective \"Verify manual compact emits state\" and one acceptance criterion \"Manual compact emits pi-tasks state\". Include one atomic plan step with expected output \"Observer log contains task_mutation after compact\" and evidenceRequired false. Then call state_event_report and include its JSON exactly."
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-tools \
  --session-dir /private/tmp/pi-tasks-release-020-compact/sessions \
  --session-id release-020-large-compact \
  -p @/private/tmp/pi-tasks-large-compact-prompt.md
pi --no-extensions \
  --extension ./index.ts \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --session-dir /private/tmp/pi-tasks-release-020-compact/sessions \
  --session-id release-020-large-compact
```

Observed result: live `/compact` compacted from 56,203 tokens; observer log recorded `session_start` and `task_mutation` events with stable widget id `pi-tasks`, active task `T1`, and `hasRawEvents: false`; `/quit` exited cleanly with exit code 0.

0.2.0 final installed package smoke:

```sh
mkdir -p /private/tmp/pi-tasks-release-020-installed/tarball /private/tmp/pi-tasks-release-020-installed/consumer /private/tmp/pi-tasks-release-020-installed/sessions
npm pack --pack-destination /private/tmp/pi-tasks-release-020-installed/tarball
cd /private/tmp/pi-tasks-release-020-installed/consumer
npm init -y
npm install /private/tmp/pi-tasks-release-020-installed/tarball/pi-tasks-0.2.0.tgz
node -e "import('pi-tasks')"
pi --no-extensions \
  --extension ./node_modules/pi-tasks/dist/index.js \
  --extension /private/tmp/pi-tasks-state-observer.ts \
  --no-builtin-tools \
  --tools task_plan,task_list,state_event_report \
  --session-dir /private/tmp/pi-tasks-release-020-installed/sessions \
  --session-id release-020-installed-smoke \
  --name release-020-installed-smoke \
  -p "Installed package dogfood for pi-tasks 0.2.0. Use task_plan to create an active task titled \"Installed 0.2.0 state hook smoke\" with one acceptance criterion \"Installed state hook publishes\" and one atomic plan step with expected output \"state_event_report output observed\" and evidenceRequired false. Then call state_event_report and task_list. Final answer must include the state_event_report JSON exactly."
```

Observed result: tarball `pi-tasks-0.2.0.tgz` was created; clean consumer import passed; installed runtime created task `T1`; `state_event_report` returned `count: 2`, reasons `session_start`, `task_mutation`, stable widget id `pi-tasks`, active task `T1`, and `lastHasRawEvents: false`.

0.2.5 Issue #4 source supersedes lifecycle:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list,task_resume,task_next \
  --session-id release-025-source-lifecycle \
  --name release-025-source-lifecycle \
  -p "Release 0.2.5 source dogfood. Create a supersedes task, record failed linked evidence E1, record passing linked evidence E2 with supersedes E1, complete the task, and list evidence."
```

Observed result: created `T1`; recorded failed evidence `E1`; recorded passing evidence `E2` with `supersedes:E1`; recorded unit-test evidence `E3`; completed `T1` at 100%; `task_list include_evidence=true` rendered `E2 ... supersedes:E1`.

0.2.5 same-session resume and fork replay:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list,task_resume \
  --session-id release-025-source-lifecycle \
  -p "Release 0.2.5 resume dogfood. Call task_resume and task_list with include_done=true and include_evidence=true."

env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list,task_resume \
  --fork release-025-source-lifecycle \
  --name release-025-fork-replay \
  -p "Release 0.2.5 fork replay dogfood. Call task_list with include_done=true and include_evidence=true."
```

Observed result: resume and fork replay both restored `T1 [done] 100%`, `E2 supersedes:E1`, `E3`, and `2/2` satisfied criteria.

0.2.5 live TTY `/tasks`, `/tasks detail`, and clean exit:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --session-id release-025-source-lifecycle
```

Observed result: `/tasks` returned `No tasks on this branch.` because compact default excludes completed tasks; `/tasks detail` rendered `T1 [done]` with `E2 ... supersedes:E1`; `/quit` exited cleanly with exit code 0.

0.2.5 installed package supersedes smoke:

```sh
mkdir -p /private/tmp/pi-tasks-release-025-installed/tarball /private/tmp/pi-tasks-release-025-installed/consumer /private/tmp/pi-tasks-release-025-installed/sessions
npm pack --pack-destination /private/tmp/pi-tasks-release-025-installed/tarball
cd /private/tmp/pi-tasks-release-025-installed/consumer
npm init -y
npm install /private/tmp/pi-tasks-release-025-installed/tarball/pi-tasks-0.2.5.tgz
node -e "import('pi-tasks')"
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025-installed/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list \
  --session-id release-025-installed-smoke \
  --name release-025-installed-smoke \
  -p "Release 0.2.5 installed-package smoke. Create and complete a supersedes evidence task."
```

Observed result: clean tarball install supported `import('pi-tasks')`; installed runtime completed `T1` at 100%; `E2 supersedes:E1`.

0.2.5 weak-model source prompts:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025-weak/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_next,task_plan,task_evidence,task_list \
  --session-id release-025-weak-en-final \
  --name release-025-weak-en-final \
  -p @/private/tmp/pi-tasks-release-025-weak/en-source-prompt.md

env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025-weak/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_next,task_plan,task_evidence,task_list \
  --session-id release-025-weak-zh-final \
  --name release-025-weak-zh-final \
  -p @/private/tmp/pi-tasks-release-025-weak/zh-source-prompt.md
```

Observed result: English and Traditional Chinese source prompts both rejected compound atomic wording, future-step evidence without override, and oversized evidence summary; final `task_next` reported only next tool `task_evidence` and current step lock `T1-S1`.

0.2.5 installed weak-model smoke:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-025-installed/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_next,task_plan \
  --session-id release-025-installed-weak \
  --name release-025-installed-weak \
  -p "Installed weak-model smoke. Call task_next with no active task. Then call task_plan with one deliberately invalid atomic step text 'Run tests and update docs' and report whether compound wording is rejected with structured recovery."
```

Observed result: installed runtime rejected compound wording and returned structured recovery with `retry_with: task_plan` and `do_not_retry_same_call: true`.

0.2.6 vague evidence source dogfood:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list \
  --session-id release-026-source-vague \
  --name release-026-source-vague \
  -p @/private/tmp/pi-tasks-release-026/prompts/source-vague-evidence.md
```

Observed result: vague Chinese passing summary `完成了` was rejected with `Evidence summary is too vague for passing evidence (matched "完成了"); describe the observed result`; concrete Chinese summary `畫面顯示完成了並回傳 code 0` was accepted as `E2`; task `T1` completed at `100%`; `task_list include_evidence=true` rendered `E2 evidence integration_test true: 畫面顯示完成了並回傳 code 0`.

0.2.6 resume, fork, live `/tasks`, and clean `/quit`:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list \
  --session-id release-026-source-vague \
  --name release-026-resume \
  -p @/private/tmp/pi-tasks-release-026/prompts/resume-fork.md

env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_list \
  --fork release-026-source-vague \
  --name release-026-fork \
  -p @/private/tmp/pi-tasks-release-026/prompts/resume-fork.md

env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --session-id release-026-source-vague
```

Observed result: resume and fork replay both restored `T1 [done] 100%` and the concrete Chinese evidence summary; live `/tasks detail` rendered `T1 [done]` and the `E2` evidence line; `/quit` exited with code 0.

0.2.6 English weak-model source prompt:

```sh
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list,task_next \
  --session-id release-026-weak-en \
  --name release-026-weak-en \
  -p @/private/tmp/pi-tasks-release-026/prompts/source-vague-evidence-en.md
```

Observed result: vague English passing summary `done` was rejected with matched fragment `done`; concrete English summary `CLI returned MATCH Done/Done` was accepted as `E3`; task `T1` completed at `100%`; detailed task output rendered `E3 evidence e2e_smoke true: CLI returned MATCH Done/Done`.

0.2.6 installed package vague evidence smoke:

```sh
mkdir -p /private/tmp/pi-tasks-release-026-installed/tarball /private/tmp/pi-tasks-release-026-installed/consumer /private/tmp/pi-tasks-release-026-installed/sessions
npm pack --pack-destination /private/tmp/pi-tasks-release-026-installed/tarball
cd /private/tmp/pi-tasks-release-026-installed/consumer
npm install /private/tmp/pi-tasks-release-026-installed/tarball/pi-tasks-0.2.6.tgz
node -e "import('pi-tasks')"
env PI_CODING_AGENT_SESSION_DIR=/private/tmp/pi-tasks-release-026-installed/sessions \
  pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools \
  --tools task_plan,task_update,task_evidence,task_complete,task_list \
  --session-id release-026-installed-vague \
  --name release-026-installed-vague \
  -p @/private/tmp/pi-tasks-release-026/prompts/installed-vague-evidence.md
```

Observed result: clean tarball install supported `import('pi-tasks')`; installed runtime accepted `E1 evidence integration_test true: CLI returned MATCH Done/Done`; task `T1` completed at `100%`.

## 0.2.8 Release Dogfood (2026-10-14)

Release candidate gate:

```sh
PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.2.0/node_modules/@earendil-works/pi-coding-agent \
  npm run release:check
```

Observed result: passed strict typecheck, non-mutating Biome result, 88 unit tests, 7 native Pi SDK tests, build, source/dist import smoke, `npm pack --dry-run`, clean tarball install/import, and `npm audit --audit-level=low` with zero vulnerabilities.

English and Traditional Chinese fixed weak-model prompts:

```sh
pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_next,task_plan,task_evidence,task_update,task_complete,task_list \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --session-id release-028-weak-en-final --name release-028-weak-en-final \
  -p @docs/dogfood-prompts/weak-model-en.md \
  "Execute only the Source Extension Hardening prompt exactly and report the observed tool results."

pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_next,task_plan,task_evidence,task_update,task_complete,task_list \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --session-id release-028-weak-zh-final --name release-028-weak-zh-final \
  -p @docs/dogfood-prompts/weak-model-zh-TW.md \
  "只執行 Source Extension Hardening 段落，精確遵循內容並回報觀察到的工具結果。"
```

Observed result: both prompts entered the task-free state through `task_resume`, rejected compound atomic wording, rejected future-step evidence against the `T1-S1` current-step lock, rejected summaries above 500 characters, and ended with `task_next` naming only `task_evidence`.

Source lifecycle, recovery, resume, fork, and live TUI:

```sh
# The source lifecycle used four short noninteractive prompts against the same
# release-028-lifecycle session for creation, recovery, evidence, update,
# decision, blocker, completion, and task-list checks. The exact inputs and
# tool results remain in the persisted Pi JSONL session.

pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_list \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --session-id release-028-lifecycle --name release-028-resume \
  -p "Call task_list with include_evidence true and report the restored task status, progress, criterion count, and evidence IDs."

pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_list \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --fork release-028-lifecycle --name release-028-fork \
  -p "Call task_list with include_evidence true and report the replayed task status, progress, criterion count, and evidence IDs."

pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --session-id release-028-lifecycle --name release-028-interactive
# In the TUI: /tasks detail, then /quit.
```

Observed result: a real source session accepted the concrete `fixtures/fix.json` plan at quality 100; rejected an out-of-order `T1-S2` update; returned targeted `task_update` recovery for missing `scope_reason`; preserved `task_plan path-keyword acceptance` in the rejected dogfood evidence retry; deduplicated the corrected evidence to `E2`; rendered decision `D1` and blocker `T1-B1`; resolved drift warnings; and completed `T1` at 100% with criterion `1/1` and two evidence records. Same-session resume and fork both restored the completed task. Live `/tasks detail` rendered both evidence records, the resolved blocker, and the decision; `/quit` exited with code 0.

Maximum decomposition depth:

```sh
pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_next,task_plan,task_focus,task_granularity_check,task_decompose,task_update \
  --session-dir /private/tmp/pi-tasks-release-028/sessions \
  --session-id release-028-depth --name release-028-depth \
  -p "Run a real maximum-depth recovery dogfood: create one deferred step, decompose the current first child four times, compare every next-action surface, reject a fifth decomposition, apply the explicit blocker recovery, and confirm task_plan is available without marking work done or creating a successor."
```

Observed result: the current step reached `T1-S1.1.1.1.1` at depth 4. `task_resume`, `task_next`, `task_focus`, and `task_granularity_check` all selected `task_update`; the fifth decomposition was rejected with `retry_with: task_update` and no new persisted decomposition; explicit blocking cleared the active task; the next resume recommended `task_plan`. No unfinished step was marked done and no successor was created automatically.

Installed package smoke:

```sh
mkdir -p /private/tmp/pi-tasks-release-028-installed/tarball \
  /private/tmp/pi-tasks-release-028-installed/consumer \
  /private/tmp/pi-tasks-release-028-installed/sessions
npm pack --pack-destination /private/tmp/pi-tasks-release-028-installed/tarball
cd /private/tmp/pi-tasks-release-028-installed/consumer
npm init -y
npm install /private/tmp/pi-tasks-release-028-installed/tarball/pi-tasks-0.2.8.tgz
node -e "import('pi-tasks')"
npm audit --audit-level=low
pi --provider openai-codex --model gpt-5.5 \
  --no-extensions --extension ./node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools --tools task_resume,task_plan \
  --session-dir /private/tmp/pi-tasks-release-028-installed/sessions \
  --session-id release-028-installed-weak --name release-028-installed-weak \
  -p @/Users/chun/Projects/pi-tasks/docs/dogfood-prompts/weak-model-en.md \
  "Execute only the Installed Package Smoke prompt exactly and report the observed tool results."
```

Observed result: `pi-tasks-0.2.8.tgz` installed and imported in a clean consumer with zero audit vulnerabilities. The installed extension exposed `task_resume`, recommended `task_plan`, rejected `Run tests and update docs`, and returned `retry_with: task_plan` plus `do_not_retry_same_call: true`.

## 0.2.9 Release Dogfood (2026-10-16)

Release candidate gate:

```sh
PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.2.0/node_modules/@earendil-works/pi-coding-agent \
  npm run release:check
```

Observed result: passed strict typecheck, Biome, 89 unit tests, 7 native Pi SDK tests, build, source/dist import smoke, `npm pack --dry-run`, clean `pi-tasks-0.2.9.tgz` install/import, and `npm audit --audit-level=low`.

The same gate also passed after a fresh `git clone --branch v0.2.9 --depth 1`, `npm ci`, and release check from `/private/tmp/pi-tasks-release-029-clean`.

Deterministic large-history reproduction used 500 synthetic historical events. The transition clone received zero historical events, returned 501 events in order, preserved the existing historical references, and isolated mutable task state.

Real Pi 0.87.1 source lifecycle used `openai-codex/gpt-5.6-sol` because `gpt-5.5` was unavailable for the authenticated ChatGPT account:

```sh
pi --provider openai-codex --model gpt-5.6-sol \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_plan,task_update,task_evidence,task_decision,task_complete,task_list \
  --session-dir /private/tmp/pi-tasks-release-029/sessions \
  --session-id release-029-lifecycle-final
```

Observed result: task `T1` was created, updated, blocked, unblocked, given decision `D1` and dogfood evidence `E1`, completed at 100%, and restored with the same resolved blocker, decision, and evidence in both same-session resume and fork replay. Repeating the same evidence returned existing `E1`. A second task rejected `T2-S2` before `T2-S1` and kept `T2-S1` current. Live TUI `/tasks detail` rendered both tasks and `/quit` exited cleanly.

Fixed English and Traditional Chinese weak-model source prompts:

```sh
pi --provider openai-codex --model gpt-5.6-sol \
  --no-extensions --extension ./index.ts --no-builtin-tools \
  --tools task_resume,task_next,task_plan,task_evidence,task_update,task_complete,task_list \
  --session-dir /private/tmp/pi-tasks-release-029-weak/sessions \
  --session-id <release-029-weak-en|release-029-weak-zh> \
  -p @docs/dogfood-prompts/<weak-model-en.md|weak-model-zh-TW.md>
```

Observed result: both prompts entered through `task_resume`, rejected compound atomic wording with structured `task_plan` recovery, created valid two-step tasks, rejected evidence linked to future step `T1-S2`, enforced the 500-character evidence summary limit at the host schema, and made `task_next` select only `task_evidence` for current step `T1-S1`. The Traditional Chinese run reported that its model-rendered oversized value was not the requested exact sequence of 501 `長` characters, but the host still observed an over-limit summary and rejected it at the same 500-character boundary.

Installed package smoke loaded the clean release-check consumer path ending in `node_modules/pi-tasks/dist/index.js` with a separate session:

```sh
pi --provider openai-codex --model gpt-5.6-sol \
  --no-extensions --extension <release-check-consumer>/node_modules/pi-tasks/dist/index.js \
  --no-builtin-tools --tools task_resume,task_plan \
  --session-dir /private/tmp/pi-tasks-release-029-installed/sessions \
  --session-id release-029-installed-final
```

Observed result: `task_resume` reported no active task, and the installed extension persisted task `T1` with current step `T1-S1`.

The fixed installed-package English prompt also passed: `task_resume` recommended `task_plan`; `Run tests and update docs` was rejected for broad and compound wording; and recovery returned `retry_with: task_plan` plus `do_not_retry_same_call: true`.

## 0.2.10 Release Dogfood (2026-10-24)

Release candidate gate:

```sh
PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.3.0/node_modules/@earendil-works/pi-coding-agent \
  npm run release:check
```

Observed result: passed strict typecheck, Biome, 94 unit tests, 7 native Pi SDK 1.3.0 tests, build, source/dist import smoke, `npm pack --dry-run`, clean `pi-tasks-0.2.10.tgz` install/import, and a zero-vulnerability audit.

Real Pi 1.3.0 source lifecycle used `openai-codex/gpt-5.6-sol`. One deliberately invalid two-step plan returned both indexed failures in one rejection and named the matched fragments `"Fix"` and `"and"`. A valid task with `criterionIds: []` auto-linked `T1-S1` to `T1-AC1`, recorded decision `D1`, completed an intentional block/unblock transition, rejected incomplete evidence quality, recorded corrected evidence `E2`, deduplicated an identical resubmission, completed at 100%, and retained its criterion, resolved blocker, decision, and evidence across same-session resume and fork replay.

Live Pi TUI `/tasks detail` rendered the completed task, resolved blocker, decision, atomic step, criterion, and evidence. `/quit` exited with code 0.

The fixed English and Traditional Chinese weak-model source prompts passed compound-plan rejection, future-step evidence lock, the 500-character evidence summary budget, and single-tool `task_next` convergence. The Chinese prompt previously asked the model to generate at least 501 repeated characters and could exhaust the external model turn before a tool call; it now supplies the same fixed 576-character over-limit value used by the deterministic English prompt.

Installed-package smoke loaded the release-check consumer's `pi-tasks-0.2.10` tarball. The installed extension returned structured recovery with the exact `"update"` and `"and"` matches for an invalid plan, then separately created task `T1` from a valid atomic step with `criterionIds: []` and generated `T1-S1` / `T1-AC1`.

No npm publication was performed; npm publication remains a manual maintainer action.

## 0.3.0 Native Semantic Assessment Dogfood (2026-10-30)

Real Pi 1.3.0 used `openai-codex/gpt-5.6-sol`. The source lifecycle persisted version 2 `pi_chat` provenance, let the model classify a multi-operation release step as `needs_breakdown`, decomposed it, rejected unsupported passing evidence, accepted corrected observed evidence, completed the task, restored it in the same session, replayed it in a fork, rendered `/tasks detail`, and exited `/quit` with code 0.

Real Oh My Pi 18.14.0 used `google-antigravity/gemini-2.5-flash`. The source lifecycle persisted `omp_ephemeral` provenance through `runEphemeralTurn()`, created and updated task `T1`, attached evidence `E1`, completed and listed the task, restored `T1` and `E1` in a resumed session, rendered the task through `/tasks detail`, and exited `/quit` with code 0.

The fixed English Pi prompt accepted ordinary `Update` wording, rejected structurally valid passing evidence whose claimed observation was only a future expectation with `missing_observation` and `hedged_claim`, accepted corrected evidence `E2`, and made `task_next` recommend `task_update`. The fixed Traditional Chinese OMP prompt accepted「更新」, rejected the future expectation with `missing_observation`, accepted corrected evidence `E2`, and also converged on `task_update`.

Real-host checks found and fixed two boundary incompatibilities before the successful runs: Pi chat requests no longer force a provider-rejected `temperature`, and OMP ephemeral requests no longer send an unsupported output-token cap.

Release candidate gate:

```sh
PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.4.0/node_modules/@earendil-works/pi-coding-agent \
  npm run release:check
```

Observed result: passed strict typecheck, Biome, 103 unit tests, 7 native Pi SDK 1.4.0 tests, build, source/dist import smoke, `npm pack --dry-run`, clean `pi-tasks-0.3.0.tgz` install/import, and a zero-vulnerability audit. In the clean installed consumer, a vague first smoke step correctly failed closed; the corrected concrete read-and-command step then created `T1` through `node_modules/pi-tasks/dist/index.js` with version 2 native `pi_chat` semantic provenance.

No npm publication was performed; npm publication remains a manual maintainer action.

## Package Gates

Also passed across release gates:

- `npm run typecheck`
- `npm run check`
- `npm test` (76 unit tests)
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
- 0.2.0 `npm run release:check`
- 0.2.0 source state-event lifecycle, same-session resume, fork replay, live `/tasks`, large-session manual `/compact`, and clean `/quit`
- 0.2.0 clean tarball install plus installed-package Pi state-event smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.2.5 `npm run release:check`
- 0.2.5 source superseded-evidence lifecycle, same-session resume, fork replay, live `/tasks detail`, and clean `/quit`
- 0.2.5 clean tarball install plus installed-package superseded-evidence smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.2.5 English and Traditional Chinese weak-model prompt dogfood for compound plan rejection, current-step evidence lock, oversized evidence rejection, and `task_next` convergence
- 0.2.5 installed-package weak-model smoke for compound plan rejection and structured recovery
- 0.2.6 `npm run release:check`
- 0.2.6 source vague-evidence lifecycle, same-session resume, fork replay, live `/tasks detail`, and clean `/quit`
- 0.2.6 clean tarball install plus installed-package vague-evidence smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.2.6 English and Traditional Chinese prompt dogfood for vague-summary rejection and concrete observed-summary acceptance
- 0.2.8 `npm run release:check` with 88 unit tests, 7 native SDK tests, clean tarball install/import, and zero-vulnerability audit
- 0.2.8 source issue-recovery lifecycle, same-session resume, fork replay, live `/tasks detail`, and clean `/quit`
- 0.2.8 clean tarball install plus installed-extension structured-recovery smoke through `./node_modules/pi-tasks/dist/index.js`
- 0.2.8 English and Traditional Chinese fixed prompts for compound-plan, current-step-lock, and evidence-budget rejection

## Remaining Runtime Coverage

No remaining runtime coverage gaps are known for the 0.2.8 release scope.

Known runtime note:

- Long multi-step Pi self-correction prompts can still stall at the external agent layer; short staged prompts are verified and should remain the recommended release dogfood style.
