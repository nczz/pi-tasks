import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const sdkRoot = process.env.PI_SDK_ROOT;
if (!sdkRoot) {
	throw new Error(
		"PI_SDK_ROOT is required for native extension tests; the test must not skip.",
	);
}

// PI_SDK_ROOT selects the installed SDK version under test; a static import
// would resolve the repository's dependencies instead of that release.
const sdk = await import(pathToFileURL(join(sdkRoot, "dist/index.js")).href);
const piAi = await import(
	pathToFileURL(join(sdkRoot, "..", "pi-ai", "dist", "index.js")).href
);
const taskRoot = resolve(import.meta.dirname, "..");
const taskToolNames = new Set([
	"task_plan",
	"task_next",
	"task_focus",
	"task_resume",
	"task_checkpoint",
	"task_granularity_check",
	"task_decompose",
	"task_list",
	"task_update",
	"task_evidence",
	"task_decision",
	"task_complete",
]);

const cleanups: string[] = [];

afterEach(async () => {
	await Promise.all(
		cleanups
			.splice(0)
			.map((path) => rm(path, { recursive: true, force: true })),
	);
});

function activeTaskTools(session: {
	agent: { state: { tools: Array<{ name: string }> } };
}): string[] {
	return session.agent.state.tools
		.map((tool) => tool.name)
		.filter((name) => taskToolNames.has(name));
}

function isToolActive(
	session: { agent: { state: { tools: Array<{ name: string }> } } },
	name: string,
): boolean {
	return session.agent.state.tools.some((tool) => tool.name === name);
}

type NativeToolResult = {
	content: Array<{ type: string; text: string }>;
	details?: unknown;
	isError?: boolean;
};

type NativeTool = {
	name: string;
	execute(...args: unknown[]): Promise<NativeToolResult>;
};

function requireTool(
	session: { agent: { state: { tools: NativeTool[] } } },
	name: string,
): NativeTool {
	const tool = session.agent.state.tools.find(
		(candidate) => candidate.name === name,
	);
	if (!tool) throw new Error(`Expected active tool ${name}`);
	return tool;
}

function toolSurface(session: {
	agent: {
		state: {
			tools: Array<{
				name: string;
				description?: string;
				parameters?: unknown;
				promptSnippet?: string;
				promptGuidelines?: string[];
			}>;
			systemPrompt: string;
		};
	};
}): { schemaAndDescriptionChars: number; systemPromptChars: number } {
	const schemaAndDescriptionChars = session.agent.state.tools
		.filter((tool) => taskToolNames.has(tool.name))
		.reduce(
			(total, tool) =>
				total +
				(tool.description?.length ?? 0) +
				JSON.stringify(tool.parameters ?? {}).length,
			0,
		);
	return {
		schemaAndDescriptionChars,
		systemPromptChars: session.agent.state.systemPrompt.length,
	};
}

async function waitForPersistedTaskEvent(
	sessionFile: string,
	eventType:
		| "task.created"
		| "task.updated"
		| "task.evidence_added" = "task.created",
): Promise<void> {
	const contents = await readFile(sessionFile, "utf8");
	if (
		!contents.includes('"customType":"pi-tasks:event"') ||
		!contents.includes(`"type":"${eventType}"`)
	) {
		throw new Error(`pi-tasks ${eventType} event was not persisted to JSONL`);
	}
}

function legacyCreatedEvent() {
	return {
		version: 1,
		id: "native-task-created",
		type: "task.created",
		taskId: "T1",
		createdAt: "2026-10-30T00:00:00.000Z",
		source: "tool",
		title: "Native persistence slice",
		objective: "Persist and restore a task without a model call during replay",
		acceptanceCriteria: ["The persisted task state restores"],
		planSteps: [
			{
				text: "Persist task state",
				expectedOutput: "One pi-tasks custom event",
				criterionIds: ["T1-AC1"],
				evidenceRequired: true,
				allowedActions: ["task_update", "task_evidence"],
				decompositionStatus: "atomic",
				granularityCheck: {
					isAtomic: true,
					reason: "Legacy version 1 event fixture",
					canBeDoneInOneAgentAction: true,
					hasSingleObservableOutput: true,
					hasSingleVerificationMethod: true,
					hasNoHiddenSubtasks: true,
				},
			},
		],
		activate: true,
	};
}

