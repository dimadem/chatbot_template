import type { ModelMessage } from "ai";
import * as Effect from "effect/Effect";

interface TextPart {
	type: "text";
	text: string;
}

type Intent = "help_request" | "order_inquiry" | "general_chat";

export interface AgentResult {
	readonly systemPrompt: string;
	readonly enhancedMessages: ModelMessage[];
	readonly parameters: { readonly temperature: number };
	readonly intent: Intent;
	readonly metadata: {
		readonly contextUsed: boolean;
		readonly processingTimeMs: number;
	};
}

const DEFAULT_PROMPT = "You are a helpful assistant." as const;
const DEFAULT_PARAMS = { temperature: 0.7 } as const;

const STRATEGIES: Readonly<
	Record<
		Intent,
		{
			readonly systemPrompt: string;
			readonly parameters: { readonly temperature: number };
		}
	>
> = {
	help_request: {
		systemPrompt:
			"You are a technical support assistant. Answer concisely and specifically.",
		parameters: { temperature: 0.3 },
	},
	order_inquiry: {
		systemPrompt: "You are an order assistant. Help with order information.",
		parameters: { temperature: 0.5 },
	},
	general_chat: {
		systemPrompt: "You are a friendly assistant. Communicate casually.",
		parameters: { temperature: 0.8 },
	},
} as const;

const isEmptyInput = (messages: readonly ModelMessage[]) => {
	if (messages.length === 0) return true;

	const lastMessage = messages[messages.length - 1];
	if (!lastMessage?.content) return true;

	const textContent = extractTextFromContent(lastMessage.content);
	return !textContent || textContent.trim().length === 0;
};

const extractTextFromContent = (content: unknown): string => {
	if (typeof content === "string") return content;
	if (Array.isArray(content)) {
		return (content as TextPart[]).reduce(
			(acc, part) =>
				part && part.type === "text" && part.text
					? acc
						? `${acc} ${part.text}`
						: part.text
					: acc,
			"",
		);
	}
	return "";
};

const analyzeUserIntent = (content: string): Effect.Effect<Intent> =>
	Effect.sync(() => {
		const c = content.toLowerCase();
		if (c.includes("help") || c.includes("помощь"))
			return "help_request" as const;
		if (c.includes("order") || c.includes("заказ"))
			return "order_inquiry" as const;
		return "general_chat" as const;
	}).pipe(
		Effect.withSpan("agent.analyze-intent", {
			attributes: {
				"agent.content_length": content.length,
				"agent.content_preview": content.substring(0, 50),
			},
		}),
	);

const selectResponseStrategy = (
	intent: Intent,
): Effect.Effect<(typeof STRATEGIES)[Intent]> =>
	Effect.sync(() => STRATEGIES[intent]).pipe(
		Effect.withSpan("agent.select-strategy", {
			attributes: { "agent.intent": intent },
		}),
	);

const getRelevantContext = (
	messages: readonly ModelMessage[],
	intent: Intent,
): Effect.Effect<{ readonly context: string; readonly used: boolean }> =>
	Effect.sync(() => {
		if (intent === "order_inquiry") {
			return {
				context: "Context: The user has active orders #12345, #67890",
				used: true,
			} as const;
		}
		return { context: "", used: false } as const;
	}).pipe(
		Effect.withSpan("agent.get-context", {
			attributes: {
				"agent.intent": intent,
				"agent.messages_count": messages.length,
			},
		}),
	);

export const chatAgentEffect = (
	messages: readonly ModelMessage[],
): Effect.Effect<AgentResult> =>
	Effect.gen(function* () {
		const startTime = Date.now();

		if (isEmptyInput(messages)) {
			return {
				systemPrompt: DEFAULT_PROMPT,
				enhancedMessages: [...messages], // Create immutable copy
				parameters: { ...DEFAULT_PARAMS },
				intent: "general_chat" as const,
				metadata: {
					contextUsed: false,
					processingTimeMs: Date.now() - startTime,
				},
			} satisfies AgentResult;
		}

		const lastMessageContent = messages[messages.length - 1]?.content ?? "";
		const textContent = extractTextFromContent(lastMessageContent);

		const intent = yield* analyzeUserIntent(textContent);
		const strategy = yield* selectResponseStrategy(intent);
		const contextData = yield* getRelevantContext(messages, intent);

		const enhancedMessages: ModelMessage[] = contextData.used
			? [...messages, { role: "system" as const, content: contextData.context }]
			: [...messages]; // Create immutable copy

		return {
			systemPrompt: strategy.systemPrompt,
			enhancedMessages,
			parameters: strategy.parameters,
			intent,
			metadata: {
				contextUsed: contextData.used,
				processingTimeMs: Date.now() - startTime,
			},
		} satisfies AgentResult;
	}).pipe(
		Effect.withSpan("agent.chat-processing", {
			attributes: {
				"agent.input_messages_count": messages.length,
				"agent.last_message_role":
					messages[messages.length - 1]?.role ?? "unknown",
			},
		}),
	);
