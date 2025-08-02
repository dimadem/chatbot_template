import type { ModelMessage } from "ai";
import * as Effect from "effect/Effect";

// Types
interface TextPart {
	type: "text";
	text: string;
}

type Intent = "help_request" | "order_inquiry" | "general_chat";

export interface AgentResult {
	systemPrompt: string;
	enhancedMessages: ModelMessage[];
	parameters: { temperature: number };
	intent: Intent;
	metadata: {
		contextUsed: boolean;
		processingTimeMs: number;
	};
}

// Constants
const DEFAULT_PROMPT = "You are a helpful assistant." as const;
const DEFAULT_PARAMS = { temperature: 0.7 } as const;

const STRATEGIES: Record<
	Intent,
	{ systemPrompt: string; parameters: { temperature: number } }
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
};

// Utils
const isEmptyInput = (messages: ModelMessage[]) =>
	messages.length === 0 || !messages[messages.length - 1]?.content;

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

// Intent analysis with tracing
const analyzeUserIntent = (content: string) =>
	Effect.sync(() => {
		const c = content.toLowerCase();
		if (c.includes("help") || c.includes("помощь"))
			return "help_request" as Intent;
		if (c.includes("order") || c.includes("заказ"))
			return "order_inquiry" as Intent;
		return "general_chat" as Intent;
	}).pipe(
		Effect.withSpan("agent.analyze-intent", {
			attributes: {
				"agent.operation": "intent_analysis",
				"agent.content_length": content.length,
				"agent.content_preview": content.substring(0, 100),
			},
		}),
	);

// Strategy selection with tracing
const selectResponseStrategy = (intent: Intent) =>
	Effect.sync(() => STRATEGIES[intent]).pipe(
		Effect.withSpan("agent.select-strategy", {
			attributes: {
				"agent.operation": "strategy_selection",
				"agent.intent": intent,
			},
		}),
	);

// Context retrieval placeholder without emulation, with tracing
const getRelevantContext = (messages: ModelMessage[], intent: Intent) =>
	Effect.sync(() => {
		// Replace with real data source (DB/vector store/API)
		if (intent === "order_inquiry") {
			return {
				context: "Context: The user has active orders #12345, #67890",
				used: true,
			};
		}
		return { context: "", used: false };
	}).pipe(
		Effect.withSpan("agent.get-context", {
			attributes: {
				"agent.operation": "context_retrieval",
				"agent.intent": intent,
				"agent.messages_count": messages.length,
			},
		}),
	);

// Main effect with tracing
export const chatAgentEffect = (messages: ModelMessage[]) =>
	Effect.gen(function* (_) {
		const startTime = Date.now();

		if (isEmptyInput(messages)) {
			return {
				systemPrompt: DEFAULT_PROMPT,
				enhancedMessages: messages,
				parameters: { ...DEFAULT_PARAMS },
				intent: "general_chat",
				metadata: {
					contextUsed: false,
					processingTimeMs: Date.now() - startTime,
				},
			} satisfies AgentResult;
		}

		const lastMessageContent = messages[messages.length - 1]?.content ?? "";
		const textContent = extractTextFromContent(lastMessageContent);

		const intent = yield* _(analyzeUserIntent(textContent));
		const strategy = yield* _(selectResponseStrategy(intent));
		const contextData = yield* _(getRelevantContext(messages, intent));

		const enhancedMessages = contextData.used
			? [...messages, { role: "system" as const, content: contextData.context }]
			: messages;

		return {
			systemPrompt: strategy.systemPrompt,
			enhancedMessages,
			parameters: strategy.parameters,
			intent,
			metadata: {
				contextUsed: contextData.used,
				processingTimeMs: Date.now() - startTime,
			},
		} as AgentResult;
	}).pipe(
		Effect.withSpan("agent.chat-processing", {
			attributes: {
				"agent.operation": "full_processing",
				"agent.input_messages_count": messages.length,
				"agent.last_message_role":
					messages[messages.length - 1]?.role ?? "unknown",
			},
		}),
	);
