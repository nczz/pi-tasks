import { describe, expect, it } from "vitest";
import taskExtension, {
	TASK_STATE_EVENT,
	TASK_WIDGET_ID,
	type TaskStateEvent,
} from "../../index.ts";
import { TASK_EVENT_CUSTOM_TYPE, type TaskEvent } from "../../src/model.ts";
import type {
	ExtensionAPI,
	ExtensionContext,
	ToolDefinition,
} from "../../src/pi-types.ts";

const createEvent: TaskEvent = {
	version: 1,
	id: "T1-created",
	type: "task.created",
	taskId: "T1",
	createdAt: "2026-07-21T00:00:00.000Z",
	source: "tool",
	title: "State hook replay",
	objective: "Verify replay publication",
	acceptanceCriteria: ["State is published"],
	planSteps: [
		{
			text: "Inspect state event",
			expectedOutput: "Versioned state event payload observed",
			criterionIds: ["T1-AC1"],
			evidenceRequired: true,
			allowedActions: ["read"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single event inspection",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
	],
	activate: true,
};

const mutationPlanParams: Record<string, unknown> = {
	title: "Mutation hook",
	objective: "Verify mutation publication",
	acceptance_criteria: ["Mutation state is published"],
	plan_steps: [
		{
			text: "Inspect mutation event",
			expectedOutput: "Mutation event payload observed",
			evidenceRequired: true,
			allowedActions: ["read"],
			decompositionStatus: "atomic",
			granularityCheck: {
				isAtomic: true,
				reason: "Single mutation inspection",
				canBeDoneInOneAgentAction: true,
				hasSingleObservableOutput: true,
				hasSingleVerificationMethod: true,
				hasNoHiddenSubtasks: true,
			},
		},
	],
	activate: true,
};

type Handler = (event: unknown, ctx: ExtensionContext) => Promise<void> | void;

function createHarness(initialEvents: TaskEvent[] = []) {
	const branchEvents = [...initialEvents];
	const emitted: TaskStateEvent[] = [];
	const operations: string[] = [];
	const subscribers: Array<(value: unknown) => void> = [];
	const handlers = new Map<string, Handler>();
	const tools = new Map<string, ToolDefinition<Record<string, unknown>>>();
	const ui = { widget: undefined as string[] | undefined };
	const pi: ExtensionAPI = {
		events: {
			emit: (event, data) => {
				expect(event).toBe(TASK_STATE_EVENT);
				operations.push("event");
				emitted.push(data as TaskStateEvent);
				for (const subscriber of subscribers) subscriber(data);
			},
		},
		on: (event, handler) => handlers.set(event, handler),
		registerTool: (tool) => tools.set(tool.name, tool),
		registerCommand: () => {},
		appendEntry: (customType, data) => {
			expect(customType).toBe(TASK_EVENT_CUSTOM_TYPE);
			branchEvents.push(data as TaskEvent);
		},
	};
	const ctx: ExtensionContext = {
		mode: "tui",
		sessionManager: {
			getBranch: () =>
				branchEvents.map((event, index) => ({
					type: "custom",
					customType: TASK_EVENT_CUSTOM_TYPE,
					id: `entry-${index}`,
					data: event,
				})),
		},
		ui: {
			notify: () => {},
			setStatus: () => operations.push("status"),
			setWidget: (key, content) => {
				expect(key).toBe(TASK_WIDGET_ID);
				operations.push("widget");
				ui.widget = content;
			},
		},
	};

	taskExtension(pi);
	return {
		ctx,
		emitted,
		handlers,
		operations,
		subscribe: (subscriber: (value: unknown) => void) =>
			subscribers.push(subscriber),
		tools,
		ui,
	};
}

async function execute(
	tool: ToolDefinition<Record<string, unknown>> | undefined,
	params: Record<string, unknown>,
	ctx: ExtensionContext,
) {
	if (!tool) throw new Error("Expected registered tool");
	return tool.execute("call-1", params, undefined, undefined, ctx);
}

function createConsumer() {
	let ctx: ExtensionContext | undefined;
	let latest: TaskStateEvent | undefined;
	const render = () => {
		if (!ctx || !latest) return;
		const active = latest.state.activeTaskId
			? latest.state.tasks[latest.state.activeTaskId]
			: undefined;
		ctx.ui.setWidget(
			latest.widgetId,
			active ? [`Custom task: ${active.id} ${active.title}`] : undefined,
			{ placement: "aboveEditor" },
		);
	};
	return {
		attach(nextCtx: ExtensionContext) {
			ctx = nextCtx;
			render();
		},
		receive(value: unknown) {
			if (
				!value ||
				typeof value !== "object" ||
				(value as { version?: unknown }).version !== 1
			)
				return;
			latest = value as TaskStateEvent;
			render();
		},
	};
}

describe("task state event hook", () => {
	it("publishes cloned replay state after restoring the default widget", async () => {
		const { ctx, emitted, handlers, operations, tools } = createHarness([
			createEvent,
		]);

		await handlers.get("session_start")?.({}, ctx);
		expect(operations).toEqual(["status", "widget", "event"]);
		expect(emitted[0]).toMatchObject({
			version: 1,
			reason: "session_start",
			widgetId: TASK_WIDGET_ID,
			state: { activeTaskId: "T1" },
		});
		expect("events" in (emitted[0]?.state ?? {})).toBe(false);

		const publishedTask = emitted[0]?.state.tasks.T1;
		if (!publishedTask) throw new Error("Expected published task");
		publishedTask.title = "consumer mutation";
		const focus = await execute(tools.get("task_focus"), {}, ctx);
		expect(focus.content[0]?.text).toContain("State hook replay");
		expect(focus.content[0]?.text).not.toContain("consumer mutation");

		await handlers.get("session_tree")?.({}, ctx);
		expect(emitted.at(-1)?.reason).toBe("session_tree");
	});

	it.each(["context-first", "state-first"] as const)(
		"lets a subscriber own the final widget when %s",
		async (order) => {
			const { ctx, handlers, subscribe, ui } = createHarness([createEvent]);
			const consumer = createConsumer();
			subscribe(consumer.receive);
			if (order === "context-first") consumer.attach(ctx);

			await handlers.get("session_start")?.({}, ctx);
			if (order === "state-first") consumer.attach(ctx);

			expect(ui.widget).toEqual(["Custom task: T1 State hook replay"]);
		},
	);

	it("publishes each successful task mutation", async () => {
		const { ctx, emitted, handlers, operations, tools } = createHarness();
		await handlers.get("session_start")?.({}, ctx);
		operations.length = 0;

		const result = await execute(
			tools.get("task_plan"),
			mutationPlanParams,
			ctx,
		);

		expect(result.content[0]?.text).toContain("Created task T1");
		expect(operations).toEqual(["status", "widget", "event"]);
		expect(emitted.at(-1)).toMatchObject({
			version: 1,
			reason: "task_mutation",
			state: { activeTaskId: "T1" },
		});
	});

	it("does not publish rejected mutations", async () => {
		const { ctx, emitted, handlers, tools } = createHarness();
		await handlers.get("session_start")?.({}, ctx);
		const emissionCount = emitted.length;

		const result = await execute(
			tools.get("task_plan"),
			{
				title: "Rejected mutation",
				objective: "Verify rejected publication",
				acceptance_criteria: [],
				initial_steps: ["Inspect rejection"],
			},
			ctx,
		);

		expect(result.isError).toBe(true);
		expect(emitted).toHaveLength(emissionCount);
	});

	it("isolates observer failures from persisted mutations", async () => {
		const { ctx, handlers, subscribe, tools } = createHarness();
		subscribe(() => {
			throw new Error("consumer failed");
		});
		await handlers.get("session_start")?.({}, ctx);

		const result = await execute(
			tools.get("task_plan"),
			mutationPlanParams,
			ctx,
		);
		const focus = await execute(tools.get("task_focus"), {}, ctx);

		expect(result.isError).not.toBe(true);
		expect(result.content[0]?.text).toContain("Created task T1");
		expect(focus.content[0]?.text).toContain("Mutation hook");
	});
});
