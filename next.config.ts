import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
	/* config options here */
};

export default withSentryConfig(nextConfig, {
	// For all available options, see:
	// https://github.com/getsentry/sentry-webpack-plugin#options

	org: "your-sentry-org",
	project: "chatbot-template",

	// Only print logs for uploading source maps in CI
	silent: !process.env.CI,

	// For all available options, see:
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

	// Upload a larger set of source maps for prettier stack traces (increases build time)
	widenClientFileUpload: true,

	// Automatically tree-shake Sentry logger statements to reduce bundle size
	disableLogger: true,

	// Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
	// See the following for more information:
	// https://docs.sentry.io/product/crons/
	// https://docs.sentry.io/platforms/javascript/guides/nextjs/instrumentation/automatic-instrumentation/
	automaticVercelMonitors: true,
});
