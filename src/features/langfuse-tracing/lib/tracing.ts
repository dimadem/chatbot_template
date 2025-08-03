import type { Span } from "@opentelemetry/api";
import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { TracingAttributes } from "../model/types";

const TRACER_NAME = "" as const;
const TRACER_VERSION = "0.0.0" as const;

export const getTracer = () => trace.getTracer(TRACER_NAME, TRACER_VERSION);

export function startSpan(name: string, attrs?: TracingAttributes): Span {
  const span = getTracer().startSpan(name);
  if (attrs) span.setAttributes(attrs as Record<string, any>);
  return span;
}

export function withSpan<T>(name: string, fn: (span: Span) => Promise<T> | T, attrs?: TracingAttributes): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, (span) => {
    if (attrs) span.setAttributes(attrs as Record<string, any>);
    try {
      const res = fn(span);
      return Promise.resolve(res)
        .then((v) => {
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
          return v;
        })
        .catch((e) => {
          span.recordException(e as Error);
          span.setStatus({ code: SpanStatusCode.ERROR, message: String((e as Error).message ?? e) });
          span.end();
          throw e;
        });
    } catch (e) {
      span.recordException(e as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String((e as Error).message ?? e) });
      span.end();
      return Promise.reject(e);
    }
  });
}

export function setAttrs(span: Span, attrs: TracingAttributes) {
  span.setAttributes(attrs as Record<string, any>);
}

export function endOk(span: Span) {
  span.setStatus({ code: SpanStatusCode.OK });
  span.end();
}

export function endError(span: Span, err: unknown) {
  span.recordException(err as Error);
  span.setStatus({ code: SpanStatusCode.ERROR, message: String((err as Error).message ?? err) });
  span.end();
}

// Domain helpers
export function recordLangfuseRequest(span: Span, model: string, inputMessagesJson: string) {
  setAttrs(span, {
    "langfuse.observation.model.name": model,
    "langfuse.observation.input": inputMessagesJson,
  });
}

export function recordLangfuseResult(
  span: Span,
  output: string,
  usage?: { inputTokens?: number | undefined; outputTokens?: number | undefined; totalTokens?: number | undefined },
  finishReason?: string,
) {
  setAttrs(span, {
    "langfuse.observation.output": output,
    "gen_ai.response.finish_reason": finishReason || "stop",
    "gen_ai.usage.input_tokens": usage?.inputTokens ?? 0,
    "gen_ai.usage.output_tokens": usage?.outputTokens ?? 0,
    "gen_ai.usage.total_tokens": usage?.totalTokens ?? 0,
  });
}
