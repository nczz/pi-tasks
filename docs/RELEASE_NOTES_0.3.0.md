# Release Notes 0.3.0

## Highlight

Version 0.3.0 replaces language-specific regex judgments for plan quality and passing evidence with typed semantic assessment through Pi and Oh My Pi's native model APIs. The change resolves the false-positive and retry-loop behavior reported in #14 without moving nondeterministic inference into replay.

## Native Semantic Assessment

Three mutation boundaries now use semantic inference:

- `task_plan` assesses every proposed step in one batch;
- `task_decompose` assesses every proposed child step in one batch; and
- passing `task_evidence` assesses whether the complete record contains a concrete observed result supporting the claim.

The adapter order is Pi classifier models, Pi `modelRegistry.streamSimple()`, then Oh My Pi `runEphemeralTurn()`. pi-tasks does not include a provider SDK or make its own external model request.

Plan assessment classifies specificity, independent action count, independently observable output count, independent verification-method count, and hidden subtasks. It distinguishes conjunctions within one operation from independently executable work instead of treating words such as `and`, `fix`, `update`, or `implement` as failures.

Evidence assessment uses summary, observed output, command, and references together. A command, reference, optimistic statement, or future expectation alone is not proof, while a concrete observed result is not rejected merely for containing words such as `done`, `completed`, `probably`, or `should`.

## Prompt and Output Safety

The prompts:

- judge meaning directly in the source language;
- apply one policy to English, Traditional Chinese, Simplified Chinese, Japanese, Korean, and mixed technical text;
- treat all task and evidence fields as untrusted quoted data;
- prohibit keyword, length, and punctuation heuristics;
- define independent operations semantically; and
- request typed structured classifications only.

Model output is validated for shape, complete step-index coverage, confidence, decision consistency, bounded issue codes, provenance, and canonical input hashes. Invalid, unavailable, failed, low-confidence, or aborted assessment fails closed without a task mutation or regex fallback. Cancellation signals and model usage are propagated through tool results.

Replay validation also rejects unknown native strategies, malformed SHA-256 input hashes, invalid assessment timestamps, judgment/issue mismatches, duplicate evidence issues, and supported evidence that still reports a material contradiction.

## Deterministic Persistence and Replay

Successful assessments are stored in version 2 task events with:

- assessment and prompt versions;
- native strategy, provider, and model;
- canonical input hash and assessment timestamp;
- typed judgments, confidence, bounded issues, and derived decisions.

Reducers validate the stored assessment but never call a model. Session restore, compaction replay, branch navigation, rendering, and completion therefore remain deterministic. Existing version 1 histories continue to replay as legacy events without retroactive inference.

## Tool Contract Changes

- `task_plan.plan_steps` and `task_decompose.child_steps` no longer accept caller-authored `granularityCheck` or `decompositionStatus` fields.
- `allowedActions` is optional guidance rather than a semantic quality requirement.
- A specific, high-confidence single operation becomes atomic.
- Valid multi-operation work enters the existing decomposition flow.
- Unclear, non-specific, or low-confidence work is rejected with a targeted retry.
- Task IDs are allocated only after successful assessment.
- Decomposition rechecks its parent fingerprint after the asynchronous model call and rejects a stale result if the step changed.
- Deterministic evidence quality and text-budget checks run before semantic inference, avoiding unnecessary model calls for structurally invalid evidence.
- Passing evidence is revalidated against current task state after the asynchronous assessment, and every evidence mutation is preflighted before ID allocation, so stale or rejected calls do not consume evidence IDs.

## Compatibility and Operations

Pi classifier/chat calls send the assessment payload through Pi's model registry. Oh My Pi ephemeral turns follow OMP's side-turn contract and may include the current conversation snapshot; operators should apply the same data-handling policy as the active OMP conversation.

Real-host compatibility checks intentionally avoid provider-specific knobs: Pi chat assessment uses low reasoning without forcing `temperature`, and Oh My Pi ephemeral turns do not send an output-token cap that some OMP transports reject.

Semantic mutations consume model tokens and may add latency. If no native model boundary is available, pi-tasks returns an explicit retry contract and leaves state unchanged. Non-passing evidence and all replay/read-only operations do not invoke semantic inference.

## Regression Coverage

The release suite covers multilingual corpus cases, each native adapter, structured output parsing, persisted replay, version 1 compatibility, cancellation, malformed and unavailable providers, usage propagation, rejected-call ID behavior, concurrent task creation, and stale decomposition protection. Native Pi SDK tests use persisted fixtures for replay-focused cases so release checks do not depend on network credentials.

## Verification Status

- Passed `PI_SDK_ROOT=/tmp/pi-tasks-sdk-1.4.0/node_modules/@earendil-works/pi-coding-agent npm run release:check`: strict typecheck, Biome, 103 unit tests, 7 native Pi SDK tests, build, source/dist imports, pack dry-run, clean tarball install/import, and zero-vulnerability audit.
- Passed real Pi 1.3.0 lifecycle, same-session resume, fork replay, live `/tasks detail`, clean `/quit`, and the fixed English semantic prompt with `openai-codex/gpt-5.6-sol`.
- Passed real Oh My Pi 18.14.0 `runEphemeralTurn()` lifecycle, persistence/resume, live `/tasks detail`, clean `/quit`, and the fixed Traditional Chinese semantic prompt with `google-antigravity/gemini-2.5-flash`.
- Passed clean installed-tarball Pi semantic smoke through `node_modules/pi-tasks/dist/index.js`.

## Publishing

The GitHub release contains the verified source and package metadata for `0.3.0`. npm publication remains a separate manual maintainer action.
