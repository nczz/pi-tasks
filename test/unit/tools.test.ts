import { describe, expect, it } from "vitest";
import { TASK_EVENT_CUSTOM_TYPE, type TaskEvent } from "../../src/model.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
} from "../../src/pi-types.ts";
import { createTaskRuntimeStore } from "../../src/store.ts";
import { registerTaskTools } from "../../src/tools.ts";

class FixedIds {
	private index = 0;
	next(prefix: string): string {
		this.index += 1;
		return `${prefix}${this.index}`;
	}
}

function createHarness() {
	const tools = new Map<string, ToolDefinition<Record<string, unknown>>>();
	const entries: TaskEvent[] = [];
	const ui = {
		status: undefined as string | undefined,
		widget: undefined as string[] | undefined,
	};
	const pi: ExtensionAPI = {
		on: () => {},
		registerTool: (tool) => tools.set(tool.name, tool),
		registerCommand: () => {},
		appendEntry: (_customType, data) => {
			entries.push(data as TaskEvent);
		},
	};
	const ctx: ExtensionContext = {
		mode: "tui",
		sessionManager: {
			getBranch: () =>
				entries.map((entry, index) => ({
					type: "custom",
					customType: TASK_EVENT_CUSTOM_TYPE,
					id: `entry-${index}`,
					data: entry,
				})),
		},
		ui: {
			notify: () => {},
			setStatus: (_key, text) => {
				ui.status = text;
			},
			setWidget: (_key, lines) => {
				ui.widget = lines;
			},
		},
	};
	const store = createTaskRuntimeStore();
	registerTaskTools(pi, store, new FixedIds());
	return { tools, entries, ctx, store, ui };
}

async function execute(
	tool: ToolDefinition<Record<string, unknown>>,
	params: Record<string, unknown>,
	ctx: ExtensionContext,
) {
	return tool.execute("call-1", params, undefined, undefined, ctx);
}

function requireTool(
	tools: Map<string, ToolDefinition<Record<string, unknown>>>,
	name: string,
): ToolDefinition<Record<string, unknown>> {
	const tool = tools.get(name);
	if (!tool) throw new Error(`Tool ${name} not registered`);
	return tool;
}

describe("registered task tools", () => {
	it("create, update, evidence, complete, and replay through custom entries", async () => {
		const { tools, entries, ctx, store, ui } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const update = requireTool(tools, "task_update");
		const evidence = requireTool(tools, "task_evidence");
		const complete = requireTool(tools, "task_complete");
		const focus = requireTool(tools, "task_focus");

		await execute(
			plan,
			{
				title: "Tool MVP",
				objective: "Verify tools",
				acceptance_criteria: ["Tool creates task"],
				plan_steps: [
					{
						text: "Verify tool harness",
						expectedOutput: "Harness evidence is recorded",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["run unit harness"],
					},
				],
				activate: true,
			},
			ctx,
		);
		expect(ui.status).toContain("Task T1 active");
		expect(ui.widget?.join("\n")).toContain("Active task: T1");
		const focused = await execute(focus, {}, ctx);
		expect(focused.content[0]?.text).toContain("Current step: T1-S1");
		expect(focused.content[0]?.text).toContain("Expected output");
		await execute(
			update,
			{ task_id: "T1", progress: 50, next_action: "attach evidence" },
			ctx,
		);
		const rejected = await execute(
			complete,
			{ task_id: "T1", summary: "too soon", evidence_ids: [] },
			ctx,
		);
		expect(rejected.isError).toBe(true);
		const firstEvidence = await execute(
			evidence,
			{
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: "fake tool harness passed",
				passed: "true",
				criterion_ids: ["T1-AC1"],
			},
			ctx,
		);
		expect(firstEvidence.content[0]?.text).toContain("Recorded evidence");
		const duplicateEvidence = await execute(
			evidence,
			{
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: "fake tool harness passed",
				passed: "true",
				criterion_ids: ["T1-AC1"],
			},
			ctx,
		);
		expect(duplicateEvidence.content[0]?.text).toContain(
			"Evidence already recorded",
		);
		expect(store.getState().tasks.T1?.evidence).toHaveLength(1);
		await execute(
			update,
			{ task_id: "T1", step_id: "T1-S1", step_status: "done" },
			ctx,
		);
		await execute(
			complete,
			{ task_id: "T1", summary: "done", evidence_ids: ["E2"] },
			ctx,
		);

		expect(store.getState().tasks.T1?.status).toBe("done");
		expect(entries).toHaveLength(5);
		expect(ui.status).toBeUndefined();

		const replayed = createTaskRuntimeStore();
		replayed.replay(ctx.sessionManager.getBranch());
		expect(replayed.getState().tasks.T1?.status).toBe("done");
	});
});
