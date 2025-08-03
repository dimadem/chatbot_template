import { Context, Effect, Layer } from "effect";
import { Langfuse } from "langfuse";
import type { UsageMapping } from "../model/types";

// Langfuse service interface
export interface LangfuseService {
	readonly createTrace: (
		name: string,
		input?: unknown,
	) => Effect.Effect<LangfuseTrace>;
	readonly flush: () => Effect.Effect<void>;
	// For serverless environments - returns flush promise for waitUntil
	readonly getFlushPromise: () => Effect.Effect<Promise<void>>;
	// For serverless environments - shutdown and wait
	readonly shutdown: () => Effect.Effect<void>;
	// Optional: enable verbose debugging at runtime
	readonly debug: () => Effect.Effect<void>;
}

// Langfuse trace interface
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

// Langfuse span interface
export interface LangfuseSpan {
	readonly update: (params: {
		output?: unknown;
		metadata?: Record<string, unknown>;
	}) => Effect.Effect<void>;
	readonly end: () => Effect.Effect<void>;
}

// Langfuse generation interface
export interface LangfuseGeneration {
	readonly update: (params: {
		output?: unknown;
		usage?: UsageMapping;
	}) => Effect.Effect<void>;
	readonly end: () => Effect.Effect<void>;
}

// Context tags
export const LangfuseService =
	Context.GenericTag<LangfuseService>("LangfuseService");

// Environment configuration validation
const getLangfuseConfig = () => {
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;

	if (!publicKey || !secretKey) {
		throw new Error("LANGFUSE_PUBLIC_KEY and LANGFUSE_SECRET_KEY must be set");
	}

	return {
		publicKey,
		secretKey,
		baseUrl: process.env.LANGFUSE_HOST || "https://cloud.langfuse.com",
		...(process.env.LANGFUSE_SAMPLE_RATE && {
			sampleRate: Number(process.env.LANGFUSE_SAMPLE_RATE),
		}),
	};
};

// Implementation
const makeLangfuseService = (): LangfuseService => {
	const config = getLangfuseConfig();
	const langfuse = new Langfuse(config);

	// Surface SDK errors to logs
	langfuse.on("error", (err) => {
		console.error("[Langfuse SDK error]", err);
	});

	// Enable debug mode via environment variable
	if (process.env.LANGFUSE_DEBUG === "true") {
		langfuse.debug();
	}

	return {
		createTrace: (name: string, input?: unknown) =>
			Effect.sync(() => {
				const trace = langfuse.trace({ name, input });

				return {
					update: (params: {
						output?: unknown;
						metadata?: Record<string, unknown>;
					}) =>
						Effect.sync(() => {
							trace.update(params);
						}),

					span: (spanName: string, spanInput?: unknown) =>
						Effect.sync(() => {
							const span = trace.span({ name: spanName, input: spanInput });

							return {
								update: (params: {
									output?: unknown;
									metadata?: Record<string, unknown>;
								}) =>
									Effect.sync(() => {
										span.update(params);
									}),
								end: () =>
									Effect.sync(() => {
										span.end();
									}),
							};
						}),

					generation: (params: {
						name: string;
						model: string;
						input: unknown;
						output?: unknown;
						usage?: UsageMapping;
					}) =>
						Effect.sync(() => {
							const generationParams: Record<string, unknown> = {
								name: params.name,
								model: params.model,
								input: params.input,
							};
							if (params.output !== undefined) {
								generationParams.output = params.output;
							}
							if (params.usage !== undefined) {
								generationParams.usage = params.usage;
							}
							const generation = trace.generation(generationParams);

							return {
								update: (updateParams: {
									output?: unknown;
									usage?: UsageMapping;
								}) =>
									Effect.sync(() => {
										const updateGenParams: Record<string, unknown> = {};
										if (updateParams.output !== undefined) {
											updateGenParams.output = updateParams.output;
										}
										if (updateParams.usage !== undefined) {
											updateGenParams.usage = updateParams.usage;
										}
										generation.update(updateGenParams);
									}),
								end: () =>
									Effect.sync(() => {
										generation.end();
									}),
							};
						}),
				};
			}),

		flush: () =>
			Effect.promise(() => {
				return langfuse.flushAsync();
			}),

		// For serverless environments - returns flush promise for waitUntil
		getFlushPromise: () =>
			Effect.sync(() => {
				return langfuse.flushAsync();
			}),

		// For serverless environments - shutdown and wait
		shutdown: () =>
			Effect.promise(() => {
				return langfuse.shutdownAsync();
			}),

		debug: () =>
			Effect.sync(() => {
				langfuse.debug();
			}),
	};
};

// Layer
export const LangfuseLayer = Layer.succeed(
	LangfuseService,
	makeLangfuseService(),
);
