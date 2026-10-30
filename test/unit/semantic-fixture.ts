import {
	type EvidenceSemanticAssessment,
	type PlanSemanticAssessment,
	type PlanSemanticDecision,
	SEMANTIC_ASSESSMENT_VERSION,
	type StepSemanticAssessment,
	type TaskStepInput,
} from "../../src/model.ts";
import type {
	ClassifierAnswer,
	ExtensionContext,
	ModelUsage,
} from "../../src/pi-types.ts";
import {
	type EvidenceAssessmentInput,
	hashEvidenceAssessmentInput,
	hashPlanAssessmentInput,
	hashStepSemanticInput,
	type PlanAssessmentInput,
	SEMANTIC_PROMPT_VERSION,
} from "../../src/semantic-assessment.ts";

const now = "2026-10-29T00:00:00.000Z";

export const fakeUsage: ModelUsage = {
	input: 100,
	output: 20,
	cacheRead: 0,
	cacheWrite: 0,
	totalTokens: 120,
	cost: {
		input: 0.001,
		output: 0.001,
		cacheRead: 0,
		cacheWrite: 0,
		total: 0.002,
	},
};

export function planAssessment(
	input: PlanAssessmentInput,
	decisions: PlanSemanticDecision[] = input.steps.map(() => "atomic"),
): PlanSemanticAssessment {
	return {
		provenance: {
			version: SEMANTIC_ASSESSMENT_VERSION,
			strategy: "pi_classifier",
			provider: "test",
			model: "semantic-fixture",
			promptVersion: SEMANTIC_PROMPT_VERSION,
			inputHash: hashPlanAssessmentInput(input),
			assessedAt: now,
		},
		steps: input.steps.map((step, index) =>
			stepAssessment(step, index, decisions[index] ?? "atomic"),
		),
	};
}

export function evidenceAssessment(
	input: EvidenceAssessmentInput,
	decision: "supported" | "unsupported" | "uncertain" = "supported",
): EvidenceSemanticAssessment {
	const inputHash = hashEvidenceAssessmentInput(input);
	return {
		provenance: {
			version: SEMANTIC_ASSESSMENT_VERSION,
			strategy: "pi_classifier",
			provider: "test",
			model: "semantic-fixture",
			promptVersion: SEMANTIC_PROMPT_VERSION,
			inputHash,
			assessedAt: now,
		},
		inputHash,
		decision,
		confidence: decision === "uncertain" ? 0.55 : 0.95,
		issues:
			decision === "supported"
				? []
				: decision === "uncertain"
					? ["uncertain"]
					: ["missing_observation"],
	};
}

export function fakeSemanticRuntime(): Pick<
	ExtensionContext,
	"modelRegistry" | "model"
> {
	return {
		model: { id: "semantic-fixture", provider: "test" },
		modelRegistry: {
			async getAvailableOfType() {
				return [
					{
						id: "semantic-fixture",
						provider: "test",
						type: "classifier" as const,
					},
				];
			},
			async classify(_model, context) {
				const answers: Record<string, ClassifierAnswer> = {};
				const taskData = context.state.untrustedTaskData as
					| { title?: string; steps?: TaskStepInput[] }
					| undefined;
				for (const name of Object.keys(context.questions)) {
					if (name === "passing_evidence_supported") {
						answers[name] = { type: "bool", probability: 0.95 };
						continue;
					}
					const index = Number(name.split("_")[1]);
					const text = taskData?.steps?.[index]?.text ?? "";
					const nonAtomic =
						taskData?.title === "Depth recovery" ||
						text === "Implement release workflow";
					const rejected = taskData?.title === "Bad plan";
					if (name.endsWith("_specific")) {
						answers[name] = {
							type: "bool",
							probability: rejected ? 0.05 : 0.95,
						};
					} else if (name.endsWith("_hidden_subtasks")) {
						answers[name] = {
							type: "bool",
							probability: nonAtomic ? 0.95 : 0.05,
						};
					} else {
						const choice = nonAtomic ? "multiple" : "one";
						answers[name] = {
							type: "choice",
							choice,
							confidence: 0.95,
							probabilities: {
								one: nonAtomic ? 0.025 : 0.95,
								multiple: nonAtomic ? 0.95 : 0.025,
								unclear: 0.025,
							},
						};
					}
				}
				return {
					provider: "test",
					model: "semantic-fixture",
					answers,
					usage: fakeUsage,
					stopReason: "stop" as const,
					timestamp: Date.parse(now),
				};
			},
		},
	};
}

function stepAssessment(
	step: TaskStepInput,
	index: number,
	decision: PlanSemanticDecision,
): StepSemanticAssessment {
	const atomic = decision === "atomic";
	const rejected = decision === "rejected";
	return {
		index,
		inputHash: hashStepSemanticInput(step),
		decision,
		specific: { value: !rejected, confidence: 0.95 },
		actionCount: {
			value: rejected ? "unclear" : atomic ? "one" : "multiple",
			confidence: 0.95,
		},
		outputCount: {
			value: rejected ? "unclear" : atomic ? "one" : "multiple",
			confidence: 0.95,
		},
		verificationCount: {
			value: rejected ? "unclear" : atomic ? "one" : "multiple",
			confidence: 0.95,
		},
		hiddenSubtasks: { value: !atomic && !rejected, confidence: 0.95 },
		confidence: 0.95,
		issues:
			decision === "atomic"
				? []
				: decision === "needs_breakdown"
					? [
							"step contains multiple independent actions",
							"step contains multiple independently observable outputs",
							"step requires multiple independent verification methods",
							"step contains hidden subtasks",
						]
					: [
							"step description is not specific enough",
							"independent action count is unclear",
							"observable output count is unclear",
							"verification method count is unclear",
						],
	};
}
