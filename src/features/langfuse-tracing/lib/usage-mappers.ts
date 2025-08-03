import type { UsageMapping, VercelUsage } from "../model/types";

/**
 * Maps Vercel AI SDK usage format to Langfuse API format
 *
 * @param usage - Usage data from Vercel AI SDK event
 * @returns Formatted usage for Langfuse API
 *
 * @example
 * ```typescript
 * onFinish: (event) => {
 *   const langfuseUsage = mapVercelUsageToLangfuse(event.usage);
 *   generation.update({ usage: langfuseUsage });
 * }
 * ```
 */
export const mapVercelUsageToLangfuse = (usage: VercelUsage): UsageMapping => ({
	promptTokens: usage.inputTokens ?? 0,
	completionTokens: usage.outputTokens ?? 0,
	totalTokens: usage.totalTokens ?? 0,
});

/**
 * Type guard to check if usage data is valid
 */
export const isValidUsage = (usage: unknown): usage is VercelUsage => {
	return (
		typeof usage === "object" &&
		usage !== null &&
		("inputTokens" in usage ||
			"outputTokens" in usage ||
			"totalTokens" in usage)
	);
};
