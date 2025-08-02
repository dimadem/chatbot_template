import type { ModelMessage } from "ai";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";

// Types for our agent
export interface AgentResult {
	systemPrompt: string;
	enhancedMessages: ModelMessage[];
	parameters: {
		temperature: number;
	};
}

// Simple intent analysis with logging
const analyzeUserIntent = (content: string) =>
	Effect.gen(function* (_) {
		yield* _(
			Console.log(`Analyzing intent for: ${content.substring(0, 50)}...`),
		);

		// Simple intent analysis logic
		if (content.includes("help") || content.includes("помощь"))
			return "help_request";
		if (content.includes("order") || content.includes("заказ"))
			return "order_inquiry";
		return "general_chat";
	}).pipe(
		Effect.catchAll((error) =>
			Effect.gen(function* (_) {
				yield* _(Console.error("Intent analysis failed:", error));
				return "general_chat";
			}),
		),
	);

// Define system prompts as constants
const SYSTEM_PROMPTS = {
	help_request:
		"You are a technical support assistant. Answer concisely and specifically.",
	order_inquiry: "You are an order assistant. Help with order information.",
	general_chat: "You are a friendly assistant. Communicate casually.",
} as const;

// Response strategies based on intent
const selectResponseStrategy = (intent: string) => {
	const strategies = {
		help_request: {
			systemPrompt: SYSTEM_PROMPTS.help_request,
			parameters: { temperature: 0.3 },
		},
		order_inquiry: {
			systemPrompt: SYSTEM_PROMPTS.order_inquiry,
			parameters: { temperature: 0.5 },
		},
		general_chat: {
			systemPrompt: SYSTEM_PROMPTS.general_chat,
			parameters: { temperature: 0.8 },
		},
	} as const;

	return (
		strategies[intent as keyof typeof strategies] || strategies.general_chat
	);
};

// Get relevant context based on intent
const getRelevantContext = (_messages: ModelMessage[], intent: string) =>
	Effect.gen(function* (_) {
		yield* _(Console.log(`Getting context for intent: ${intent}`));

		// This could be replaced with actual database/API calls
		if (intent === "order_inquiry") {
			return "Context: The user has active orders #12345, #67890";
		}
		return "";
	}).pipe(
		Effect.catchAll((error) =>
			Effect.gen(function* (_) {
				yield* _(Console.error("Context retrieval failed:", error));
				return "";
			}),
		),
	);

// Helper function to extract text from ModelMessage content
const extractTextFromContent = (content: unknown): string => {
	if (typeof content === "string") {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.filter(
				(part) => part && typeof part === "object" && part.type === "text",
			)
			.map((part) => part.text)
			.filter(Boolean)
			.join(" ");
	}

	return "";
};

// Main agent logic
export const chatAgentEffect = (messages: ModelMessage[]) =>
	Effect.gen(function* (_) {
		// Check if we have messages
		if (messages.length === 0) {
			yield* _(
				Console.log("No messages provided, using default configuration"),
			);
			return {
				systemPrompt: "You are a helpful assistant.",
				enhancedMessages: messages,
				parameters: { temperature: 0.7 },
			} as AgentResult;
		}

		const lastMessage = messages[messages.length - 1];

		// Check if lastMessage exists and has content
		if (!lastMessage || !lastMessage.content) {
			yield* _(
				Console.log("Last message has no content, using default configuration"),
			);
			return {
				systemPrompt: "You are a helpful assistant.",
				enhancedMessages: messages,
				parameters: { temperature: 0.7 },
			} as AgentResult;
		}

		// Extract text content from the message
		const textContent = extractTextFromContent(lastMessage.content);

		// Agent logic: analyze user intent
		const intent = yield* _(analyzeUserIntent(textContent));

		// Select response strategy based on intent
		const strategy = selectResponseStrategy(intent);

		// Get additional context
		const context = yield* _(getRelevantContext(messages, intent));

		// Enhance messages with context
		const enhancedMessages = context
			? [...messages, { role: "system" as const, content: context }]
			: messages;

		return {
			systemPrompt: strategy.systemPrompt,
			enhancedMessages: enhancedMessages,
			parameters: strategy.parameters,
		} as AgentResult;
	}).pipe(
		Effect.catchAll((error) =>
			Effect.gen(function* (_) {
				yield* _(Console.error("Agent processing failed:", error));
				return {
					systemPrompt: "You are a helpful assistant.",
					enhancedMessages: messages,
					parameters: { temperature: 0.7 },
				} as AgentResult;
			}),
		),
		Effect.tapErrorCause((cause) => Console.error("Agent error cause:", cause)),
		Effect.timeout("10 seconds"), // Add timeout for safety
	);
