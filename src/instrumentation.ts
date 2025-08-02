import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

export function register() {
	console.log("🔧 Registering OpenTelemetry...");

	const spanProcessors: ("auto" | BatchSpanProcessor)[] = ["auto"];

	// Дополнительный экспортёр для Supabase (если настроен)
	if (process.env.SUPABASE_OTEL_ENDPOINT) {
		console.log("🔗 Adding Supabase OTEL exporter");
		const supabaseExporter = new OTLPHttpJsonTraceExporter({
			url: process.env.SUPABASE_OTEL_ENDPOINT,
			headers: {
				authorization: process.env.SUPABASE_OTEL_HEADERS || "",
			},
		});

		spanProcessors.push(new BatchSpanProcessor(supabaseExporter));
	}

	registerOTel({
		serviceName: "chatbot-template",
		spanProcessors,
	});
}
