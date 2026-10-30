# Weak-Model Dogfood Prompt - English

Use these short prompts in real Pi sessions with `pi-tasks` enabled before a release when validating weak-model execution contracts. Keep each prompt narrow so the release gate measures the extension behavior instead of the model's ability to juggle a long scenario.

## Source Extension Hardening

```text
Native semantic hardening dogfood. First call task_resume with no active task and confirm it recommends task_plan. Then call task_plan with one semantically atomic step: "Update the package.json version field to 0.3.0", expected output "package.json contains one version value: 0.3.0", and evidenceRequired=true. Do not submit granularityCheck or decompositionStatus; omit criterionIds so pi-tasks links the generated criterion. Confirm the ordinary action word "Update" does not cause a keyword-based rejection and the step is atomic. Then call task_evidence for the current step with passed=true, type=command, level=e2e_smoke, summary "The package version update should be complete", references and artifactRefs ["package.json"], source "planned version check", reproducible=true, verifier=tool, command "node -p require('./package.json').version", and observedOutput "The version should be 0.3.0 after the update". Confirm semantic assessment rejects this future expectation even though every structural field is valid. Retry with summary "package.json returned version 0.3.0" and observedOutput "package.json returned version 0.3.0", then confirm acceptance. Finally call task_next and report its single recommended action.
```

## Installed Package Smoke

```text
Installed native-semantic smoke. Call task_resume with no active task, then call task_plan with the atomic step "Update the package.json version field to 0.3.0". Omit caller-authored granularity fields. Report whether the ordinary action word is accepted without keyword-based regex rejection and whether structured recovery is returned if the host has no native model boundary.
```

Expected observations:

- An ordinary action word such as `Update` does not trigger keyword-based rejection.
- Passing evidence whose structurally valid observed-output field contains only a future expectation is rejected by semantic assessment.
- Passing evidence with a concrete observed result is accepted, and `task_next` returns one recommended action.
