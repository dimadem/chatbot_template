import { openai } from "@ai-sdk/openai";
import { type Span, SpanStatusCode, trace } from "@opentelemetry/api";
import {
	convertToModelMessages,
	type ModelMessage,
	type StreamTextResult,
	streamText,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

const MODEL_ID = "gpt-4.1" as const;
const TRACER_NAME = "ai" as const;
const TRACER_VERSION = "1.0.0" as const;
const SPAN_NAME = "chat" as const;

function processChatRequest(
	messages: readonly ModelMessage[],
	parentSpan: Span,
) {
	return Effect.gen(function* () {
		const chatAgentResult = yield* chatAgentEffect(messages);

		// Устанавливаем атрибуты для Langfuse
		parentSpan.setAttributes({
			"langfuse.observation.input": JSON.stringify(
				chatAgentResult.enhancedMessages,
			),
			"langfuse.observation.model.name": MODEL_ID,
		});

		const result = streamText({
			model: openai(MODEL_ID),
			messages: chatAgentResult.enhancedMessages,
			temperature: 0.7,
			onFinish: ({ text, finishReason, usage }) => {
				// Устанавливаем финальные атрибуты
				parentSpan.setAttributes({
					"langfuse.observation.output": text,
					"gen_ai.response.finish_reason": finishReason || "stop",
					"gen_ai.usage.input_tokens": usage?.inputTokens || 0,
					"gen_ai.usage.output_tokens": usage?.outputTokens || 0,
					"gen_ai.usage.total_tokens": usage?.totalTokens || 0,
				});

				parentSpan.setStatus({ code: SpanStatusCode.OK }); // SUCCESS
				parentSpan.end();
			},
		});

		return result;
	});
}

export async function POST(req: Request) {
	const tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);

	return tracer.startActiveSpan(SPAN_NAME, { root: true }, async (span) => {
		try {
			const body = await req.json();
			const { messages }: { messages: UIMessage[] } = body;

			if (!messages || !Array.isArray(messages)) {
				throw new Error("Messages must be an array");
			}

			// Используем стандартную функцию конвертации из AI SDK
			const modelMessages: ModelMessage[] = convertToModelMessages(messages);

			// Устанавливаем базовые атрибуты трейса
			span.setAttributes({
				"langfuse.trace.name": "chat-request",
				"langfuse.trace.tags": JSON.stringify(["api", "chat"]),
				"gen_ai.request.model": MODEL_ID,
				"gen_ai.operation.name": "chat",
				"gen_ai.system": "openai",
			});

			const result = await Effect.runPromise(
				processChatRequest(modelMessages, span),
			);

			return (
				result as unknown as StreamTextResult<never, never>
			).toUIMessageStreamResponse();
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			span.recordException(error as Error);
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: errorMessage,
			});
			span.end();

			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	});
}
