import { waitUntil } from "@vercel/functions";
import * as Effect from "effect/Effect";
import type { ChatTraceMetadata } from "../model/types";
import { LangfuseService } from "./langfuse-effect";

// Wrapper to handle Langfuse flush in serverless environments
export const withLangfuseVercelFlush = <A, E>(
	effect: Effect.Effect<A, E, LangfuseService>,
) =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const result = yield* effect;

		// Get flush promise and pass to Vercel's waitUntil
		const flushPromise = yield* langfuse.getFlushPromise();
		waitUntil(flushPromise);

		return result;
	});

// For cases where you need to ensure completion before response
export const withLangfuseServerlessShutdown = <A, E>(
	effect: Effect.Effect<A, E, LangfuseService>,
) =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const result = yield* effect;

		// Wait for shutdown to complete
		yield* langfuse.shutdown();

		return result;
	});

// Helper for chat completions with proper Vercel handling
export const createVercelChatTrace = (
	name: string,
	input: unknown,
	metadata?: Partial<ChatTraceMetadata>,
) =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const trace = yield* langfuse.createTrace(name, input);

		// Update with metadata if provided
		if (metadata) {
			yield* trace.update({ metadata });
		}

		return trace;
	});
