# pi-tasks Release Process

Do not publish an npm release until every gate below is recorded with evidence.

## Required Gates

1. Install dependencies in a clean checkout.
2. Run `npm run release:check`.
3. Run the real Pi dogfood checklist in [DOGFOOD.md](DOGFOOD.md).
4. Confirm README, implementation spec, dogfood notes, and changelog match the actual behavior.

`npm run release:check` runs:

- `npm run typecheck`
- `npm run check`
- `npm test`
- `npm run build`
- `node --experimental-strip-types -e "import('./index.ts')"`
- `node -e "import('./dist/index.js')"`
- `npm pack --dry-run`
- clean tarball install plus `node -e "import('pi-tasks')"`
- `npm audit --audit-level=low`

## Evidence Rules

- Skipped gates must be listed as skipped with the reason.
- A gate that used alternate binaries or environment variables must say so.
- Real Pi dogfood must use Pi custom entries, `/tasks`, session resume, and clean `/quit`.
- Release dogfood must include ordered-step misuse, duplicate evidence, decision/blocker rendering, and installed-package smoke.
- Weak-model release dogfood must use the fixed prompts under [dogfood-prompts](dogfood-prompts/) in English and Traditional Chinese.
- Do not claim release readiness while real Pi dogfood is skipped.
- Keep `package-lock.json` current with `package.json` before packing or publishing.
- npm packages must point Pi to `dist/index.js`; source `index.ts` is for local development smoke only.
