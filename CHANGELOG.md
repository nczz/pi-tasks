# Changelog

## [Unreleased]

## [0.3.0] - 2026-10-30

### Added
- Added native semantic assessment adapters for Pi classifier models, Pi `modelRegistry.streamSimple()`, and Oh My Pi `runEphemeralTurn()`.
- Added versioned, persisted plan-step and passing-evidence assessments with provider, model, prompt version, input hash, confidence, and decision provenance.
- Added multilingual semantic coverage for English, Traditional Chinese, Simplified Chinese, Japanese, Korean, and mixed technical text.

### Changed
- Replaced language-specific vague/compound regex gates with model judgments for plan creation, decomposition, and passing-evidence support.
- Made `allowedActions` optional and removed caller-supplied granularity scoring from plan and decomposition schemas; pi-tasks now derives granularity from the native model assessment.
- Kept replay deterministic and model-free: version 2 events carry validated assessments, while version 1 histories remain readable as legacy events.

### Fixed
- Eliminated the keyword false positives and repeated correction loops reported in #14, including ordinary words such as `fix`, `update`, `implement`, and conjunctions used within one semantic operation.
- Added stale-step detection around asynchronous decomposition assessment and delayed task-ID allocation until a plan assessment succeeds.
- Removed provider-incompatible `temperature` from Pi chat assessment calls and omitted unsupported output-token caps from Oh My Pi ephemeral turns after real-host dogfood exposed both boundary mismatches.
- Strengthened replay validation for semantic strategy, input hashes, timestamps, judgment-derived issue lists, and evidence decision/issue consistency.
- Revalidated passing evidence against current task state after asynchronous assessment and preflighted non-passing evidence before ID allocation, so rejected or stale mutations do not consume evidence IDs.

### Security
- Treats all task and evidence fields as untrusted quoted data in semantic prompts, validates typed model output before persistence, supports cancellation, and fails closed when no native assessment boundary succeeds.

## [0.2.10] - 2026-10-24

### Fixed
- Treated empty `criterionIds` arrays like omitted arrays during task creation and decomposition, preserving automatic criterion linking instead of rejecting otherwise valid plans.
- Made every atomic plan-quality issue a hard failure and named the exact vague or compound fragment in rejection messages.
- Validated every submitted plan step before rejection so one response reports all invalid steps instead of revealing them across repeated full-plan retries.

### Security
- Updated Vitest to 5.0.5, including patched `@vitest/mocker` and Vite transitive dependencies, so the release audit reports zero vulnerabilities.

## [0.2.9] - 2026-10-16

### Fixed
- Stopped reducer replay from repeatedly deep-cloning accumulated event history that is immediately replaced, removing the dominant cost behind reported large-session startup timeouts while preserving immutable task-state transitions and append-only history.

## [0.2.8] - 2026-10-14

### Fixed
- Replaced impossible `task_decompose` guidance at the maximum decomposition depth with a consistent explicit blocker recovery across resume, next, focus, granularity, state, and rejection outputs.
- Declared runtime evidence text limits in the tool schema and made command/test/dogfood retry templates preserve required commands while replacing over-limit values with explicit caller-supplied placeholders.
- Made scope-update field dependencies model-visible and changed missing `activity`/`scope_reason` rejections to return corrected `task_update` recovery parameters instead of unrelated resume tools.
- Stopped plan-quality language guards from interpreting action-like path segments such as `fixtures/fix.json`, `update.json`, or `then.json` as vague or compound instructions while retaining broad and multi-action rejection controls.

### Changed
- Updated English and Traditional Chinese dogfood prompts to enter task-free sessions through the active `task_resume` entrypoint before exercising lazy task controls.

### Security
- Updated transitive `source-map-js` to `1.2.2` after the release audit detected GHSA-68fv-2mgg-jv7q.

## [0.2.7] - 2026-09-10

