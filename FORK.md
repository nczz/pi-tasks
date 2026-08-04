# pi-tasks (local durable fork)

Pinned under `~/.pi/agent/local-packages/pi-tasks` so Moonshot/Kimi schema
fixes are **not** lost on `npm:pi-tasks` reinstall.

## Divergence from upstream (`nczz/pi-tasks`)

`Type.Enum()` emits `{ type: "string", enum: [...] }` instead of bare
`{ enum: [...] }`. Moonshot rejects the bare form
(`decompositionStatus: type is not defined`).

Upstream: https://github.com/nczz/pi-tasks (READ-only here — open PR via fork).

## Wire-up

`~/.pi/agent/settings.json` packages entry:

```json
"/Users/basitmustafa/.pi/agent/local-packages/pi-tasks"
```

(not `npm:pi-tasks`)

Also load `~/.pi/agent/extensions/moonshot-tool-schema.ts` as defense-in-depth
for any other package that emits bare enums.
