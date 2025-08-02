import { trace } from "@opentelemetry/api";
import { NextResponse } from "next/server";

export async function GET() {
	const tracer = trace.getTracer("test-tracer");

	return tracer.startActiveSpan("test.simple-span", async (span) => {
		console.log("🧪 Creating test span for LangFuse");

		span.setAttributes({
			"test.type": "simple",
			"test.timestamp": Date.now(),
			"test.message": "Hello from OpenTelemetry!",
		});

		// Simulate some work
		await new Promise((resolve) => setTimeout(resolve, 100));

		span.addEvent("test.event", {
			"event.description": "Test event created",
		});

		span.setStatus({ code: 1 }); // OK
		span.end();

		console.log("✅ Test span completed");

		return NextResponse.json({
			message: "Test span created and should be sent to LangFuse",
			timestamp: Date.now(),
		});
	});
}
