# pi-tasks Release Process

Do not publish an npm release until every gate below is recorded with evidence.

## Required Gates

1. Install dependencies in a clean checkout.
2. Run `npm run release:check`.
3. Run the real Pi and Oh My Pi dogfood checklist in [DOGFOOD.md](DOGFOOD.md).
4. Confirm README, implementation spec, dogfood notes, and changelog match the actual behavior.

`npm run release:check` runs:

- `npm run typecheck`
- `npm run check`
- `npm test`
- `npm run test:native` with `PI_SDK_ROOT` pointing at an installed/built `@earendil-works/pi-coding-agent` SDK root
- `npm run build`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `node -e "import('./dist/index.js')"`
- `npm pack --dry-run`
- clean tarball install plus `node -e "import('pi-tasks')"`
- `npm audit --audit-level=low`

## Evidence Rules

- Skipped gates must be listed as skipped with the reason.
- A gate that used alternate binaries or environment variables must say so.
- Real Pi dogfood must use Pi custom entries, native semantic model assessment, silent healthy startup, `/tasks doctor`, `/tasks doctor live`, `/tasks`, session resume, branch/fork behavior when touched, and clean `/quit`.
- Real Oh My Pi dogfood must exercise `runEphemeralTurn()` semantic assessment, silent healthy startup, `/tasks doctor`, `/tasks doctor live`, task persistence, `/tasks`, session resume, and clean `/quit`.
- Release dogfood must include ordered-step misuse, unsupported passing evidence, duplicate evidence, decision/blocker rendering, and installed-package smoke.
- Weak-model release dogfood must use the fixed prompts under [dogfood-prompts](dogfood-prompts/) in English and Traditional Chinese.
- Do not claim release readiness while either real Pi or Oh My Pi dogfood is skipped.
- Keep `package-lock.json` current with `package.json` before packing or publishing.
- npm packages must point Pi to `dist/index.js`; source `index.ts` is for local development smoke only.
- Native Pi SDK extension tests require `PI_SDK_ROOT`; do not claim `npm run release:check` passed if that environment variable was absent.
