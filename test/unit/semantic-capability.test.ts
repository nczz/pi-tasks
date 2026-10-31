import { describe, expect, it } from "vitest";
import type { ExtensionContext } from "../../src/pi-types.ts";
import {
	createSemanticCapabilityMonitor,
	formatSemanticCapabilityReport,
	inspectSemanticCapabilities,
	SEMANTIC_CAPABILITY_STATUS_ID,
} from "../../src/semantic-capability.ts";

function context(overrides: Partial<ExtensionContext> = {}): ExtensionContext {
	return {
		sessionManager: { getBranch: () => [] },
		ui: {
			notify: () => {},
			setStatus: () => {},
			setWidget: () => {},
		},
		...overrides,
	};
}

function planPayload() {
	return {
		steps: [
			{
				index: 0,
				specific: { value: true, confidence: 0.96 },
				actionCount: { value: "one", confidence: 0.95 },
				outputCount: { value: "one", confidence: 0.95 },
				verificationCount: { value: "one", confidence: 0.95 },
				hiddenSubtasks: { value: false, confidence: 0.96 },
			},
		],
	};
}

describe("semantic capability diagnostics", () => {
	it("inspects all native strategies without sending inference", async () => {
		let classifyCalls = 0;
		let streamCalls = 0;
		let ephemeralCalls = 0;
		const report = await inspectSemanticCapabilities(
			context({
				model: { provider: "test", id: "current" },
				modelRegistry: {
					getAvailableOfType: async () => [
						{ provider: "test", id: "classifier", type: "classifier" },
					],
					classify: async () => {
						classifyCalls += 1;
						throw new Error("must not infer");
					},
					streamSimple: () => {
						streamCalls += 1;
						throw new Error("must not infer");
					},
				},
				runEphemeralTurn: async () => {
					ephemeralCalls += 1;
					throw new Error("must not infer");
				},
			}),
		);

		expect(report).toMatchObject({
			overall: "ready",
			preferredStrategy: "pi_classifier",
			selectedModel: "test/current",
			capabilities: [
				{ strategy: "pi_classifier", state: "available" },
				{ strategy: "pi_chat", state: "available" },
				{ strategy: "omp_ephemeral", state: "available" },
			],
		});
		expect({ classifyCalls, streamCalls, ephemeralCalls }).toEqual({
			classifyCalls: 0,
			streamCalls: 0,
			ephemeralCalls: 0,
		});
	});

	it("reports degraded readiness when classifier discovery fails but Pi chat is usable", async () => {
		const report = await inspectSemanticCapabilities(
			context({
				model: { provider: "test", id: "current" },
				modelRegistry: {
					getAvailableOfType: async () => {
						throw new Error("registry offline");
					},
					classify: async () => {
						throw new Error("not called");
					},
					streamSimple: () => {
						throw new Error("not called");
					},
				},
			}),
		);

		expect(report.overall).toBe("degraded");
		expect(report.preferredStrategy).toBe("pi_chat");
		expect(report.capabilities[0]).toMatchObject({
			state: "error",
			detail: "classifier discovery failed: registry offline",
		});
	});

	it("deduplicates an outage when only discovery error text changes", async () => {
		const notifications: string[] = [];
		let attempt = 0;
		const ctx = context({
			ui: {
				notify: (message) => notifications.push(message),
				setStatus: () => {},
				setWidget: () => {},
			},
			modelRegistry: {
				getAvailableOfType: async () => {
					attempt += 1;
					throw new Error(`registry offline attempt ${attempt}`);
				},
				classify: async () => {
					throw new Error("not called");
				},
			},
		});
		const monitor = createSemanticCapabilityMonitor();

		await monitor.refresh(ctx);
		await monitor.refresh(ctx);

		expect(attempt).toBe(2);
		expect(notifications).toHaveLength(1);
	});
	it("warns once per outage, clears on recovery, and warns on a later outage", async () => {
		const notifications: string[] = [];
		const statuses: Array<[string, string | undefined]> = [];
		const ctx = context({
			ui: {
				notify: (message) => notifications.push(message),
				setStatus: (key, text) => statuses.push([key, text]),
				setWidget: () => {},
			},
		});
		const monitor = createSemanticCapabilityMonitor();

		await monitor.refresh(ctx);
		await monitor.refresh(ctx);
		expect(notifications).toHaveLength(1);
		expect(statuses.at(-1)).toEqual([
			SEMANTIC_CAPABILITY_STATUS_ID,
			"semantic unavailable · /tasks doctor",
		]);

		ctx.model = { provider: "test", id: "current" };
		ctx.modelRegistry = {
			streamSimple: () => {
				throw new Error("not called");
			},
		};
		await monitor.refresh(ctx);
		expect(statuses.at(-1)).toEqual([SEMANTIC_CAPABILITY_STATUS_ID, undefined]);

		ctx.modelRegistry = undefined;
		ctx.model = undefined;
		await monitor.refresh(ctx);
		expect(notifications).toHaveLength(2);
	});

	it("runs an explicit synthetic live probe without reading or mutating task state", async () => {
		const branch = [{ type: "message", role: "user", content: "private task" }];
		let prompt = "";
		const ctx = context({
			sessionManager: { getBranch: () => branch },
			model: { provider: "omp", id: "current" },
			runEphemeralTurn: async (options) => {
				prompt = options.promptText;
				return { replyText: JSON.stringify(planPayload()) };
			},
		});
		const before = structuredClone(branch);

		const result = await createSemanticCapabilityMonitor().doctor(ctx, {
			live: true,
		});

		expect(result.liveProbe).toMatchObject({
			status: "passed",
			strategy: "omp_ephemeral",
			provider: "omp",
			model: "current",
		});
		expect(result.text).toContain("Live probe: PASS via OMP ephemeral");
		expect(prompt).toContain("pi-tasks semantic health probe");
		expect(prompt).not.toContain("private task");
		expect(branch).toEqual(before);
	});

	it("makes unavailable and failed diagnostics actionable", async () => {
		const report = await inspectSemanticCapabilities(context());
		const result = await createSemanticCapabilityMonitor().doctor(context(), {
			live: true,
		});
		const staticText = formatSemanticCapabilityReport(report);

		expect(report.overall).toBe("unavailable");
		expect(staticText).toContain("Static capability check (no model request)");
		expect(staticText).toContain("Run /tasks doctor live");
		expect(result.liveProbe).toMatchObject({
			status: "failed",
			code: "unavailable",
		});
		expect(result.text).toContain("Recovery: select a Pi model");
	});
});
