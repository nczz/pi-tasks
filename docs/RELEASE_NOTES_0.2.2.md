# Release Notes 0.2.2

## Highlights

- Documented Oh My Pi (`omp`) installation paths and extension compatibility behavior.
- Mirrored each tool's critical `promptGuidelines` into its registered `description` so Oh My Pi and other hosts that ignore custom prompt fields still provide the model with task-contract guidance.
- Removed the local `ctx.mode` shim assumption; pi-tasks now records tool events without depending on runtime-specific context mode fields.

## Compatibility

Oh My Pi discovers `pi-tasks` through the existing `pi.extensions` manifest, so no separate `omp` manifest is required. The extension uses shared Pi-native APIs available in Oh My Pi: `registerTool`, `registerCommand`, `appendEntry`, `ctx.sessionManager.getBranch()`, status/widget UI calls, and session lifecycle events.

The description mirroring keeps existing Pi hosts compatible with `promptSnippet` and `promptGuidelines` while strengthening Oh My Pi's model-facing tool metadata path.

## Verification Status

- Passed: `npm run release:check`.
- Passed: unit suite with 59 tests, including coverage that prompt guidelines are projected into registered tool descriptions.
- Passed: source and dist import smokes, `npm pack --dry-run`, clean tarball install smoke, and `npm audit --audit-level=low` through the release gate.
- Skipped: real Pi/Oh My Pi TUI dogfood; this patch changes documentation, tool metadata descriptions, and a no-op context shim.
