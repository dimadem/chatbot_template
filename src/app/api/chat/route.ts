import { openai } from "@ai-sdk/openai";
import {
	convertToModelMessages,
	type StreamTextResult,
	streamText,
	type UIMessage,
} from "ai";
import * as Effect from "effect/Effect";
import { chatAgentEffect } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

// Constants
const MODEL_ID = "gpt-4.1" as const;

// Narrowly typed text part and safe extraction without truncation
type UITextPart = { type: "text"; text: string };
const isUITextPart = (p: unknown): p is UITextPart => {
	if (!p || typeof p !== "object") return false;
	const part = p as Partial<UITextPart>;
	return part.type === "text" && typeof part.text === "string";
};

const extractUserText = (messages: UIMessage[]): string => {
	if (!Array.isArray(messages) || messages.length === 0) return "no content";
	const last = messages[messages.length - 1];
	const parts = last?.parts as UIMessage["parts"] | undefined;
	if (!Array.isArray(parts)) return "no content";
	const textPart = parts.find(isUITextPart);
	return textPart?.text ?? "no content";
};

// Effect-based обработка всего API route
const processChatRequest = (messages: UIMessage[]) =>
	Effect.gen(function* (_) {
		const userText = extractUserText(messages);
		const modelMessages = convertToModelMessages(messages);

		// Обработка агентом (встроенный трейсинг внутри)
		const agentResult = yield* _(chatAgentEffect(modelMessages));

		// AI стриминг с трейсингом
		return yield* _(
			Effect.sync(() =>
				streamText({
					model: openai(MODEL_ID),
					system: agentResult.systemPrompt,
					messages: agentResult.enhancedMessages,
					...agentResult.parameters,
					onFinish({ text, usage }) {
						Effect.runSync(
							Effect.logInfo("AI streaming completed", {
								responseLength: text.length,
								tokensUsed: usage?.totalTokens ?? 0,
								intent: agentResult.intent,
								temperature: agentResult.parameters.temperature,
							}),
						);
					},
				}),
			).pipe(
				Effect.withSpan("ai.stream-text", {
					attributes: {
						"ai.model": MODEL_ID,
						"ai.temperature": agentResult.parameters.temperature,
						"ai.system_prompt_length": agentResult.systemPrompt.length,
						"ai.messages_count": agentResult.enhancedMessages.length,
						"agent.intent": agentResult.intent,
						"agent.context_used": agentResult.metadata.contextUsed,
						"user.input_preview": userText,
						"user.input_length": userText.length,
						"request.messages_count": messages.length,
					},
				}),
			),
		);
	}).pipe(
		// Общий span для всего API запроса
		Effect.withSpan("api.chat-request", {
			attributes: {
				"api.endpoint": "/api/chat",
				"api.method": "POST",
				"request.messages_count": messages.length,
				"request.user_preview": extractUserText(messages),
			},
		}),
	);

export async function POST(req: Request) {
	try {
		const { messages }: { messages: UIMessage[] } = await req.json();
		const result = await Effect.runPromise(processChatRequest(messages));
		return (
			result as unknown as StreamTextResult<never, never>
		).toUIMessageStreamResponse();
	} catch (error) {
		await Effect.runPromise(
			Effect.logError("Chat API request failed", error).pipe(
				Effect.withSpan("api.chat-error", {
					attributes: {
						"error.type": (error as Error).constructor.name,
						"error.message": String(error),
					},
				}),
			),
		);
		throw error;
	}
}
