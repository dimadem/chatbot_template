import { openai } from "@ai-sdk/openai";
import { type Span, trace } from "@opentelemetry/api";
import {
	convertToModelMessages,
	type StreamTextResult,
	streamText,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

const MODEL_ID = "gpt-4.1" as const;

function processChatRequest(messages: UIMessage[], parentSpan: Span) {
	return Effect.gen(function* () {
		const chatAgentResult = yield* chatAgentEffect(
			convertToModelMessages(messages),
		);

		// Устанавливаем input сразу после получения результата от агента
		parentSpan.setAttributes({
			"input.value": JSON.stringify(chatAgentResult.enhancedMessages),
			// Дополнительные Langfuse атрибуты
			"langfuse.generation.name": "chat-generation",
			"langfuse.generation.model": MODEL_ID,
		});

		const result = streamText({
			model: openai(MODEL_ID),
			messages: chatAgentResult.enhancedMessages,
			temperature: 0.7,
			onFinish: ({ text, finishReason, usage }) => {
				// Устанавливаем атрибуты для Langfuse Output
				parentSpan.setAttributes({
					// Output для Langfuse
					"output.value": text,

					// GenAI атрибуты для совместимости
					"gen_ai.response.finish_reason": finishReason || "stop",
					"gen_ai.usage.input_tokens": usage?.inputTokens || 0,
					"gen_ai.usage.output_tokens": usage?.outputTokens || 0,
					"gen_ai.usage.total_tokens": usage?.totalTokens || 0,

					// Дополнительные метрики
					"gen_ai.operation.name": "chat",
					"gen_ai.system": "openai",
					"gen_ai.request.model": MODEL_ID,
					"gen_ai.response.model": MODEL_ID,
				});

				// Завершаем span сразу после установки атрибутов
				parentSpan.setStatus({ code: 1 }); // SUCCESS
				parentSpan.end();
			},
		});

		return result;
	});
}

export async function POST(req: Request) {
	const tracer = trace.getTracer("ai", "1.0.0");

	return tracer.startActiveSpan(
		"chat-generation",
		{ root: true },
		async (span) => {
			try {
				const { messages }: { messages: UIMessage[] } = await req.json();
				const modelMessages = convertToModelMessages(messages);

				// Устанавливаем базовые GenAI атрибуты и Langfuse метаданные
				span.setAttributes({
					// Input для Langfuse - показываем пользовательский текст
					"gen_ai.request.model": MODEL_ID,
					"gen_ai.operation.name": "chat",
					"gen_ai.system": "openai",
					"gen_ai.request.messages.count": modelMessages.length,
					// Langfuse атрибуты
					"langfuse.trace.name": "chat-request",
					"langfuse.tags": JSON.stringify(["api", "chat"]),
				});

				const result = await Effect.runPromise(
					processChatRequest(messages, span),
				);

				return (
					result as unknown as StreamTextResult<never, never>
				).toUIMessageStreamResponse();
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: 2, message: String(error) }); // ERROR
				span.end();
				throw error;
			}
			// Span завершается в onFinish callback
		},
	);
}
