import type { Span } from "@opentelemetry/api";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { ApiIngestionUsage } from "langfuse";

export type TracingAttributes = Record<string, string | number | boolean>;

export interface UsageMetrics {
	readonly inputTokens: number;
	readonly outputTokens: number;
	readonly totalTokens: number;
}

export interface SpanConfig {
	readonly name: string;
	readonly attributes?: TracingAttributes;
}

export interface LangfuseObservation {
	readonly model: string;
	readonly input: string;
	readonly output?: string;
	readonly usage?: UsageMetrics;
	readonly finishReason?: string;
}

// Effect Services
export interface TracingService {
	readonly startSpan: (config: SpanConfig) => Effect.Effect<Span>;
	readonly withSpan: <A, E, R>(
		config: SpanConfig,
		effect: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E, R>;
	readonly setAttributes: (
		attributes: TracingAttributes,
	) => Effect.Effect<void>;
	readonly recordLangfuseRequest: (
		model: string,
		input: string,
	) => Effect.Effect<void>;
	readonly recordLangfuseResult: (
		output: string,
		usage?: UsageMetrics,
		finishReason?: string,
	) => Effect.Effect<void>;
}

export const TracingService =
	Context.GenericTag<TracingService>("TracingService");

// Errors
export class TracingError extends Error {
	readonly _tag = "TracingError";
}

export class SpanNotFoundError extends Error {
	readonly _tag = "SpanNotFoundError";

	constructor(message = "No active span found") {
		super(message);
	}
}

// Langfuse specific types for better FSD organization

/**
 * Usage mapping from Vercel AI SDK to Langfuse format
 */
export type UsageMapping = ApiIngestionUsage;

/**
 * Vercel AI SDK usage format (matches actual event.usage structure)
 */
export type VercelUsage = {
	inputTokens?: number | undefined;
	outputTokens?: number | undefined;
	totalTokens?: number | undefined;
};

/**
 * Chat trace metadata for better organization
 */
export type ChatTraceMetadata = {
	model: string;
	environment?: string;
	userId?: string;
	sessionId?: string;
	version?: string;
};

/**
 * Langfuse configuration type
 */
export type LangfuseConfig = {
	publicKey: string;
	secretKey: string;
	baseUrl?: string;
	sampleRate?: number;
};
