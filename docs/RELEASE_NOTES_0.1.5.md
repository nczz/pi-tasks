# pi-tasks 0.1.5 Release Notes

`pi-tasks` 0.1.5 is a compatibility hardening release for Pi host APIs that expose receiver-bound extension methods.

## Fixed

- Task tool appends now call `ExtensionAPI.appendEntry` through the original API receiver instead of passing the method as an unbound callback.
- This preserves compatibility with host implementations whose `appendEntry` depends on `this`.

## Verification

- `npm run release:check` passed for 0.1.5.
- Unit tests include receiver-bound `appendEntry` coverage.
- Source Pi dogfood passed for task creation, update, decision recording, evidence recording, completion, same-session resume, fork replay, `/tasks detail`, and clean `/quit`.
- Installed tarball smoke passed through `./node_modules/pi-tasks/dist/index.js`.

## Publish Handoff

The GitHub release is ready for manual npm publication after the maintainer runs:

```sh
npm publish --access public
```