function seedLegacyTask(sessionManager: {
	appendMessage(message: unknown): string;
	appendCustomEntry(customType: string, data?: unknown): string;
}): void {
	sessionManager.appendMessage({
		role: "user",
		content: "Seed native replay fixture",
		timestamp: Date.now(),
	});
	sessionManager.appendCustomEntry("pi-tasks:event", legacyCreatedEvent());
}

async function createNativeSession(
	options: {
		base?: string;
		sessionFile?: string;
		tools?: string[];
		excludeTools?: string[];
		foreignTaskNotes?: boolean;
		noTools?: "all" | "builtin";
		seedTask?: boolean;
	} = {},
) {
	const base =
		options.base ?? (await mkdtemp(join(tmpdir(), "pi-tasks-native-")));
	if (!options.base) cleanups.push(base);
	const cwd = join(base, "cwd");
	const agentDir = join(base, "agent");
	const sessionDir = join(base, "sessions");
	await Promise.all([
		mkdir(cwd, { recursive: true }),
		mkdir(agentDir, { recursive: true }),
	]);
	const events: Array<{
		reason?: string;
		widgetId?: string;
		state?: { tasks?: Record<string, { status?: string }> };
	}> = [];
	const extensionPaths = [join(taskRoot, "index.ts")];
	if (options.foreignTaskNotes) {
		const extensionPath = join(base, "foreign-task-notes.js");
		await writeFile(
			extensionPath,
			`export default function (pi) {
	pi.registerTool({
		name: "task_notes",
		label: "Foreign Task Notes",
		description: "Foreign extension task notes.",
		parameters: { type: "object", properties: {}, additionalProperties: false },
		execute: async () => ({ content: [{ type: "text", text: "foreign" }] }),
	});
}`,
		);
		extensionPaths.push(extensionPath);
	}
	const eventBus = sdk.createEventBus();
	eventBus.on(
		"pi-tasks:state",
		(event: {
			reason?: string;
			widgetId?: string;
			state?: { tasks?: Record<string, { status?: string }> };
		}) => {
			events.push(event);
		},
	);
	const settingsManager = sdk.SettingsManager.inMemory({});
	const resourceLoader = new sdk.DefaultResourceLoader({
		cwd,
		agentDir,
		settingsManager,
		eventBus,
		additionalExtensionPaths: extensionPaths,
	});
	await resourceLoader.reload();
	expect(resourceLoader.getExtensions().errors).toEqual([]);
	const sessionManager = options.sessionFile
		? sdk.SessionManager.open(options.sessionFile, sessionDir)
		: sdk.SessionManager.create(cwd, sessionDir);
	if (options.seedTask) {
		seedLegacyTask(sessionManager);
	}
	const result = await sdk.createAgentSession({
		cwd,
		agentDir,
		resourceLoader,
		sessionManager,
		...(options.tools ? { tools: options.tools } : {}),
		...(options.excludeTools ? { excludeTools: options.excludeTools } : {}),
		...(options.noTools ? { noTools: options.noTools } : {}),
	});
	await result.session.bindExtensions(result.extensionsResult);
	return { ...result, base, cwd, sessionDir, events, sessionManager };
}

