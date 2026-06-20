# pi-tasks 0.1.3 Release Notes

`pi-tasks` 0.1.3 is a weak-model and release-readiness hardening release.

## Highlights

- Added `task_next`, a compact one-step execution contract for weak or small-context models.
- Added stricter atomic plan quality checks for compound wording such as `and`, `then`, `並且`, and `然後`.
- Added current-step evidence locking with explicit `override_reason` for cross-step evidence.
- Added evidence text budgets so long logs stay in artifact references instead of model context.
- Added structured rejection recovery with `retry_with`, `minimum_params`, and `do_not_retry_same_call`.
- Added `npm run release:check` for repeatable release validation.
- Added fixed English and Traditional Chinese weak-model dogfood prompts.

## Verification

- `npm run release:check` passed for 0.1.3.
- Source Pi weak-model dogfood passed for English and Chinese prompts.
- Installed 0.1.3 tarball smoke passed through `./node_modules/pi-tasks/dist/index.js`.
- npm audit passed with 0 vulnerabilities.

## npm Publish Handoff

The GitHub release is ready for manual npm publication after the maintainer runs:

```sh
npm publish --access public
```
