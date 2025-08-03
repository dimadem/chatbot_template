import { openai } from "@ai-sdk/openai";
import {
	convertToModelMessages,
	type ModelMessage,
	streamText,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";
import {
	createVercelChatTrace,
	LangfuseLayer,
	mapVercelUsageToLangfuse,
	withLangfuseVercelFlush,
} from "@/features/langfuse-tracing";

export const maxDuration = 30;

const MODEL_ID = "gpt-4.1" as const;

function processChatRequest(messages: readonly ModelMessage[]) {
	return withLangfuseVercelFlush(
		Effect.gen(function* () {
			// Create trace with Vercel optimization
			const trace = yield* createVercelChatTrace(
				"chat-request",
				{ messages: messages.slice(-10) }, // Last 10 messages for context
				{
					model: MODEL_ID,
					environment: "development",
					userId: "anonymous", // Could be extracted from request headers
				},
			);

			const chatAgentResult = yield* chatAgentEffect(messages);

			// Create generation for the LLM call
			const generation = yield* trace.generation({
				name: "chat-completion",
				model: MODEL_ID,
				input: chatAgentResult.enhancedMessages,
			});

			// Use regular streamText
			const result = streamText({
				model: openai(MODEL_ID),
				messages: chatAgentResult.enhancedMessages,
				temperature: chatAgentResult.parameters.temperature,
				onFinish: (event) => {
					// Update generation with result
					Effect.runSync(
						generation.update({
							output: event.text,
							usage: mapVercelUsageToLangfuse(event.usage),
						}),
					);
				},
			});

			return result;
		}),
	);
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		const { messages }: { messages: UIMessage[] } = body;

		if (!messages || !Array.isArray(messages)) {
			throw new Error("Messages must be an array");
		}

		const modelMessages: ModelMessage[] = convertToModelMessages(messages);

		// Run Effect with Langfuse layer
		const result = await Effect.runPromise(
			processChatRequest(modelMessages).pipe(Effect.provide(LangfuseLayer)),
		);

		return result.toUIMessageStreamResponse();
	} catch (_error) {
		return new Response(JSON.stringify({ error: "Internal server error" }), {
			status: 500,
			headers: { "Content-Type": "application/json" },
		});
	}
}
