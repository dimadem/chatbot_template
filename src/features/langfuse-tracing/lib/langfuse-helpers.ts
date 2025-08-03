import type { ModelMessage } from "ai";
import { Effect } from "effect";
import { LangfuseService, type LangfuseTrace } from "./langfuse-effect";

export type ChatRequestParams = {
	modelId: string;
	enhancedMessages: ModelMessage[];
	intent: string;
};

export type ChatResultParams = {
	text: string;
	finishReason?: string;
	usage?: {
		inputTokens?: number | undefined;
		outputTokens?: number | undefined;
		totalTokens?: number | undefined;
	};
};

// Effect wrapper for the entire chat flow using Langfuse SDK
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
			yield* trace.update({
				output: null,
				metadata: { error: String(error) },
			});
			yield* langfuse.flush();
			throw error;
		}
	});

// Helper to create a generation within a trace
export const createChatGeneration = (
	trace: LangfuseTrace,
	params: ChatRequestParams,
) =>
	trace.generation({
		name: "chat-completion",
		model: params.modelId,
		input: params.enhancedMessages,
	});

// Helper to update generation with result
export const updateChatGeneration = (
	generation: {
		update: (params: { output?: unknown; usage?: unknown }) => void;
	},
	result: ChatResultParams,
) =>
	generation.update({
		output: result.text,
		usage: {
			inputTokens: result.usage?.inputTokens,
			outputTokens: result.usage?.outputTokens,
			totalTokens: result.usage?.totalTokens,
		},
	});

// Complete chat tracing helper
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

		console.log("🚀 Starting chat trace with Langfuse SDK");

		try {
			const result = yield* effect(trace);
			yield* langfuse.flush();
			console.log("✅ Chat trace completed successfully");
			return result;
		} catch (error) {
			yield* trace.update({
				metadata: { error: String(error) },
			});
			yield* langfuse.flush();
			console.error("❌ Chat trace failed:", error);
			throw error;
		}
	});
