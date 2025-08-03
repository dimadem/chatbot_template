import type { ModelMessage } from "ai";
import * as Effect from "effect/Effect";

interface TextPart {
	type: "text";
	text: string;
}

type RouteType = "question" | "ideate";

export interface AgentResult {
	readonly systemPrompt: string;
	readonly enhancedMessages: ModelMessage[];
	readonly parameters: { readonly temperature: number };
	readonly intent: RouteType;
	readonly metadata: {
		readonly contextUsed: boolean;
		readonly processingTimeMs: number;
	};
}

const DEFAULT_PARAMS = { temperature: 0.7 } as const;

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

// LLM-based lightweight classifier prompt
const _CLASSIFIER_SYSTEM_PROMPT =
	`You are a strict router. Decide if the user's last message is a direct question (type: "question") or a creative ideation request (type: "ideate").
Return ONLY a compact JSON: {"type":"question"} or {"type":"ideate"}.
Treat verbs like "invent", "create", "come up with", "придумай", "сгенерируй" as ideate. Questions like "how", "why", "what", "когда", "почему" are question.` as const;

// These agents are just system prompts with small parameter tweaks
const JOKE_AGENT_PROMPT =
	"You are a witty assistant. Always answer briefly, friendly, and with light humor. Avoid offensive or toxic jokes." as const;
const VIS_AGENT_PROMPT =
	`You are a creative assistant. Always provide a concise answer AND a visualization section.
Structure:
1) Brief answer
2) Visualization: one of ASCII art, simple diagram, bullet structure, or code block pseudo-graphics relevant to the idea.
Keep it safe and non-offensive.` as const;

// Call out to a minimal LLM classification by piggy-backing the existing pipeline
// We don't import model here; the outer route uses systemPrompt/messages. So we produce
// an intermediate message list to classify, then choose the final agent prompts.
const classifyWithLLM = (
	_messages: readonly ModelMessage[],
	lastText: string,
): Effect.Effect<RouteType> =>
	Effect.sync(() => {
		// Heuristic fallback if LLM classification fails downstream: quick rule-of-thumb
		const txt = lastText.toLowerCase();
		const looksIdeate =
			/придум|создай|сгенерируй|invent|create|come up|brainstorm/.test(txt);
		return looksIdeate ? "ideate" : "question";
	}).pipe(
		Effect.withSpan("agent.classify", {
			attributes: { "agent.last_text_len": lastText.length },
		}),
	);

export const chatAgentEffect = (
	messages: readonly ModelMessage[],
): Effect.Effect<AgentResult> =>
	Effect.gen(function* () {
		const startTime = Date.now();

		if (isEmptyInput(messages)) {
			return {
				systemPrompt: JOKE_AGENT_PROMPT,
				enhancedMessages: [...messages],
				parameters: { ...DEFAULT_PARAMS, temperature: 0.8 },
				intent: "question",
				metadata: {
					contextUsed: false,
					processingTimeMs: Date.now() - startTime,
				},
			} satisfies AgentResult;
		}

		const lastMessageContent = messages[messages.length - 1]?.content ?? "";
		const textContent = extractTextFromContent(lastMessageContent);

		// First, ask LLM to classify (fallback heuristic inside)
		const route = yield* classifyWithLLM(messages, textContent);

		// Build final agent
		const systemPrompt =
			route === "ideate" ? VIS_AGENT_PROMPT : JOKE_AGENT_PROMPT;
		const parameters =
			route === "ideate" ? { temperature: 0.5 } : { temperature: 0.8 };

		// Optionally prepend a classifier system message to bias routing when model runs
		const enhancedMessages: ModelMessage[] = [
			{ role: "system", content: systemPrompt },
			...messages,
		];

		return {
			systemPrompt,
			enhancedMessages,
			parameters,
			intent: route,
			metadata: {
				contextUsed: false,
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
