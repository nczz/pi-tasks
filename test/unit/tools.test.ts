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
	it("does not consume task IDs for rejected task_plan calls", async () => {
		const { tools, ctx, store } = createHarness();
		const plan = requireTool(tools, "task_plan");

		const rejected = await execute(
			plan,
			{
				title: "Bad plan",
				objective: "Exercise rejection",
				acceptance_criteria: ["Bad plan is rejected"],
				plan_steps: [
					{
						text: "Do the thing",
						expectedOutput: "Something happens",
						evidenceRequired: true,
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Too vague on purpose",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
				],
				activate: true,
			},
			ctx,
		);
		expect(rejected.content[0]?.text).toContain("Error:");
		expect(Object.keys(store.getState().tasks)).toEqual([]);

		const created = await execute(
			plan,
			{
				title: "Good plan",
				objective: "Create a valid task after a rejected plan",
				acceptance_criteria: ["Valid plan is recorded"],
				plan_steps: [
					{
						text: "Record valid plan evidence",
						expectedOutput: "Valid plan evidence is ready",
						evidenceRequired: true,
						allowedActions: ["task_evidence"],
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Single evidence recording action",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
				],
				activate: true,
			},
			ctx,
		);

		expect(created.content[0]?.text).toContain("Created task T1");
		expect(store.getState().tasks.T1?.id).toBe("T1");
	});

	it("create, update, evidence, complete, and replay through custom entries", async () => {
		const { tools, entries, ctx, store, ui } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const update = requireTool(tools, "task_update");
		const evidence = requireTool(tools, "task_evidence");
		const complete = requireTool(tools, "task_complete");
		const focus = requireTool(tools, "task_focus");
		const next = requireTool(tools, "task_next");
		const resume = requireTool(tools, "task_resume");

		const created = await execute(
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
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Single tool harness assertion",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
				],
				activate: true,
			},
			ctx,
		);
		expect(created.content[0]?.text).toContain("pi-tasks resume");
		expect(created.details).toMatchObject({ taskId: "T1" });
		expect((created.details as { tasks?: unknown }).tasks).toBeUndefined();
		expect(ui.status).toContain("Task T1 active");
		expect(ui.widget?.join("\n")).toContain("Active task: T1");
		const focused = await execute(focus, {}, ctx);
		expect(focused.content[0]?.text).toContain("Current step: T1-S1");
		expect(focused.content[0]?.text).toContain("Expected output");
		const nextResult = await execute(next, {}, ctx);
		expect(nextResult.content[0]?.text).toContain("Only next tool");
		expect(nextResult.content[0]?.text).toContain("Current step lock: T1-S1");
		const resumed = await execute(resume, {}, ctx);
		expect(resumed.content[0]?.text).toContain("pi-tasks resume");
		expect(resumed.content[0]?.text).toContain("Current step: T1-S1");
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
		expect(rejected.content[0]?.text).toContain("retry_with");
		expect(rejected.content[0]?.text).toContain("pi-tasks resume");
		expect(rejected.details).toMatchObject({
			rejected: true,
			do_not_retry_same_call: true,
		});
		const firstEvidence = await execute(
			evidence,
			{
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: "fake tool harness passed",
				passed: "true",
				references: ["vitest tool harness"],
				criterion_ids: ["T1-AC1"],
				step_ids: ["T1-S1"],
				quality: {
					source: "vitest",
					reproducible: true,
					verifier: "tool",
					artifactRefs: ["vitest tool harness"],
					observedOutput: "fake tool harness passed",
				},
			},
			ctx,
		);
		expect(firstEvidence.content[0]?.text).toContain("Recorded evidence");
		expect(
			(firstEvidence.details as { tasks?: unknown }).tasks,
		).toBeUndefined();
		const duplicateEvidence = await execute(
			evidence,
			{
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: "fake tool harness passed",
				passed: "true",
				references: ["vitest tool harness"],
				criterion_ids: ["T1-AC1"],
				step_ids: ["T1-S1"],
				quality: {
					source: "vitest",
					reproducible: true,
					verifier: "tool",
					artifactRefs: ["vitest tool harness"],
					observedOutput: "fake tool harness passed",
				},
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
			{ task_id: "T1", summary: "done", evidence_ids: ["E1"] },
			ctx,
		);

		expect(store.getState().tasks.T1?.status).toBe("done");
		expect(entries).toHaveLength(5);
		expect(ui.status).toBeUndefined();

		const replayed = createTaskRuntimeStore();
		replayed.replay(ctx.sessionManager.getBranch());
		expect(replayed.getState().tasks.T1?.status).toBe("done");
	});

	it("decomposes a coarse step before execution", async () => {
		const { tools, ctx, store } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const check = requireTool(tools, "task_granularity_check");
		const decompose = requireTool(tools, "task_decompose");
		const update = requireTool(tools, "task_update");

		await execute(
			plan,
			{
				title: "Recursive breakdown",
				objective: "Verify decomposition gate",
				acceptance_criteria: ["Step is atomic before execution"],
				plan_steps: [
					{
						text: "Implement release workflow",
						expectedOutput: "Release workflow is verified",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["inspect", "build", "test"],
						granularityCheck: {
							isAtomic: false,
							reason: "Contains multiple hidden verification subtasks",
							canBeDoneInOneAgentAction: false,
							hasSingleObservableOutput: false,
							hasSingleVerificationMethod: false,
							hasNoHiddenSubtasks: false,
						},
					},
				],
			},
			ctx,
		);
		const checkResult = await execute(check, {}, ctx);
		expect(checkResult.content[0]?.text).toContain("Next allowed action");
		const rejected = await execute(
			update,
			{ task_id: "T1", step_id: "T1-S1", step_status: "done" },
			ctx,
		);
		expect(rejected.isError).toBe(true);
		expect(rejected.content[0]?.text).toContain("task_decompose");
		await execute(
			decompose,
			{
				task_id: "T1",
				step_id: "T1-S1",
				reason: "Split into atomic verification steps",
				child_steps: [
					{
						text: "Run package dry-run",
						expectedOutput: "npm pack dry-run succeeds",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["npm pack --dry-run"],
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Single packaging command with one output",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
					{
						text: "Record package dry-run evidence",
						expectedOutput: "Evidence is attached to criterion",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["task_evidence"],
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Single evidence recording action",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
				],
			},
			ctx,
		);
		expect(store.getState().tasks.T1?.planSteps[0]?.id).toBe("T1-S1.1");
		expect(store.getState().tasks.T1?.planSteps[0]?.status).toBe("active");
		expect(store.getState().tasks.T1?.currentStep).toBe("Run package dry-run");
	});

	it("checkpoints resume state as a snapshot custom entry", async () => {
		const { tools, entries, ctx } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const checkpoint = requireTool(tools, "task_checkpoint");
		await execute(
			plan,
			{
				title: "Checkpoint",
				objective: "Verify checkpoint",
				acceptance_criteria: ["checkpoint exists"],
				plan_steps: [
					{
						text: "Create checkpoint",
						expectedOutput: "Snapshot includes resume",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["task_checkpoint"],
						decompositionStatus: "atomic",
						granularityCheck: {
							isAtomic: true,
							reason: "Single checkpoint action",
							canBeDoneInOneAgentAction: true,
							hasSingleObservableOutput: true,
							hasSingleVerificationMethod: true,
							hasNoHiddenSubtasks: true,
						},
					},
				],
			},
			ctx,
		);
		const result = await execute(
			checkpoint,
			{ reason: "before compaction" },
			ctx,
		);
		expect(result.content[0]?.text).toContain("Checkpointed");
		expect(entries.at(-1)?.type).toBe("task.snapshot");
		expect(
			entries.at(-1)?.type === "task.snapshot" &&
				entries.at(-1).resume.currentStepId,
		).toBe("T1-S1");
	});
});
