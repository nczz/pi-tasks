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

## Package Gates

Also passed on 2026-06-19:

- `npm run typecheck`
- `npm run check`
- `npm test`
- `npm run build`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `npm pack --dry-run` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`
- `npm audit --audit-level=low` with `npm_config_cache=/private/tmp/pi-tasks-npm-cache`

## Remaining Runtime Coverage

The following are not counted as failed MVP gates, but should be covered before expanding the UI or release claims:

- compaction behavior after Pi performs real context trimming,
- narrow-terminal visual QA for status/widget rendering,
- interactive branch divergence navigation inside a live Pi session tree.
