import { waitUntil } from "@vercel/functions";
import * as Effect from "effect/Effect";
import type { ChatTraceMetadata } from "../model/types";
import { LangfuseService, type LangfuseTrace } from "./langfuse-effect";

// Simple Vercel flush wrapper
export const withLangfuseVercelFlush = <A, E>(
	effect: Effect.Effect<A, E, LangfuseService>,
) =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const result = yield* effect;

		// Get flush promise for Vercel waitUntil
		const flushPromise = yield* langfuse.getFlushPromise();
		waitUntil(flushPromise);

		return result;
	});

// Simple trace creator for Vercel
export const createVercelChatTrace = (
	name: string,
	input: unknown,
	metadata?: Partial<ChatTraceMetadata>,
): Effect.Effect<LangfuseTrace, never, LangfuseService> =>
	Effect.gen(function* () {
		const langfuse = yield* LangfuseService;
		const trace = yield* langfuse.createTrace(name, input);

		// Add metadata if provided
		if (metadata) {
			yield* trace.update({ metadata });
		}

		return trace;
	});
