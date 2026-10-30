import { describe, expect, it } from "vitest";
import {
	MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH,
	MAX_EVIDENCE_REFERENCE_LENGTH,
	MAX_EVIDENCE_SUMMARY_LENGTH,
	TASK_EVENT_CUSTOM_TYPE,
	type TaskEvent,
} from "../../src/model.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
} from "../../src/pi-types.ts";
import { createTaskRuntimeStore } from "../../src/store.ts";
import { registerTaskTools } from "../../src/tools.ts";
import { fakeSemanticRuntime } from "./semantic-fixture.ts";

interface ToolSchema {
	type?: string;
	enum?: string[];
	required?: string[];
	maxLength?: number;
	properties?: Record<string, ToolSchema>;
	items?: ToolSchema;
	additionalProperties?: boolean;
}

class FixedIds {
	private index = 0;
	next(prefix: string): string {
		this.index += 1;
		return `${prefix}${this.index}`;
	}
}

type ReceiverBoundPi = ExtensionAPI & {
	runtime: {
		entries: TaskEvent[];
	};
};

function createHarness(
	options: {
		dynamicTools?: boolean;
		semanticRuntime?: Pick<ExtensionContext, "modelRegistry" | "model">;
	} = {},
) {
	const tools = new Map<string, ToolDefinition<Record<string, unknown>>>();
	const entries: TaskEvent[] = [];
	const ui = {
		status: undefined as string | undefined,
		widget: undefined as string[] | undefined,
	};
	const activeTools: string[] = [];
	const pi: ReceiverBoundPi = {
		runtime: { entries },
		events: { emit: () => {} },
		on: () => {},
		registerTool: (tool) => tools.set(tool.name, tool),
		registerCommand: () => {},
		appendEntry(customType, data) {
			expect(customType).toBe(TASK_EVENT_CUSTOM_TYPE);
			this.runtime.entries.push(data as TaskEvent);
		},
	};
	if (options.dynamicTools) {
		Object.assign(pi, {
			getActiveTools: () => activeTools,
			getAllTools: () =>
				[...tools.values()].map((tool) => ({ name: tool.name })),
			setActiveTools: (names: string[]) => {
				activeTools.splice(0, activeTools.length, ...names);
			},
		});
	}
	const ctx: ExtensionContext = {
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
		...(options.semanticRuntime ?? fakeSemanticRuntime()),
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
	it("projects prompt guidelines into tool descriptions for hosts that ignore custom fields", () => {
		const { tools } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const evidence = requireTool(tools, "task_evidence");

		expect(plan.promptGuidelines).toContain(
			"Use task_plan for multi-step work before implementation when no suitable active task exists.",
		);
		expect(plan.description).toContain("Agent guidance:");
		expect(plan.description).toContain(
			"Use task_plan for multi-step work before implementation when no suitable active task exists.",
		);
		expect(evidence.promptGuidelines).toContain(
			"Use task_evidence for tests, commands, reviews, files, dogfood, or explicit user acceptance.",
		);
		expect(evidence.description).toContain("Agent guidance:");
		expect(evidence.description).toContain(
			"Use task_evidence for tests, commands, reviews, files, dogfood, or explicit user acceptance.",
		);
	});

	it("removes caller-authored semantic judgments from plan schemas", () => {
		const { tools } = createHarness();
		for (const [toolName, collectionName] of [
			["task_plan", "plan_steps"],
			["task_decompose", "child_steps"],
		] as const) {
			const tool = requireTool(tools, toolName);
			const schema = tool.parameters as ToolSchema;
			const stepSchema = schema.properties?.[collectionName]?.items;
			expect(stepSchema?.properties).not.toHaveProperty("granularityCheck");
			expect(stepSchema?.properties).not.toHaveProperty("decompositionStatus");
			expect(stepSchema?.additionalProperties).toBe(false);
		}
	});

	it("keeps lazy control descriptions compact when native tool activation is available", () => {
		const { tools } = createHarness({ dynamicTools: true });
		const plan = requireTool(tools, "task_plan");
		const evidence = requireTool(tools, "task_evidence");

		expect(plan.description).toContain("Agent guidance:");
		expect(evidence.promptGuidelines).toBeUndefined();
		expect(evidence.description).not.toContain("Agent guidance:");
		expect(evidence.description).toBe(
			"Attach verification evidence to a task and optionally satisfy acceptance criteria.",
		);
	});

	it("uses an omp-compatible task_evidence schema with required quality fields", () => {
		const { tools } = createHarness();
		const evidence = requireTool(tools, "task_evidence");
		const schema = evidence.parameters as ToolSchema;

		expect(schema.type).toBe("object");
		expect(schema.required).toEqual(
			expect.arrayContaining([
				"task_id",
				"type",
				"level",
				"summary",
				"passed",
				"references",
				"quality",
			]),
		);
		expect(schema.properties?.type?.enum).toEqual(
			expect.arrayContaining(["command", "test", "dogfood", "review"]),
		);
		expect(schema.properties?.supersedes).toMatchObject({
			type: "array",
		});
		expect(schema.properties?.quality?.required).toEqual(
			expect.arrayContaining([
				"source",
				"reproducible",
				"verifier",
				"command",
				"artifactRefs",
				"observedOutput",
			]),
		);
		expect(schema).not.toHaveProperty("oneOf");
		expect(schema.properties?.summary?.maxLength).toBe(
			MAX_EVIDENCE_SUMMARY_LENGTH,
		);
		expect(schema.properties?.references?.items?.maxLength).toBe(
			MAX_EVIDENCE_REFERENCE_LENGTH,
		);
		expect(schema.properties?.quality?.properties?.source?.maxLength).toBe(
			MAX_EVIDENCE_REFERENCE_LENGTH,
		);
		expect(schema.properties?.quality?.properties?.command?.maxLength).toBe(
			MAX_EVIDENCE_REFERENCE_LENGTH,
		);
		expect(
			schema.properties?.quality?.properties?.artifactRefs?.items?.maxLength,
		).toBe(MAX_EVIDENCE_REFERENCE_LENGTH);
		expect(
			schema.properties?.quality?.properties?.observedOutput?.maxLength,
		).toBe(MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH);
	});

	it("returns a copyable task_evidence example after quality rejection", async () => {
		const { tools, ctx } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const evidence = requireTool(tools, "task_evidence");

		await execute(
			plan,
			{
				title: "Evidence recovery",
				objective: "Verify task_evidence recovery example",
				acceptance_criteria: ["Recovery example is returned"],
				plan_steps: [
					{
						text: "Record command evidence",
						expectedOutput: "Rejected evidence includes a corrected example",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["task_evidence"],
					},
				],
				activate: true,
			},
			ctx,
		);

		const rejected = await execute(
			evidence,
			{
				task_id: "T1",
				type: "command",
				level: "e2e_smoke",
				summary: "npm test passed",
				passed: "true",
				supersedes: ["E0"],
				references: ["npm test"],
				criterion_ids: ["T1-AC1"],
				step_ids: ["T1-S1"],
				quality: {
					source: "local shell",
					reproducible: true,
					verifier: "tool",
					artifactRefs: ["npm test"],
					command: "npm test",
				},
			},
			ctx,
		);

		expect(rejected.isError).toBe(true);
		expect(rejected.content[0]?.text).toContain("task_evidence retry template");
		expect(rejected.content[0]?.text).not.toContain("Minimal working");
		expect(rejected.content[0]?.text).toContain('"command": "npm test"');
		expect(rejected.content[0]?.text).toContain(
			'"observedOutput": "<concise observed output',
		);
		expect(rejected.details).toMatchObject({
			rejected: true,
			retry_example: {
				task_id: "T1",
				type: "command",
				supersedes: ["E0"],
				quality: {
					command: "npm test",
					observedOutput:
						"<concise observed output from the command/test/dogfood run>",
				},
			},
		});
	});

	it("keeps required verification commands in test and dogfood retry templates", async () => {
		for (const type of ["test", "dogfood"] as const) {
			const { tools, entries, ctx } = createHarness();
			const plan = requireTool(tools, "task_plan");
			const evidence = requireTool(tools, "task_evidence");
			await execute(
				plan,
				{
					title: `${type} recovery`,
					objective: `Verify ${type} recovery command`,
					acceptance_criteria: ["Recovery preserves the verification command"],
					plan_steps: [
						{
							text: `Record ${type} evidence`,
							expectedOutput: `${type} retry template preserves its command`,
							allowedActions: ["task_evidence"],
						},
					],
				},
				ctx,
			);

			const rejected = await execute(
				evidence,
				{
					task_id: "T1",
					type,
					level: "not_verified",
					summary: `${type} run reported 7 passed`,
					passed: "true",
					references: ["npm test"],
					step_ids: ["T1-S1"],
					quality: {
						source: "local fixture",
						reproducible: true,
						verifier: "tool",
						command: "npm test",
						artifactRefs: ["npm test"],
						observedOutput: "Tests 7 passed (7)",
					},
				},
				ctx,
			);

			expect(rejected.isError).toBe(true);
			expect(rejected.details).toMatchObject({
				retry_example: {
					type,
					quality: {
						command: "npm test",
					},
				},
			});
			expect(entries).toHaveLength(1);
		}
	});

	it("replaces every over-limit retry field without truncating submitted values", async () => {
		const { tools, entries, ctx } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const evidence = requireTool(tools, "task_evidence");
		await execute(
			plan,
			{
				title: "Bounded recovery",
				objective: "Verify bounded evidence retry fields",
				acceptance_criteria: ["Retry fields respect declared limits"],
				plan_steps: [
					{
						text: "Record bounded evidence",
						expectedOutput: "Rejected evidence returns bounded retry fields",
						allowedActions: ["task_evidence"],
					},
				],
			},
			ctx,
		);
		const longSummary = "s".repeat(MAX_EVIDENCE_SUMMARY_LENGTH + 1);
		const longReference = "r".repeat(MAX_EVIDENCE_REFERENCE_LENGTH + 1);
		const longSource = "u".repeat(MAX_EVIDENCE_REFERENCE_LENGTH + 1);
		const longCommand = "c".repeat(MAX_EVIDENCE_REFERENCE_LENGTH + 1);
		const longArtifact = "a".repeat(MAX_EVIDENCE_REFERENCE_LENGTH + 1);
		const longOutput = "o".repeat(MAX_EVIDENCE_OBSERVED_OUTPUT_LENGTH + 1);

		const rejected = await execute(
			evidence,
			{
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: longSummary,
				passed: "true",
				references: [longReference],
				step_ids: ["T1-S1"],
				quality: {
					source: longSource,
					reproducible: true,
					verifier: "tool",
					command: longCommand,
					artifactRefs: [longArtifact],
					observedOutput: longOutput,
				},
			},
			ctx,
		);

		expect(rejected.isError).toBe(true);
		expect(rejected.details).toMatchObject({
			retry_example: {
				summary:
					"<concise evidence summary; put long output in quality.artifactRefs>",
				references: ["<short-artifact-or-command-reference>"],
				quality: {
					source: "<concise evidence source>",
					command:
						"<exact verification command or action; full command in artifactRefs>",
					artifactRefs: ["<short-artifact-reference>"],
					observedOutput:
						"<concise observed output from the command/test/dogfood run>",
				},
			},
		});
		const retryText = rejected.content[0]?.text ?? "";
		expect(retryText).not.toContain(longSummary);
		expect(retryText).not.toContain(longReference);
		expect(retryText).not.toContain(longSource);
		expect(retryText).not.toContain(longCommand);
		expect(retryText).not.toContain(longArtifact);
		expect(retryText).not.toContain(longOutput);
		expect(entries).toHaveLength(1);
	});

	it("returns targeted task_update recovery for missing scope fields", async () => {
		const { tools, entries, ctx, store } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const update = requireTool(tools, "task_update");
		await execute(
			plan,
			{
				title: "Scope recovery",
				objective: "Verify conditional scope update recovery",
				acceptance_criteria: ["Scope recovery names the missing field"],
				plan_steps: [
					{
						text: "Inspect the current fixture",
						expectedOutput: "One fixture inspection record",
						allowedActions: ["Read current fixture"],
					},
				],
			},
			ctx,
		);

		const missingActivity = await execute(
			update,
			{ task_id: "T1", scope: "within_step" },
			ctx,
		);
		expect(missingActivity.isError).toBe(true);
		expect(missingActivity.details).toMatchObject({
			retry_with: "task_update",
			correct_rejected_call_first: true,
			minimum_params: {
				task_id: "T1",
				activity: "<meaningful activity performed>",
				scope: "within_step",
			},
		});
		expect(missingActivity.content[0]?.text).toContain(
			'- minimum_params: {"task_id":"T1","activity":"<meaningful activity performed>","scope":"within_step"}',
		);
		expect(missingActivity.content[0]?.text).not.toContain(
			"Do now: task_evidence",
		);
		expect(entries).toHaveLength(1);

		const missingActivityAndReason = await execute(
			update,
			{ task_id: "T1", scope: "off_plan" },
			ctx,
		);
		expect(missingActivityAndReason.isError).toBe(true);
		expect(missingActivityAndReason.details).toMatchObject({
			retry_with: "task_update",
			minimum_params: {
				task_id: "T1",
				activity: "<meaningful activity performed>",
				scope: "off_plan",
				scope_reason:
					"<why this scope change or off-plan activity was necessary>",
			},
		});
		expect(entries).toHaveLength(1);

		const withinStep = await execute(
			update,
			{
				task_id: "T1",
				activity: "Inspected the current fixture",
				scope: "within_step",
			},
			ctx,
		);
		expect(withinStep.isError).not.toBe(true);
		expect(entries).toHaveLength(2);

		const activityOnly = await execute(
			update,
			{ task_id: "T1", activity: "Recorded the fixture checksum" },
			ctx,
		);
		expect(activityOnly.isError).not.toBe(true);
		expect(entries).toHaveLength(3);

		const missingReason = await execute(
			update,
			{
				task_id: "T1",
				activity: "Inspected an extra fixture",
				scope: "off_plan",
			},
			ctx,
		);
		expect(missingReason.isError).toBe(true);
		expect(missingReason.details).toMatchObject({
			retry_with: "task_update",
			minimum_params: {
				task_id: "T1",
				activity: "Inspected an extra fixture",
				scope: "off_plan",
				scope_reason:
					"<why this scope change or off-plan activity was necessary>",
			},
		});
		expect(missingReason.content[0]?.text).toContain(
			'"scope_reason":"<why this scope change or off-plan activity was necessary>"',
		);
		expect(entries).toHaveLength(3);

		const offPlan = await execute(
			update,
			{
				task_id: "T1",
				activity: "Inspected an extra fixture",
				scope: "off_plan",
				scope_reason: "Needed to compare fixture formats",
			},
			ctx,
		);
		expect(offPlan.isError).not.toBe(true);
		expect(entries).toHaveLength(4);
		expect(store.getState().tasks.T1?.warnings).toContain(
			"off_plan: Inspected an extra fixture (Needed to compare fixture formats)",
		);

		const unrelatedRejection = await execute(
			update,
			{ task_id: "T1", step_id: "T1-S1", step_status: "done" },
			ctx,
		);
		expect(unrelatedRejection.isError).toBe(true);
		expect(unrelatedRejection.details).toMatchObject({
			retry_with: "task_evidence",
		});
		expect(entries).toHaveLength(4);
	});

	it("preserves ExtensionAPI method receivers when appending task events", async () => {
		const { tools, ctx, store } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const decision = requireTool(tools, "task_decision");

		const created = await execute(
			plan,
			{
				title: "Receiver compatibility",
				objective:
					"Verify task_plan works with receiver-bound ExtensionAPI methods",
				acceptance_criteria: ["Task event is appended through ExtensionAPI"],
				plan_steps: [
					{
						text: "Record receiver compatibility evidence",
						expectedOutput: "Receiver-bound appendEntry stores a task event",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["task_plan"],
					},
				],
				activate: true,
			},
			ctx,
		);

		expect(created.content[0]?.text).toContain("Created task T1");
		expect(store.getState().tasks.T1?.title).toBe("Receiver compatibility");
		const recorded = await execute(
			decision,
			{
				task_id: "T1",
				question: "Which host API style must pi-tasks support?",
				decision:
					"Support both closure-backed and receiver-bound ExtensionAPI methods",
				decided_by: "agent",
				rationale:
					"Pi uses closure-backed methods; OMP may use receiver-bound methods.",
			},
			ctx,
		);

		expect(recorded.content[0]?.text).toContain("Recorded decision D1");
		expect(store.getState().tasks.T1?.decisions[0]?.decision).toBe(
			"Support both closure-backed and receiver-bound ExtensionAPI methods",
		);
	});

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
					},
				],
				activate: true,
			},
			ctx,
		);

		expect(created.content[0]?.text).toContain("Created task T1");
		expect(store.getState().tasks.T1?.id).toBe("T1");
	});

	it("allocates unique task IDs after concurrent semantic assessments finish", async () => {
		const fixture = fakeSemanticRuntime();
		const classify = fixture.modelRegistry?.classify;
		if (!classify) throw new Error("Expected classifier fixture");
		const releases: Array<() => void> = [];
		const { tools, ctx, store } = createHarness({
			semanticRuntime: {
				model: fixture.model,
				modelRegistry: {
					...fixture.modelRegistry,
					classify: async (model, classifierContext, options) => {
						const gate = Promise.withResolvers<void>();
						releases.push(gate.resolve);
						await gate.promise;
						return classify(model, classifierContext, options);
					},
				},
			},
		});
		const plan = requireTool(tools, "task_plan");
		const params = (title: string) => ({
			title,
			objective: `Create ${title}`,
			acceptance_criteria: [`${title} is persisted`],
			plan_steps: [
				{
					text: `Record ${title}`,
					expectedOutput: `${title} event is persisted`,
					evidenceRequired: true,
				},
			],
			activate: true,
		});

		const first = execute(plan, params("Concurrent A"), ctx);
		const second = execute(plan, params("Concurrent B"), ctx);
		await Promise.resolve();
		expect(releases).toHaveLength(2);
		releases[1]?.();
		const secondResult = await second;
		releases[0]?.();
		const firstResult = await first;

		expect(secondResult.content[0]?.text).toContain("Created task T1");
		expect(firstResult.content[0]?.text).toContain("Created task T2");
		expect(Object.keys(store.getState().tasks).sort()).toEqual(["T1", "T2"]);
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
					},
					{
						text: "Record package dry-run evidence",
						expectedOutput: "Evidence is attached to criterion",
						criterionIds: ["T1-AC1"],
						evidenceRequired: true,
						allowedActions: ["task_evidence"],
					},
				],
			},
			ctx,
		);
		expect(store.getState().tasks.T1?.planSteps[0]?.id).toBe("T1-S1.1");
		expect(store.getState().tasks.T1?.planSteps[0]?.status).toBe("active");
		expect(store.getState().tasks.T1?.currentStep).toBe("Run package dry-run");
	});

	it("does not consume evidence IDs when state changes during assessment", async () => {
		const fixture = fakeSemanticRuntime();
		const classify = fixture.modelRegistry?.classify;
		if (!classify) throw new Error("Expected classifier fixture");
		const started = Promise.withResolvers<void>();
		const gate = Promise.withResolvers<void>();
		let evidenceCalls = 0;
		const { tools, ctx } = createHarness({
			semanticRuntime: {
				model: fixture.model,
				modelRegistry: {
					...fixture.modelRegistry,
					classify: async (model, classifierContext, options) => {
						if ("passing_evidence_supported" in classifierContext.questions) {
							evidenceCalls += 1;
							if (evidenceCalls === 1) {
								started.resolve();
								await gate.promise;
							}
						}
						return classify(model, classifierContext, options);
					},
				},
			},
		});
		const plan = requireTool(tools, "task_plan");
		const update = requireTool(tools, "task_update");
		const evidence = requireTool(tools, "task_evidence");
		await execute(
			plan,
			{
				title: "Stale evidence",
				objective: "Reject semantic evidence for a closed step",
				acceptance_criteria: ["Only current-step evidence is persisted"],
				plan_steps: [
					{
						text: "Inspect the first fixture",
						expectedOutput: "The first fixture inspection is recorded",
						evidenceRequired: true,
					},
					{
						text: "Inspect the second fixture",
						expectedOutput: "The second fixture inspection is recorded",
						evidenceRequired: true,
					},
				],
			},
			ctx,
		);
		const evidenceParams = (stepId: string, fixture: string) => ({
			task_id: "T1",
			type: "test",
			level: "integration_test",
			summary: `${fixture} inspection returned PASS`,
			passed: "true",
			references: [fixture],
			criterion_ids: ["T1-AC1"],
			step_ids: [stepId],
			quality: {
				source: "semantic fixture",
				reproducible: true,
				verifier: "tool",
				command: `inspect ${fixture}`,
				artifactRefs: [fixture],
				observedOutput: `${fixture} inspection returned PASS`,
			},
		});
		const staleEvidence = execute(
			evidence,
			evidenceParams("T1-S1", "fixture-one"),
			ctx,
		);
		await started.promise;
		await execute(
			update,
			{
				task_id: "T1",
				step_id: "T1-S1",
				step_status: "skipped",
				note: "Simulate concurrent step closure",
			},
			ctx,
		);
		gate.resolve();
		const rejected = await staleEvidence;
		expect(rejected.isError).toBe(true);
		expect(rejected.content[0]?.text).toContain("current step T1-S2");

		const accepted = await execute(
			evidence,
			evidenceParams("T1-S2", "fixture-two"),
			ctx,
		);
		expect(accepted.content[0]?.text).toContain("Recorded evidence E1");
	});

	it("rejects a stale decomposition assessment when the parent changes in flight", async () => {
		const fixture = fakeSemanticRuntime();
		const classify = fixture.modelRegistry?.classify;
		if (!classify) throw new Error("Expected classifier fixture");
		let calls = 0;
		const gate = Promise.withResolvers<void>();
		const { tools, ctx, store } = createHarness({
			semanticRuntime: {
				model: fixture.model,
				modelRegistry: {
					...fixture.modelRegistry,
					classify: async (model, classifierContext, options) => {
						calls += 1;
						if (calls === 2) await gate.promise;
						return classify(model, classifierContext, options);
					},
				},
			},
		});
		const plan = requireTool(tools, "task_plan");
		const decompose = requireTool(tools, "task_decompose");
		const update = requireTool(tools, "task_update");
		await execute(
			plan,
			{
				title: "Stale decomposition",
				objective: "Reject semantic results for a changed parent",
				acceptance_criteria: ["No stale child steps are persisted"],
				plan_steps: [
					{
						text: "Implement release workflow",
						expectedOutput: "Release workflow is verified",
						evidenceRequired: true,
					},
				],
			},
			ctx,
		);

		const pending = execute(
			decompose,
			{
				task_id: "T1",
				step_id: "T1-S1",
				reason: "Split independent operations",
				child_steps: [
					{
						text: "Run package dry-run",
						expectedOutput: "Package dry-run succeeds",
						evidenceRequired: true,
					},
					{
						text: "Record package result",
						expectedOutput: "Package evidence is recorded",
						evidenceRequired: true,
					},
				],
			},
			ctx,
		);
		await Promise.resolve();
		const changed = await execute(
			update,
			{
				task_id: "T1",
				step_id: "T1-S1",
				step_status: "skipped",
				note: "Concurrent operator skipped the parent",
			},
			ctx,
		);
		expect(changed.isError).not.toBe(true);
		gate.resolve();
		const rejected = await pending;

		expect(rejected.isError).toBe(true);
		expect(rejected.content[0]?.text).toContain(
			"changed while semantic assessment was running",
		);
		expect(store.getState().tasks.T1?.planSteps).toHaveLength(1);
		expect(store.getState().tasks.T1?.planSteps[0]?.status).toBe("skipped");
	});

	it("recovers explicitly when a non-atomic step reaches maximum decomposition depth", async () => {
		const { tools, entries, ctx, store } = createHarness();
		const plan = requireTool(tools, "task_plan");
		const check = requireTool(tools, "task_granularity_check");
		const decompose = requireTool(tools, "task_decompose");
		const update = requireTool(tools, "task_update");
		const focus = requireTool(tools, "task_focus");
		const next = requireTool(tools, "task_next");
		const resume = requireTool(tools, "task_resume");
		const childStep = {
			text: "Inspect the synthetic fixture",
			expectedOutput: "A synthetic inspection record",
		};

		await execute(
			plan,
			{
				title: "Depth recovery",
				objective: "Recover from the maximum decomposition depth",
				acceptance_criteria: ["Recovery names an executable next tool"],
				plan_steps: [
					{
						...childStep,
						allowedActions: ["Read synthetic fixture"],
					},
				],
			},
			ctx,
		);

		let stepId = "T1-S1";
		for (let depth = 0; depth < 4; depth += 1) {
			const decomposed = await execute(
				decompose,
				{
					task_id: "T1",
					step_id: stepId,
					reason: "Reduce one synthetic layer",
					child_steps: [childStep, { ...childStep }],
				},
				ctx,
			);
			expect(decomposed.isError).not.toBe(true);
			stepId += ".1";
		}

		expect(store.getState().tasks.T1?.nextAction).toContain(
			"maximum decomposition depth reached",
		);
		const resumed = await execute(resume, {}, ctx);
		expect(resumed.details).toMatchObject({
			mode: "blocked",
			recommendedTool: "task_update",
			nextAllowedActions: ["task_update"],
			minimumParams: {
				task_id: "T1",
				status: "blocked",
				blocker: {
					blockedBy: "ambiguity",
				},
			},
		});
		const focused = await execute(focus, {}, ctx);
		const nextResult = await execute(next, {}, ctx);
		const checked = await execute(
			check,
			{ task_id: "T1", step_id: stepId },
			ctx,
		);
		expect(resumed.content[0]?.text).toContain("Do now: task_update");
		expect(resumed.content[0]?.text).toContain("maximum decomposition depth");
		expect(focused.content[0]?.text).toContain(
			"Next allowed action: task_update",
		);
		expect(nextResult.content[0]?.text).toContain(
			"Only next tool: task_update",
		);
		expect(checked.content[0]?.text).toContain(
			"Next allowed action: task_update",
		);
		const persistedAtLimit = entries.length;
		const rejectedScope = await execute(
			update,
			{ task_id: "T1", scope: "within_step" },
			ctx,
		);
		expect(rejectedScope.isError).toBe(true);
		expect(rejectedScope.details).toMatchObject({
			retry_with: "task_update",
			correct_rejected_call_first: true,
			minimum_params: {
				task_id: "T1",
				activity: "<meaningful activity performed>",
				scope: "within_step",
			},
		});
		expect(rejectedScope.content[0]?.text).not.toContain(
			"maximum decomposition depth",
		);
		expect(entries).toHaveLength(persistedAtLimit);
		const rejectedDone = await execute(
			update,
			{ task_id: "T1", step_id: stepId, step_status: "done" },
			ctx,
		);
		expect(rejectedDone.isError).toBe(true);
		expect(rejectedDone.content[0]?.text).toContain(
			"maximum decomposition depth while still non-atomic",
		);
		expect(rejectedDone.details).toMatchObject({
			retry_with: "task_update",
			minimum_params: {
				status: "blocked",
			},
		});
		expect(entries).toHaveLength(persistedAtLimit);

		const rejectedDecompose = await execute(
			decompose,
			{
				task_id: "T1",
				step_id: stepId,
				reason: "Try one more layer",
				child_steps: [childStep, { ...childStep }],
			},
			ctx,
		);
		expect(rejectedDecompose.isError).toBe(true);
		expect(rejectedDecompose.details).toMatchObject({
			retry_with: "task_update",
			minimum_params: {
				task_id: "T1",
				status: "blocked",
			},
			resume: {
				recommendedTool: "task_update",
			},
		});
		expect(entries).toHaveLength(persistedAtLimit);

		const blocked = await execute(
			update,
			{
				task_id: "T1",
				status: "blocked",
				blocker: {
					reason: "Plan step remains non-atomic at maximum decomposition depth",
					blockedBy: "ambiguity",
					neededToUnblock:
						"Create a flat successor task with the remaining scope",
				},
			},
			ctx,
		);
		expect(blocked.isError).not.toBe(true);
		expect(store.getState().tasks.T1?.status).toBe("blocked");
		expect(store.getState().activeTaskId).toBeUndefined();
		const afterBlock = await execute(resume, {}, ctx);
		expect(afterBlock.details).toMatchObject({
			mode: "planning",
			recommendedTool: "task_plan",
		});
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
