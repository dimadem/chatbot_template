import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import * as Effect from "effect/Effect";
import * as Sentry from "@sentry/nextjs";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

export async function POST(req: Request) {
	return await Sentry.startSpan(
		{
			name: "chat-request",
			op: "http.server",
			attributes: {
				"http.method": "POST",
				"http.route": "/api/chat",
			},
		},
		async () => {
			const { messages }: { messages: UIMessage[] } = await req.json();
			const modelMessages = convertToModelMessages(messages);

			// Run our Effect-based agent with proper error handling
			const agentResult = await Sentry.startSpan(
				{
					name: "chat-agent-processing",
					op: "ai.agent",
					attributes: {
						"agent.messages.count": messages.length,
						"agent.last_message_role": modelMessages[modelMessages.length - 1]?.role || "unknown",
					},
				},
				async () => {
					return await Effect.runPromise(
						chatAgentEffect(modelMessages).pipe(
							Effect.tapError((error) => 
								Effect.sync(() => Sentry.captureException(error))
							),
						),
					);
				}
			);

			// Use the agent's output to configure the LLM call
			const result = await Sentry.startSpan(
				{
					name: "openai-stream-call",
					op: "ai.chat_completions.create",
					attributes: {
						"ai.model.name": "gpt-4.1",
						"ai.model.provider": "openai",
						"ai.system_prompt_length": agentResult.systemPrompt.length,
						"ai.messages_count": agentResult.enhancedMessages.length,
						"ai.temperature": agentResult.parameters.temperature,
					},
				},
				async () => {
					return streamText({
						model: openai("gpt-4.1"),
						system: agentResult.systemPrompt,
						messages: agentResult.enhancedMessages,
						...agentResult.parameters,
					});
				}
			);

			return result.toUIMessageStreamResponse();
		}
	);
}
