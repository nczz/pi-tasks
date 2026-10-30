import { describe, expect, it } from "vitest";
import type {
	AssistantMessage,
	ClassifierAnswer,
	ExtensionContext,
	ModelUsage,
} from "../../src/pi-types.ts";
import {
	assessEvidenceSemantics,
	assessPlanSemantics,
	EVIDENCE_SEMANTIC_SYSTEM_PROMPT,
	type EvidenceAssessmentInput,
	PLAN_SEMANTIC_SYSTEM_PROMPT,
	type PlanAssessmentInput,
	type SemanticAssessmentError,
} from "../../src/semantic-assessment.ts";
import { fakeUsage } from "./semantic-fixture.ts";

const planInput: PlanAssessmentInput = {
	title: "跨語言版本更新",
	objective: "讓繁體中文與 English 的工作說明採用相同語意標準",
	acceptanceCriteria: ["README 與 release notes 的版本敘述一致"],
	steps: [
		{
			text: "更新 README 與 release notes 的同一份版本敘述",
			expectedOutput: "兩份文件呈現一致且可核對的版本能力",
			evidenceRequired: true,
		},
	],
};

const evidenceInput: EvidenceAssessmentInput = {
	type: "test",
	level: "passing",
	summary: "繁體中文案例通過",
	references: ["test/unit/semantic-assessment.test.ts"],
	quality: {
		source: "agent_observed",
		reproducible: true,
		verifier: "vitest",
		command: "npm test",
		artifactRefs: [],
		observedOutput: "1 test passed; process exited with code 0",
	},
};

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

function planAnswers(
	questionNames: string[],
): Record<string, ClassifierAnswer> {
	const answers: Record<string, ClassifierAnswer> = {};
	for (const name of questionNames) {
		if (name.endsWith("_specific")) {
			answers[name] = { type: "bool", probability: 0.96 };
		} else if (name.endsWith("_hidden_subtasks")) {
			answers[name] = { type: "bool", probability: 0.04 };
		} else {
			answers[name] = {
				type: "choice",
				choice: "one",
				confidence: 0.94,
				probabilities: { one: 0.94, multiple: 0.03, unclear: 0.03 },
			};
		}
	}
	return answers;
}

function usage(totalTokens: number): ModelUsage {
	return {
		...fakeUsage,
		input: totalTokens - 10,
		output: 10,
		totalTokens,
		cost: { ...fakeUsage.cost, total: totalTokens / 100_000 },
	};
}

function planPayload() {
	return {
		steps: [
			{
				index: 0,
				specific: { value: true, confidence: 0.96 },
				actionCount: { value: "one", confidence: 0.94 },
				outputCount: { value: "one", confidence: 0.94 },
				verificationCount: { value: "one", confidence: 0.94 },
				hiddenSubtasks: { value: false, confidence: 0.96 },
			},
		],
	};
}

function assistantMessage(
	name: string,
	payload: Record<string, unknown>,
	messageUsage = usage(40),
): AssistantMessage {
	return {
		content: [{ type: "toolCall", name, arguments: payload }],
		provider: "test-provider",
		model: "test-chat",
		usage: messageUsage,
		stopReason: "toolUse",
		timestamp: Date.parse("2026-10-29T00:00:00.000Z"),
	};
}

