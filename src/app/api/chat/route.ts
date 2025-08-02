import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();

	const modelMessages = convertToModelMessages(messages);

	// Run our Effect-based agent with proper error handling
	const agentResult = await Effect.runPromise(
		chatAgentEffect(modelMessages).pipe(
			Effect.tapError((error) => Effect.logError("Agent failed:", error)),
			Effect.catchAll((_error) =>
				Effect.succeed({
					systemPrompt: "You are a helpful assistant.",
					enhancedMessages: modelMessages,
					parameters: { temperature: 0.7 },
				}),
			),
		),
	);

	// Use the agent's output to configure the LLM call
	const result = streamText({
		model: openai("gpt-4.1"),
		system: agentResult.systemPrompt,
		messages: agentResult.enhancedMessages,
		temperature: agentResult.parameters.temperature,
	});

	return result.toUIMessageStreamResponse();
}
