import { openai } from "@ai-sdk/openai";
import { trace, type Span } from "@opentelemetry/api";
import {
	convertToModelMessages,
	type ModelMessage,
	type StreamTextResult,
	streamText,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";
import {
	setAttrs,
	endOk,
	endError,
	recordLangfuseRequest,
	recordLangfuseResult,
} from "@/features/langfuse-tracing";

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

		recordLangfuseRequest(
			parentSpan,
			MODEL_ID,
			JSON.stringify(chatAgentResult.enhancedMessages),
		);
		setAttrs(parentSpan, { "agent.route.intent": chatAgentResult.intent });

		const result = streamText({
			model: openai(MODEL_ID),
			messages: chatAgentResult.enhancedMessages,
			temperature: chatAgentResult.parameters.temperature,
			onFinish: ({ text, finishReason, usage }) => {
				recordLangfuseResult(parentSpan, text, usage, finishReason);
				endOk(parentSpan);
			},
		});

		return result;
	});
}

export async function POST(req: Request) {
	const tracer = trace.getTracer(TRACER_NAME, TRACER_VERSION);

	return tracer.startActiveSpan("chat-request", { root: true }, async (span) => {
		setAttrs(span, {
			"langfuse.trace.name": "chat-request",
			"langfuse.trace.tags": JSON.stringify(["api", "chat"]),
			"gen_ai.request.model": MODEL_ID,
			"gen_ai.operation.name": "chat",
			"gen_ai.system": "openai",
		});

		try {
			const body = await req.json();
			const { messages }: { messages: UIMessage[] } = body;

			if (!messages || !Array.isArray(messages)) {
				throw new Error("Messages must be an array");
			}

			const modelMessages: ModelMessage[] = convertToModelMessages(messages);

			const result = await Effect.runPromise(
				processChatRequest(modelMessages, span),
			);

			return (
				result as unknown as StreamTextResult<never, never>
			).toUIMessageStreamResponse();
		} catch (error) {
			endError(span, error);
			return new Response(JSON.stringify({ error: "Internal server error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	});
}