### Added
- Lazily activates pi-tasks controls through native Pi tool APIs: fresh sessions expose only `task_plan` and `task_resume`, then restore the available task controls after task creation, session replay, or tree navigation.
- Added native Pi SDK extension coverage for fresh tool surface, persisted task restoration, branch navigation, host tool ceilings, foreign task tool preservation, and rejected-plan non-activation.

### Changed
- Compact descriptions for lazily activated task controls when native activation is available while preserving full guidance for entrypoint tools and older hosts without native activation APIs.
- Added `npm run test:native` to the release gate; `PI_SDK_ROOT` must point at an installed or built `@earendil-works/pi-coding-agent` SDK root.

### Security
- Upgraded Vitest to `5.0.0` so `npm audit --audit-level=low` reports zero vulnerabilities.
## [0.2.6] - 2026-09-06

### Fixed
- Stopped rejecting concrete passing evidence summaries that contain vague words such as `done` or `完成了` when they also include observed result signals; the vagueness gate now rejects whole-summary vague phrases and short vague summaries, and the error names the matched fragment.

## [0.2.5] - 2026-09-03

### Added
- Added `task_evidence.supersedes` so a later passing rerun can explicitly resolve prior linked failed evidence without losing audit lineage.
- Added smart-model and weak-model convergence guidance to every pi-tasks tool prompt.

### Fixed
- Allowed `task_complete` to ignore linked failed evidence only when a later passing evidence item explicitly supersedes it on the same step or criterion.

## [0.2.4] - 2026-08-24

### Fixed
- Aligned `task_evidence` schema with runtime evidence quality gates for weak-model and Oh My Pi compatibility by requiring traceability references and complete quality fields, and preserving copyable retry examples for rejected command/test/dogfood evidence.

## [0.2.3] - 2026-08-04

### Fixed
- Corrected Oh My Pi (`omp`) install documentation to remove the unsupported project-scoped npm package example and list verified npm/local plugin commands.

## [0.2.2] - 2026-08-04

### Added
- Documented verified Oh My Pi (`omp`) npm-package and local-development installation paths, plus compatibility details.

### Changed
- Mirrored tool `promptGuidelines` into registered tool descriptions so Oh My Pi hosts that consume `description`/`parameters` still receive critical task-contract guidance.
- Removed the local `ctx.mode` compatibility shim from pi-tasks context types and event creation.

## [0.2.1] - 2026-08-04

### Fixed
- Emitted explicit `type: "string"` for `Type.Enum()` schemas so Moonshot/Kimi-compatible tool schema validators accept pi-tasks enum parameters.

### Added
- Added regression coverage for enum schema typing and option preservation.

### Security
- Refreshed the lockfile to use the patched transitive PostCSS version required for `npm audit --audit-level=low` to pass.

## [0.2.0] - 2026-07-22

### Added
- Exposed a versioned `pi-tasks:state` event for custom Pi task UI extensions, with stable `TASK_STATE_EVENT` and `TASK_WIDGET_ID` exports.
- Published cloned task-state snapshots after session replay, session tree navigation, successful task mutations, and compaction snapshot persistence.
- Added unit coverage for state-event ordering, consumer-owned widget replacement, cloned payload isolation, rejected mutation suppression, observer failure isolation, and compaction snapshot publication.

### Changed
- Documented the custom task UI integration contract and local-extension data visibility expectations.

## [0.1.5] - 2026-06-23

### Fixed
- Preserved `ExtensionAPI.appendEntry` method receivers when task tools append events, so receiver-bound host API implementations work without callers rebinding methods.

### Added
- Added unit coverage for receiver-bound `appendEntry` compatibility across task tool event appends.
- Added 0.1.5 release dogfood evidence for source task lifecycle, decision/evidence replay, fork replay, `/tasks detail`, and clean `/quit`.

## [0.1.4] - 2026-06-21

### Changed
- Rewrote README with user-oriented market positioning, competitive landscape comparison, and streamlined structure.
- Updated package.json description to reflect execution-contract positioning.
- Set GitHub repo description, topics, and homepage via `gh repo edit`.

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
