import { Context, Effect, Layer } from "effect";
import { Langfuse } from "langfuse";
import type { UsageMapping } from "../model/types";

// Simple interfaces
export interface LangfuseService {
	readonly createTrace: (
		name: string,
		input?: unknown,
	) => Effect.Effect<LangfuseTrace>;
	readonly flush: () => Effect.Effect<void>;
	readonly getFlushPromise: () => Effect.Effect<Promise<void>>;
	readonly shutdown: () => Effect.Effect<void>;
}

export interface LangfuseTrace {
	readonly update: (params: {
		output?: unknown;
		metadata?: Record<string, unknown>;
	}) => Effect.Effect<void>;
	readonly span: (name: string, input?: unknown) => Effect.Effect<LangfuseSpan>;
	readonly generation: (params: {
		name: string;
		model: string;
		input: unknown;
		output?: unknown;
		usage?: UsageMapping;
	}) => Effect.Effect<LangfuseGeneration>;
}

export interface LangfuseSpan {
	readonly update: (params: {
		output?: unknown;
		metadata?: Record<string, unknown>;
	}) => Effect.Effect<void>;
	readonly end: () => Effect.Effect<void>;
}

export interface LangfuseGeneration {
	readonly update: (params: {
		output?: unknown;
		usage?: UsageMapping;
	}) => Effect.Effect<void>;
	readonly end: () => Effect.Effect<void>;
}

// Context tag
export const LangfuseService =
	Context.GenericTag<LangfuseService>("LangfuseService");

// Simple config
const getLangfuseConfig = () => {
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;
	const baseUrl = process.env.LANGFUSE_HOST;
	const sampleRate = 1.0;

	if (!publicKey || !secretKey || !baseUrl) {
		throw new Error("Missing Langfuse environment variables");
	}

	return { publicKey, secretKey, LangfuseOptions: { baseUrl, sampleRate } };
};

const createTraceOperations = (trace: any): LangfuseTrace => ({
	update: (params) => Effect.sync(() => trace.update(params)),

	span: (spanName: string, spanInput?: unknown) =>
		Effect.sync(() => {
			const span = trace.span({ name: spanName, input: spanInput });
			return {
				update: (params) => Effect.sync(() => span.update(params)),
				end: () => Effect.sync(() => span.end()),
			};
		}),

	generation: (params) =>
		Effect.sync(() => {
			const generationParams: any = {
				name: params.name,
				model: params.model,
				input: params.input,
			};
			if (params.output) generationParams.output = params.output;
			if (params.usage) generationParams.usage = params.usage;

			const generation = trace.generation(generationParams);

			return {
				update: (updateParams) =>
					Effect.sync(() => generation.update(updateParams)),
				end: () => Effect.sync(() => generation.end()),
			};
		}),
});

// Simple service implementation with lazy initialization
const makeLangfuseService = (): Effect.Effect<LangfuseService> =>
	Effect.sync(() => {
		const config = getLangfuseConfig();
		const langfuse = new Langfuse(config);

		// Basic error logging
		langfuse.on("error", (err) => console.error("[Langfuse SDK error]", err));

		// Debug mode
		if (process.env.LANGFUSE_DEBUG === "true") {
			langfuse.debug();
		}

		return {
			createTrace: (name: string, input?: unknown) =>
				Effect.sync(() => {
					const trace = langfuse.trace({ name, input });
					return createTraceOperations(trace);
				}),

			flush: () => Effect.promise(() => langfuse.flushAsync()),
			getFlushPromise: () => Effect.sync(() => langfuse.flushAsync()),
			shutdown: () => Effect.promise(() => langfuse.shutdownAsync()),
		};
	});

// Simple Layer with lazy initialization
export const LangfuseLayer = Layer.effect(
	LangfuseService,
	makeLangfuseService(),
);
