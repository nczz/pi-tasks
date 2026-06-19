# pi-tasks Release Process

Do not publish an npm release until every gate below is recorded with evidence.

## Required Gates

1. Install dependencies in a clean checkout.
2. Run `npm run typecheck`.
3. Run `npm run check`.
4. Run `npm test`.
5. Run `npm run build`.
6. Run `node --experimental-strip-types -e "import('./index.ts')"`.
7. Run `node -e "import('./dist/index.js')"`.
8. Run `npm pack --dry-run`.
9. Install the tarball in a clean temp project and run `node -e "import('pi-tasks')"`.
10. Run `npm audit --audit-level=low`.
11. Run the real Pi dogfood checklist in [DOGFOOD.md](DOGFOOD.md).
12. Confirm README, implementation spec, dogfood notes, and changelog match the actual behavior.

## Evidence Rules

- Skipped gates must be listed as skipped with the reason.
- A gate that used alternate binaries or environment variables must say so.
- Real Pi dogfood must use Pi custom entries, `/tasks`, session resume, and clean `/quit`.
- Release dogfood must include ordered-step misuse, duplicate evidence, decision/blocker rendering, and installed-package smoke.
- Do not claim release readiness while real Pi dogfood is skipped.
- Keep `package-lock.json` current with `package.json` before packing or publishing.
- npm packages must point Pi to `dist/index.js`; source `index.ts` is for local development smoke only.
