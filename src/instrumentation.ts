import type { ExportResult } from "@opentelemetry/core";
import type { ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { OTLPHttpJsonTraceExporter, registerOTel } from "@vercel/otel";

export function register() {
	console.log("🔧 Starting instrumentation registration...");

	// Create base64 encoded auth string for LangFuse Basic Auth
	const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
	const secretKey = process.env.LANGFUSE_SECRET_KEY;

	console.log("🔑 LangFuse keys:", {
		publicKeyExists: !!publicKey,
		secretKeyExists: !!secretKey,
		publicKeyPrefix: publicKey?.substring(0, 6),
		secretKeyPrefix: secretKey?.substring(0, 6),
	});

	if (!publicKey || !secretKey) {
		console.warn(
			"⚠️ LangFuse keys not found, traces will not be sent to LangFuse",
		);
		registerOTel({ serviceName: "chatbot-template" });
		return;
	}

	const langfuseAuth = Buffer.from(`${publicKey}:${secretKey}`).toString(
		"base64",
	);
	console.log("🔐 Auth string created, length:", langfuseAuth.length);
	console.log("🔐 Auth string preview:", `${langfuseAuth.substring(0, 20)}...`);

	const exporter = new OTLPHttpJsonTraceExporter({
		url: "https://cloud.langfuse.com/api/public/otel",
		headers: {
			Authorization: `Basic ${langfuseAuth}`,
		},
	});

	// Add error handling to see if there are export issues
	const originalExport = exporter.export.bind(exporter);
	exporter.export = (
		items: ReadableSpan[],
		resultCallback: (result: ExportResult) => void,
	) => {
		console.log("📤 Attempting to export", items.length, "spans to LangFuse");
		console.log("📤 Export URL:", "https://cloud.langfuse.com/api/public/otel");
		console.log("📤 Auth header:", `Basic ${langfuseAuth.substring(0, 20)}...`);
		return originalExport(items, (result: ExportResult) => {
			if (result.code === 0) {
				console.log("✅ Successfully exported spans to LangFuse");
			} else {
				console.error("❌ Failed to export spans to LangFuse:", result.error);
				console.error("❌ Full result:", result);
			}
			resultCallback(result);
		});
	};

	registerOTel({
		serviceName: "chatbot-template",
		traceExporter: exporter,
	});

	console.log("✅ LangFuse OTLP tracing initialized with enhanced logging");
}
