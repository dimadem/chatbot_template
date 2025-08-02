import { AnimatePresence, motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { SparklesIcon } from "@/shared/components/icons";
import type { Message } from "@/shared/lib/types";
import { cn } from "@/shared/lib/utils";

interface MessageBubbleProps {
	message: Message;
	isLoading?: boolean;
}

const markdownComponents = {
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	h1: (props: any) => (
		<h1 className="text-2xl font-bold mt-6 mb-4 text-foreground" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	h2: (props: any) => (
		<h2
			className="text-xl font-semibold mt-5 mb-3 text-foreground"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	h3: (props: any) => (
		<h3 className="text-lg font-medium mt-4 mb-2 text-foreground" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	h4: (props: any) => (
		<h4
			className="text-base font-medium mt-3 mb-2 text-foreground"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	p: (props: any) => (
		<p className="text-sm leading-relaxed mb-3 text-foreground" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	ul: (props: any) => (
		<ul className="list-disc pl-4 mb-3 space-y-1" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	ol: (props: any) => (
		<ol className="list-decimal pl-4 mb-3 space-y-1" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	li: (props: any) => <li className="text-sm text-foreground" {...props} />,
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	blockquote: (props: any) => (
		<blockquote
			className="border-l-4 border-border pl-3 py-2 mb-3 bg-muted/30 rounded-r-md"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	code: (props: any) => (
		<code
			className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground border"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	pre: (props: any) => (
		<pre
			className="bg-muted p-3 rounded-lg mb-3 overflow-x-auto border"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	strong: (props: any) => (
		<strong className="font-semibold text-foreground" {...props} />
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	em: (props: any) => <em className="italic text-foreground" {...props} />,
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	a: (props: any) => (
		<a
			className="text-primary hover:text-primary/80 underline underline-offset-2"
			target="_blank"
			rel="noopener noreferrer"
			{...props}
		/>
	),
	// biome-ignore lint/suspicious/noExplicitAny: React-markdown component props
	hr: (props: any) => <hr className="border-border my-4" {...props} />,
};

export function MessageBubble({
	message,
	isLoading: _isLoading,
}: MessageBubbleProps) {
	return (
		<AnimatePresence>
			<motion.div
				data-testid={`message-${message.role}`}
				className="group/message mx-auto px-4 w-full max-w-3xl"
				initial={{ y: 5, opacity: 0 }}
				animate={{ y: 0, opacity: 1 }}
				data-role={message.role}
			>
				<div
					className={cn(
						"flex gap-4 w-full group-data-[role=user]/message:ml-auto group-data-[role=user]/message:max-w-2xl",
						"group-data-[role=user]/message:w-fit",
					)}
				>
					{message.role === "assistant" && (
						<div className="flex justify-center items-center bg-background ring-border rounded-full ring-1 size-8 shrink-0">
							<div className="translate-y-px">
								<SparklesIcon size={14} />
							</div>
						</div>
					)}

					<div className="flex flex-col gap-4 w-full">
						<div
							data-testid="message-content"
							className={cn("flex flex-col gap-4", {
								"bg-primary text-primary-foreground px-3 py-2 rounded-xl":
									message.role === "user",
							})}
						>
							{message.role === "assistant" ? (
								<div className="max-w-none">
									<ReactMarkdown components={markdownComponents}>
										{message.content}
									</ReactMarkdown>
								</div>
							) : (
								<div className="whitespace-pre-wrap break-words">
									{message.content}
								</div>
							)}
						</div>
					</div>
				</div>
			</motion.div>
		</AnimatePresence>
	);
}
