import type { Schema } from "./schema.ts";
import type { BranchEntry } from "./store.ts";

export interface ModelUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	reasoning?: number;
	totalTokens: number;
	cost: {
		input: number;
		output: number;
		cacheRead: number;
		cacheWrite: number;
		total: number;
	};
}

export interface ModelDescriptor {
	id: string;
	provider: string;
}

export interface ClassifierModelDescriptor extends ModelDescriptor {
	type: "classifier";
}

export type ClassifierQuestion =
	| {
			type: "choice";
			instructions: string;
			criteria: Record<string, string>;
	  }
	| {
			type: "bool";
			instructions: string;
			criteria: { true: string; false: string };
	  };

export type ClassifierAnswer =
	| {
			type: "choice";
			choice: string;
			probabilities: Record<string, number>;
			confidence: number;
	  }
	| { type: "bool"; probability: number };

export interface ClassifierResult {
	provider: string;
	model: string;
	answers: Record<string, ClassifierAnswer>;
	usage?: ModelUsage;
	stopReason: "stop" | "error" | "aborted";
	errorMessage?: string;
	timestamp: number;
}

export interface AssistantMessage {
	content: Array<Record<string, unknown> & { type: string }>;
	provider: string;
	model: string;
	usage: ModelUsage;
	stopReason:
		| "pending"
		| "stop"
		| "length"
		| "toolUse"
		| "error"
		| "aborted"
		| "deferred";
	errorMessage?: string;
	timestamp: number;
}

export interface ModelRegistry {
	getAvailableOfType?(
		type: "classifier",
	): Promise<readonly ClassifierModelDescriptor[]>;
	classify?(
		model: ClassifierModelDescriptor,
		context: {
			state: Record<string, unknown>;
			questions: Record<string, ClassifierQuestion>;
		},
		options?: { signal?: AbortSignal; temperature?: number },
	): Promise<ClassifierResult>;
	streamSimple?(
		model: ModelDescriptor,
		context: {
			systemPrompt?: string;
			messages: Array<{
				role: "user";
				content: string;
				timestamp: number;
			}>;
			tools?: Array<{
				name: string;
				description: string;
				parameters: Record<string, unknown>;
				constrainedSampling?: {
					type: "json_schema";
					strict: "prefer" | "require";
				};
			}>;
		},
		options?: {
			signal?: AbortSignal;
			temperature?: number;
			maxTokens?: number;
			toolChoice?: "auto" | "none";
			reasoning?: "off" | "minimal" | "low" | "medium" | "high";
		},
	): { result(): Promise<AssistantMessage> };
}

export interface EphemeralTurnResult {
	replyText: string;
}

export interface EphemeralTurnOptions {
	promptText: string;
	tools: false;
	maxTokens?: number;
	maxContextBytes: number;
	signal?: AbortSignal;
}

export interface ToolResult {
	content: Array<{ type: "text"; text: string }>;
	details?: unknown;
	isError?: boolean;
	usage?: ModelUsage;
}

export interface ToolDefinition<TParams extends Record<string, unknown>> {
	name: string;
	label: string;
	description: string;
	promptSnippet?: string;
	promptGuidelines?: string[];
	parameters: Schema;
	execute(
		toolCallId: string,
		params: TParams,
		signal: AbortSignal | undefined,
		onUpdate: unknown,
		ctx: ExtensionContext,
	): Promise<ToolResult>;
}

export interface RegisteredCommand {
	description: string;
	handler(args: string, ctx: ExtensionContext): Promise<void> | void;
}

export interface ExtensionAPI {
	events: {
		emit<T = unknown>(event: string, data: T): void;
	};
	on(
		event: "session_start" | "session_tree",
		handler: (event: unknown, ctx: ExtensionContext) => Promise<void> | void,
	): void;
	on(
		event: "session_before_compact",
		handler: (event: unknown, ctx: ExtensionContext) => Promise<void> | void,
	): void;
	registerTool<TParams extends Record<string, unknown>>(
		tool: ToolDefinition<TParams>,
	): void;
	registerCommand(name: string, options: RegisteredCommand): void;
	appendEntry<T = unknown>(customType: string, data?: T): void;
	getActiveTools?(): string[];
	getAllTools?(): Array<{ name: string }>;
	setActiveTools?(names: string[]): void;
}

export interface ExtensionContext {
	sessionManager: {
		getBranch(): BranchEntry[];
	};
	ui: {
		notify(message: string, type?: "info" | "warning" | "error"): void;
		setStatus(key: string, text: string | undefined): void;
		setWidget(
			key: string,
			content: string[] | undefined,
			options?: { placement?: "aboveEditor" | "belowEditor" },
		): void;
	};
	modelRegistry?: ModelRegistry;
	model?: ModelDescriptor;
	signal?: AbortSignal;
	runEphemeralTurn?(
		options: EphemeralTurnOptions,
	): Promise<EphemeralTurnResult>;
}
