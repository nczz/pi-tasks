# Release Notes 0.2.3

## Highlights

- Corrected Oh My Pi (`omp`) installation documentation after verifying the CLI behavior.
- Removed the unsupported project-scoped npm package install example. Oh My Pi's `--scope project` flag applies to marketplace refs such as `name@marketplace`, and is ignored for npm package specs like `pi-tasks`.
- Documented verified npm and local-development commands.

## Verified Install Commands

```sh
omp install pi-tasks
omp plugin install pi-tasks
omp plugin install ./
```

Verification used Oh My Pi CLI dry-runs:

```sh
omp install pi-tasks --dry-run
omp plugin install pi-tasks --dry-run
omp plugin install ./ --dry-run
```

## Verification Status

- Passed: `npm run release:check`.
- Passed: Oh My Pi CLI dry-run checks for npm install, explicit plugin install, and local plugin install.
- Passed: unit suite with 59 tests through the release gate.
- Skipped: real Pi/Oh My Pi TUI dogfood; this patch corrects documentation and package metadata only.
