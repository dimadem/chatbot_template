import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import * as Effect from "effect/Effect";
import * as Sentry from "@sentry/nextjs";
import { chatAgentEffect, type AgentResult } from "@/entities/agent/agents/chat-agent";

export const maxDuration = 30;

// Извлекает текст из последнего сообщения пользователя
const extractUserText = (messages: UIMessage[]): string => {
	const lastMessage = messages[messages.length - 1];
	const textPart = lastMessage?.parts?.find(part => part.type === 'text');
	return textPart?.text?.substring(0, 200) || "no content";
};

// Создает атрибуты для Sentry span
const createSpanAttributes = (
	messages: UIMessage[], 
	userText: string, 
	agentResult: AgentResult, 
	aiResponse?: string
) => ({
 // Группа: Chat Flow
    "chat.user": userText,
    
    // Группа: Agent
    "agent.intent": agentResult.intent,
    "model.temperature": agentResult.parameters.temperature,
    "chat.system_prompt": agentResult.systemPrompt.substring(0, 200),

    // Группа: AI Response
    ...(aiResponse && {
        "chat.assistant": aiResponse.substring(0, 200),
    }),
});

export async function POST(req: Request) {
	const { messages }: { messages: UIMessage[] } = await req.json();
	const modelMessages = convertToModelMessages(messages);

	const span = Sentry.startInactiveSpan({
		name: "chat-request",
		op: "ai.chat",
	});

	try {
		// Обработка агентом
		const agentResult = await Effect.runPromise(chatAgentEffect(modelMessages));
		const userText = extractUserText(messages);

		// Стриминг с OpenAI
		const result = await streamText({
			model: openai("gpt-4.1"),
			system: agentResult.systemPrompt,
			messages: agentResult.enhancedMessages,
			...agentResult.parameters,
			onFinish({ text }) {
				span.setAttributes(createSpanAttributes(messages, userText, agentResult, text));
				span.end();
			},
		});

		return result.toUIMessageStreamResponse();
	} catch (error) {
		Sentry.captureException(error);
		span.end();
		throw error;
	}
}