describe("native Pi dynamic task tools", () => {
	it("replays a persisted legacy task through branch navigation and a new session", async () => {
		const first = await createNativeSession();
		try {
			expect(activeTaskTools(first.session)).toEqual([
				"task_plan",
				"task_resume",
			]);
			const fresh = toolSurface(first.session);
			seedLegacyTask(first.sessionManager);
			const taskEntry = first.sessionManager.getEntries().at(-1);
			const precedingEntry = first.sessionManager.getEntries().at(-2);
			assert.ok(taskEntry);
			assert.ok(precedingEntry);
			await first.session.navigateTree(precedingEntry.id, { summarize: false });
			expect(first.events).toContainEqual(
				expect.objectContaining({
					reason: "session_tree",
					widgetId: "pi-tasks",
				}),
			);
			expect(activeTaskTools(first.session)).toEqual([
				"task_plan",
				"task_resume",
			]);
			await first.session.navigateTree(taskEntry.id, { summarize: false });
			expect(activeTaskTools(first.session)).toContain("task_update");
			expect(
				first.session.agent.state.tools.some(
					(tool: { name: string }) => tool.name === "read",
				),
			).toBe(true);
			const active = toolSurface(first.session);
			expect(active.schemaAndDescriptionChars).toBeGreaterThan(
				fresh.schemaAndDescriptionChars,
			);
			console.info(
				`pi-tasks surface chars fresh schema+description=${fresh.schemaAndDescriptionChars}, system-prompt=${fresh.systemPromptChars}; active schema+description=${active.schemaAndDescriptionChars}, system-prompt=${active.systemPromptChars}`,
			);

			const sessionFile = first.sessionManager.getSessionFile();
			assert.ok(sessionFile);
			await waitForPersistedTaskEvent(sessionFile);
			first.session.dispose();
			const restored = await createNativeSession({
				base: first.base,
				sessionFile,
			});
			try {
				expect(activeTaskTools(restored.session)).toContain("task_update");
				expect(restored.events).toContainEqual(
					expect.objectContaining({
						reason: "session_start",
						widgetId: "pi-tasks",
					}),
				);
			} finally {
				restored.session.dispose();
			}
		} finally {
			first.session.dispose();
		}
	});

	it("enforces task_evidence text limits through the native Pi validator", async () => {
		const active = await createNativeSession({ seedTask: true });
		try {
			const evidence = requireTool(active.session, "task_evidence");
			const argumentsAtBoundary = {
				task_id: "T1",
				type: "test",
				level: "unit_test",
				summary: "native validator accepted the evidence boundary",
				passed: "true",
				references: ["npm test"],
				step_ids: ["T1-S1"],
				quality: {
					source: "native validator",
					reproducible: true,
					verifier: "tool",
					command: "x".repeat(300),
					artifactRefs: ["npm test"],
					observedOutput: "Tests 1 passed (1)",
				},
			};

			expect(
				piAi.validateToolArguments(evidence, {
					name: "task_evidence",
					arguments: argumentsAtBoundary,
				}),
			).toMatchObject(argumentsAtBoundary);
			expect(() =>
				piAi.validateToolArguments(evidence, {
					name: "task_evidence",
					arguments: {
						...argumentsAtBoundary,
						quality: {
							...argumentsAtBoundary.quality,
							command: "x".repeat(301),
						},
					},
				}),
			).toThrow(/quality\.command.*300/);
		} finally {
			active.session.dispose();
		}
	});

	it("returns a native-valid evidence retry and restores the corrected evidence", async () => {
		const active = await createNativeSession({ seedTask: true });
		try {
			const evidence = requireTool(active.session, "task_evidence");
			const persistedBefore = active.sessionManager
				.getEntries()
				.filter(
					(entry: { type: string; customType?: string }) =>
						entry.type === "custom" && entry.customType === "pi-tasks:event",
				).length;
			const rejected = await evidence.execute(
				"native-evidence-rejected",
				{
					task_id: "T1",
					type: "test",
					level: "not_verified",
					summary: "test run reported 7 passed",
					passed: "true",
					references: ["npm test"],
					step_ids: ["T1-S1"],
					quality: {
						source: "native test fixture",
						reproducible: true,
						verifier: "tool",
						command: "npm test",
						artifactRefs: ["npm test"],
						observedOutput: "Tests 7 passed (7)",
					},
				},
				undefined,
				undefined,
			);
			expect(rejected.isError).toBe(true);
			expect(rejected.details).toMatchObject({
				retry_example: {
					type: "test",
					quality: {
						command: "npm test",
					},
				},
			});
			expect(
				active.sessionManager
					.getEntries()
					.filter(
						(entry: { type: string; customType?: string }) =>
							entry.type === "custom" && entry.customType === "pi-tasks:event",
					),
			).toHaveLength(persistedBefore);

			assert.ok(rejected.details && typeof rejected.details === "object");
			assert.ok("retry_example" in rejected.details);
			const retryExample = rejected.details.retry_example;
			assert.ok(retryExample && typeof retryExample === "object");
			const correctedParams = {
				...(retryExample as Record<string, unknown>),
				level: "unit_test",
				passed: "false",
			};
			expect(
				piAi.validateToolArguments(evidence, {
					name: "task_evidence",
					arguments: correctedParams,
				}),
			).toMatchObject(correctedParams);
			const corrected = await evidence.execute(
				"native-evidence-corrected",
				correctedParams,
				undefined,
				undefined,
			);
			expect(corrected.isError).not.toBe(true);
			const sessionFile = active.sessionManager.getSessionFile();
			assert.ok(sessionFile);
			await waitForPersistedTaskEvent(sessionFile, "task.evidence_added");

			active.session.dispose();
			const restored = await createNativeSession({
				base: active.base,
				sessionFile,
			});
			try {
				const listed = await requireTool(restored.session, "task_list").execute(
					"native-evidence-list",
					{ include_evidence: true },
					undefined,
					undefined,
				);
				expect(listed.content[0]?.text).toContain("test run reported 7 passed");
			} finally {
				restored.session.dispose();
			}
		} finally {
			active.session.dispose();
		}
	});

	it("persists only corrected native scope updates after targeted recovery", async () => {
		const active = await createNativeSession({ seedTask: true });
		try {
			const update = requireTool(active.session, "task_update");
			const persistedBefore = active.sessionManager
				.getEntries()
				.filter(
					(entry: { type: string; customType?: string }) =>
						entry.type === "custom" && entry.customType === "pi-tasks:event",
				).length;

			const rejected = await update.execute(
				"native-scope-rejected",
				{ task_id: "T1", scope: "within_step" },
				undefined,
				undefined,
			);
			expect(rejected.isError).toBe(true);
			expect(rejected.content[0]?.text).toContain("retry_with: task_update");
			expect(rejected.details).toMatchObject({
				retry_with: "task_update",
				minimum_params: {
					activity: "<meaningful activity performed>",
					scope: "within_step",
				},
			});
			expect(
				active.sessionManager
					.getEntries()
					.filter(
						(entry: { type: string; customType?: string }) =>
							entry.type === "custom" && entry.customType === "pi-tasks:event",
					),
			).toHaveLength(persistedBefore);

			const corrected = await update.execute(
				"native-scope-corrected",
				{
					task_id: "T1",
					activity: "Inspected the current fixture",
					scope: "within_step",
				},
				undefined,
				undefined,
			);
			expect(corrected.isError).not.toBe(true);
			const sessionFile = active.sessionManager.getSessionFile();
			assert.ok(sessionFile);
			await waitForPersistedTaskEvent(sessionFile, "task.updated");
			expect(
				active.sessionManager
					.getEntries()
					.filter(
						(entry: { type: string; customType?: string }) =>
							entry.type === "custom" && entry.customType === "pi-tasks:event",
					),
			).toHaveLength(persistedBefore + 1);
		} finally {
			active.session.dispose();
		}
	});

	it("keeps foreign task_notes outside pi-tasks reconciliation", async () => {
		const active = await createNativeSession({
			foreignTaskNotes: true,
			seedTask: true,
		});
		try {
			expect(isToolActive(active.session, "task_notes")).toBe(true);
			await requireTool(active.session, "task_resume").execute(
				"foreign-active-resume",
				{},
				undefined,
				undefined,
			);
			expect(isToolActive(active.session, "task_notes")).toBe(true);
			const taskEntry = active.sessionManager.getEntries().at(-1);
			assert.ok(taskEntry);
			await active.session.navigateTree(taskEntry.id, { summarize: false });
			expect(isToolActive(active.session, "task_notes")).toBe(true);
		} finally {
			active.session.dispose();
		}

		const inactive = await createNativeSession({
			foreignTaskNotes: true,
			tools: ["read", "task_plan", "task_resume"],
			seedTask: true,
		});
		try {
			expect(isToolActive(inactive.session, "task_notes")).toBe(false);
			await requireTool(inactive.session, "task_resume").execute(
				"foreign-inactive-resume",
				{},
				undefined,
				undefined,
			);
			expect(isToolActive(inactive.session, "task_notes")).toBe(false);
			const taskEntry = inactive.sessionManager.getEntries().at(-1);
			assert.ok(taskEntry);
			await inactive.session.navigateTree(taskEntry.id, { summarize: false });
			expect(isToolActive(inactive.session, "task_notes")).toBe(false);
		} finally {
			inactive.session.dispose();
		}
	});

	it("preserves allowlists, exclusions, noTools, and unrelated active tools", async () => {
		const planOnly = await createNativeSession({
			tools: ["read", "task_plan"],
			seedTask: true,
		});
		try {
			expect(activeTaskTools(planOnly.session)).toEqual(["task_plan"]);
			expect(
				planOnly.session.agent.state.tools.some(
					(tool: { name: string }) => tool.name === "read",
				),
			).toBe(true);
		} finally {
			planOnly.session.dispose();
		}

		const excluded = await createNativeSession({
			tools: ["read", "task_plan", "task_resume", "task_update"],
			excludeTools: ["task_update"],
			seedTask: true,
		});
		try {
			expect(activeTaskTools(excluded.session)).toEqual([
				"task_plan",
				"task_resume",
			]);
			expect(
				excluded.session.agent.state.tools.some(
					(tool: { name: string }) => tool.name === "read",
				),
			).toBe(true);
		} finally {
			excluded.session.dispose();
		}

		const disabled = await createNativeSession({ noTools: "all" });
		try {
			expect(activeTaskTools(disabled.session)).toEqual([]);
		} finally {
			disabled.session.dispose();
		}
	});

	it("does not activate controls after a rejected plan and restores blocked task controls", async () => {
		const rejected = await createNativeSession();
		try {
			const result = await requireTool(rejected.session, "task_plan").execute(
				"rejected",
				{
					title: "Rejected plan",
					objective: "Verify rejected persistence does not activate controls",
					acceptance_criteria: ["No controls activate"],
					plan_steps: [],
				},
				undefined,
				undefined,
			);
			expect(result.isError).toBe(true);
			expect(activeTaskTools(rejected.session)).toEqual([
				"task_plan",
				"task_resume",
			]);
		} finally {
			rejected.session.dispose();
		}

		const first = await createNativeSession({ seedTask: true });
		try {
			const blocked = await requireTool(first.session, "task_update").execute(
				"blocked-update",
				{
					task_id: "T1",
					status: "blocked",
					blocker: {
						reason: "Waiting for a required decision",
						blockedBy: "user",
						neededToUnblock: "User decision",
					},
				},
				undefined,
				undefined,
			);
			expect(blocked.isError).not.toBe(true);
			const sessionFile = first.sessionManager.getSessionFile();
			assert.ok(sessionFile);
			await waitForPersistedTaskEvent(sessionFile, "task.updated");
			first.session.dispose();
			const restored = await createNativeSession({
				base: first.base,
				sessionFile,
			});
			try {
				expect(activeTaskTools(restored.session)).toContain("task_resume");
				expect(activeTaskTools(restored.session)).toContain("task_update");
				expect(restored.events).toContainEqual(
					expect.objectContaining({
						reason: "session_start",
						state: expect.objectContaining({
							tasks: expect.objectContaining({
								T1: expect.objectContaining({ status: "blocked" }),
							}),
						}),
					}),
				);
			} finally {
				restored.session.dispose();
			}
		} finally {
			first.session.dispose();
		}
	});
});
