import type { ModelMessage } from "ai";
import { Effect } from "effect";
import type { VercelUsage } from "../model/types";
import { LangfuseService, type LangfuseTrace } from "./langfuse-effect";

export type ChatRequestParams = {
	modelId: string;
	enhancedMessages: ModelMessage[];
	intent: string;
};

export type ChatResultParams = {
	text: string;
	finishReason?: string;
	usage?: VercelUsage;
};

// Simple trace wrapper
export const withLangfuseTrace = <R, E, A>(
	name: string,
	effect: Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | LangfuseService> =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const trace = yield* langfuse.createTrace(name);

		try {
			const result = yield* effect;
			yield* trace.update({ output: result });
			yield* langfuse.flush();
			return result;
		} catch (error) {
			yield* trace.update({ output: null, metadata: { error: String(error) } });
			yield* langfuse.flush();
			throw error;
		}
	});

// Simple chat trace
export const withChatTrace = <R, E, A>(
	modelId: string,
	effect: (trace: LangfuseTrace) => Effect.Effect<A, E, R>,
): Effect.Effect<A, E, R | LangfuseService> =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const trace = yield* langfuse.createTrace("chat-request", {
			model: modelId,
			timestamp: new Date().toISOString(),
		});

		try {
			const result = yield* effect(trace);
			yield* langfuse.flush();
			return result;
		} catch (error) {
			yield* trace.update({ metadata: { error: String(error) } });
			yield* langfuse.flush();
			throw error;
		}
	});

// Simple generation helper
export const createChatGeneration = (
	trace: LangfuseTrace,
	params: ChatRequestParams,
) =>
	trace.generation({
		name: "chat-completion",
		model: params.modelId,
		input: params.enhancedMessages,
	});

// Simple update helper
export const updateChatGeneration = (
	generation: {
		update: (params: {
			output?: unknown;
			usage?: unknown;
		}) => Effect.Effect<void>;
	},
	result: ChatResultParams,
) =>
	generation.update({
		output: result.text,
		usage: result.usage && {
			inputTokens: result.usage.inputTokens,
			outputTokens: result.usage.outputTokens,
			totalTokens: result.usage.totalTokens,
		},
	});
