# Weak-Model Dogfood Prompt - English

Use these short prompts in real Pi sessions with `pi-tasks` enabled before a release when validating weak-model execution contracts. Keep each prompt narrow so the release gate measures the extension behavior instead of the model's ability to juggle a long scenario.

## Source Extension Hardening

```text
Weak-model hardening dogfood. First call task_next with no active task. Then call task_plan once with a deliberately invalid atomic step text 'Run tests and update docs' so compound wording is rejected. Then create a valid task named Weak Model Hardening with one acceptance criterion and two atomic plan steps; omit criterionIds manually; each step must have one action, one output, one verification method, allowedActions ["task_evidence"], and no compound wording. Then call task_evidence once targeting future step T1-S2 while current step is T1-S1; include complete quality fields with source, verifier, reproducible=true, artifactRefs, and observedOutput so current-step lock is the rejection being tested. Then call task_evidence once with a summary longer than 501 characters so evidence budget rejects it. Finally call task_next and task_list without include_evidence, and report exact rejections plus the only next tool.
```

## Installed Package Smoke

```text
Installed weak-model smoke. Call task_next with no active task. Then call task_plan with one deliberately invalid atomic step text 'Run tests and update docs' and report whether compound wording is rejected with structured recovery.
```

Expected observations:

- The broad step is rejected by the plan quality gate.
- `task_next` returns one recommended next tool, minimum params, blocked tools, and current-step lock.
- Future-step evidence is rejected unless an explicit override reason is supplied.
- Oversized evidence summary is rejected.
- Completion is rejected until step, criterion, evidence, blocker, decision, and scope-drift gaps are closed.