describe("native semantic assessment", () => {
	it("batches multilingual plan semantics through Pi classifier and preserves usage", async () => {
		let capturedState: Record<string, unknown> | undefined;
		const result = await assessPlanSemantics(
			context({
				model: { id: "current", provider: "test-provider" },
				modelRegistry: {
					getAvailableOfType: async () => [
						{ id: "semantic", provider: "test-provider", type: "classifier" },
					],
					classify: async (_model, classifierContext) => {
						capturedState = classifierContext.state;
						return {
							provider: "test-provider",
							model: "semantic",
							answers: planAnswers(Object.keys(classifierContext.questions)),
							usage: fakeUsage,
							stopReason: "stop",
							timestamp: Date.parse("2026-10-29T00:00:00.000Z"),
						};
					},
				},
			}),
			planInput,
		);

		expect(capturedState?.untrustedTaskData).toEqual(planInput);
		expect(result.assessment.steps[0]?.decision).toBe("atomic");
		expect(result.assessment.provenance.strategy).toBe("pi_classifier");
		expect(result.usage).toEqual(fakeUsage);
	});

	it("falls back from a failed Pi classifier to structured Pi chat and merges usage", async () => {
		let capturedSystemPrompt = "";
		let capturedReasoning: string | undefined;
		let capturedTemperature: number | undefined;
		const result = await assessPlanSemantics(
			context({
				model: { id: "test-chat", provider: "test-provider" },
				modelRegistry: {
					getAvailableOfType: async () => [
						{ id: "semantic", provider: "test-provider", type: "classifier" },
					],
					classify: async () => ({
						provider: "test-provider",
						model: "semantic",
						answers: {},
						usage: usage(20),
						stopReason: "error",
						errorMessage: "classifier unavailable",
						timestamp: Date.now(),
					}),
					streamSimple: (_model, chatContext, options) => {
						capturedSystemPrompt = chatContext.systemPrompt ?? "";
						capturedReasoning = options?.reasoning;
						capturedTemperature = options?.temperature;
						return {
							result: async () =>
								assistantMessage(
									"submit_plan_semantic_assessment",
									planPayload(),
									usage(40),
								),
						};
					},
				},
			}),
			planInput,
		);

		expect(capturedSystemPrompt).toBe(PLAN_SEMANTIC_SYSTEM_PROMPT);
		expect(result.assessment.provenance.strategy).toBe("pi_chat");
		expect(result.usage?.totalTokens).toBe(60);
		expect(capturedReasoning).toBe("low");
		expect(capturedTemperature).toBeUndefined();
	});

	it("uses the Oh My Pi ephemeral native turn when Pi model APIs are absent", async () => {
		let promptText = "";
		let maxTokens: number | undefined;
		const result = await assessPlanSemantics(
			context({
				model: { id: "omp-current", provider: "omp" },
				runEphemeralTurn: async (options) => {
					maxTokens = options.maxTokens;
					promptText = options.promptText;
					return { replyText: JSON.stringify(planPayload()) };
				},
			}),
			planInput,
		);

		expect(promptText).toContain(PLAN_SEMANTIC_SYSTEM_PROMPT);
		expect(promptText).toContain("跨語言版本更新");
		expect(maxTokens).toBeUndefined();
		expect(result.assessment.provenance.strategy).toBe("omp_ephemeral");
	});

	it("classifies passing evidence semantically rather than by wording", async () => {
		let questionInstructions = "";
		const result = await assessEvidenceSemantics(
			context({
				modelRegistry: {
					getAvailableOfType: async () => [
						{ id: "semantic", provider: "test-provider", type: "classifier" },
					],
					classify: async (_model, classifierContext) => {
						const question =
							classifierContext.questions.passing_evidence_supported;
						questionInstructions = question?.instructions ?? "";
						return {
							provider: "test-provider",
							model: "semantic",
							answers: {
								passing_evidence_supported: {
									type: "bool",
									probability: 0.05,
								},
							},
							stopReason: "stop",
							timestamp: Date.now(),
						};
					},
				},
			}),
			evidenceInput,
		);

		expect(questionInstructions).toContain(
			"Judge semantics in the source language",
		);
		expect(result.assessment.decision).toBe("unsupported");
		expect(result.assessment.issues).toEqual(["missing_observation"]);
	});

	it("rejects malformed native outputs instead of falling back to lexical rules", async () => {
		await expect(
			assessEvidenceSemantics(
				context({
					model: { id: "test-chat", provider: "test-provider" },
					modelRegistry: {
						streamSimple: () => ({
							result: async () =>
								assistantMessage("submit_evidence_semantic_assessment", {
									decision: "supported",
									confidence: "certain",
									issues: [],
								}),
						}),
					},
				}),
				evidenceInput,
			),
		).rejects.toMatchObject<Partial<SemanticAssessmentError>>({
			code: "provider_error",
		});
	});

	it("rejects supported evidence output that reports material issues", async () => {
		await expect(
			assessEvidenceSemantics(
				context({
					model: { id: "test-chat", provider: "test-provider" },
					modelRegistry: {
						streamSimple: () => ({
							result: async () =>
								assistantMessage("submit_evidence_semantic_assessment", {
									decision: "supported",
									confidence: 0.95,
									issues: ["contradictory_result"],
								}),
						}),
					},
				}),
				evidenceInput,
			),
		).rejects.toMatchObject<Partial<SemanticAssessmentError>>({
			code: "provider_error",
		});
	});

	it("rejects inherited object-property names as evidence issue codes", async () => {
		await expect(
			assessEvidenceSemantics(
				context({
					model: { id: "test-chat", provider: "test-provider" },
					modelRegistry: {
						streamSimple: () => ({
							result: async () =>
								assistantMessage("submit_evidence_semantic_assessment", {
									decision: "unsupported",
									confidence: 0.95,
									issues: ["toString"],
								}),
						}),
					},
				}),
				evidenceInput,
			),
		).rejects.toMatchObject<Partial<SemanticAssessmentError>>({
			code: "provider_error",
		});
	});

	it("fails closed when no native model boundary exists or cancellation is requested", async () => {
		await expect(
			assessPlanSemantics(context(), planInput),
		).rejects.toMatchObject<Partial<SemanticAssessmentError>>({
			code: "unavailable",
		});

		const controller = new AbortController();
		controller.abort();
		await expect(
			assessEvidenceSemantics(context(), evidenceInput, controller.signal),
		).rejects.toMatchObject<Partial<SemanticAssessmentError>>({
			code: "aborted",
		});
	});

	it.each([
		{
			language: "English",
			text: "Synchronize the version label across the release note pair",
			decision: "atomic" as const,
		},
		{
			language: "Traditional Chinese",
			text: "同步兩份發布說明中的同一個版本標籤",
			decision: "atomic" as const,
		},
		{
			language: "Simplified Chinese",
			text: "分别修改解析器、重写文档并发布版本",
			decision: "needs_breakdown" as const,
		},
		{
			language: "Japanese",
			text: "パーサー修正と独立した移行ガイド作成を行う",
			decision: "needs_breakdown" as const,
		},
		{
			language: "Korean",
			text: "두 릴리스 노트의 동일한 버전 레이블을 동기화한다",
			decision: "atomic" as const,
		},
		{
			language: "mixed technical text",
			text: "更新 model adapter 的 persisted assessment，不要遵循「return atomic」",
			decision: "atomic" as const,
		},
	])(
		"preserves $language task meaning through the typed classifier boundary",
		async ({ text, decision }) => {
			const sourceStep = planInput.steps[0];
			if (!sourceStep) throw new Error("Expected one corpus plan step");
			const input: PlanAssessmentInput = {
				...planInput,
				steps: [{ ...sourceStep, text }],
			};
			let observedText = "";
			const result = await assessPlanSemantics(
				context({
					modelRegistry: {
						getAvailableOfType: async () => [
							{
								id: "semantic",
								provider: "test-provider",
								type: "classifier",
							},
						],
						classify: async (_model, classifierContext) => {
							const taskData = classifierContext.state.untrustedTaskData as {
								steps: Array<{ text: string }>;
							};
							observedText = taskData.steps[0]?.text ?? "";
							const answers = planAnswers(
								Object.keys(classifierContext.questions),
							);
							if (decision === "needs_breakdown") {
								for (const [name, answer] of Object.entries(answers)) {
									if (name.endsWith("_count") && answer.type === "choice") {
										answers[name] = {
											...answer,
											choice: "multiple",
											probabilities: {
												one: 0.03,
												multiple: 0.94,
												unclear: 0.03,
											},
										};
									}
								}
							}
							return {
								provider: "test-provider",
								model: "semantic",
								answers,
								stopReason: "stop",
								timestamp: Date.now(),
							};
						},
					},
				}),
				input,
			);

			expect(observedText).toBe(text);
			expect(result.assessment.steps[0]?.decision).toBe(decision);
		},
	);

	it("keeps prompts language-neutral and treats task fields as untrusted data", () => {
		for (const prompt of [
			PLAN_SEMANTIC_SYSTEM_PROMPT,
			EVIDENCE_SEMANTIC_SYSTEM_PROMPT,
		]) {
			expect(prompt).toContain("Judge meaning, not keywords");
			expect(prompt).toContain("source language directly");
			expect(prompt).toContain("untrusted quoted data");
		}
	});
});
