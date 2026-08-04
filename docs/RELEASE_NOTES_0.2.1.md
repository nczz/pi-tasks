# Release Notes 0.2.1

## Highlights

- Added explicit `type: "string"` to `Type.Enum()` JSON Schema output.
- Restored compatibility with Moonshot/Kimi-style tool schema validators that reject bare enum schemas without a `type` field.
- Added regression coverage for enum schema typing and schema option preservation.

## Compatibility

`Type.Enum()` only accepts string enum values, so the emitted schema is now stricter and provider-compatible without changing pi-tasks task state, reducer behavior, persistence, rendering, or tool execution logic.

## Verification Status

- Passed: `npm run release:check`.
- Passed: targeted regression test `npx vitest --run test/unit/schema.test.ts`.
- Passed: `npm run typecheck`, Biome check, `npm test`, `npm run build`, source import smoke, dist import smoke, `npm pack --dry-run`, clean tarball install smoke, and `npm audit --audit-level=low`.
- Skipped: real Pi dogfood; this patch only changes tool schema metadata and npm publication is being handled manually.
