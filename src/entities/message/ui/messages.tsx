import type { UIMessage } from "ai";
import { motion } from "framer-motion";
import { memo, useEffect, useRef } from "react";
import { Greeting } from "@/entities/message/ui/greeting";
import { MessageBubble } from "./message-bubble";

interface MessagesProps {
	messages: Array<UIMessage>;
	isLoading: boolean;
}

function PureMessages({ messages, isLoading }: MessagesProps) {
	const messagesEndRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({
			behavior: "smooth",
			block: "end",
		});
	});

	useEffect(() => {
		if (isLoading) {
			const timer = setTimeout(() => {
				messagesEndRef.current?.scrollIntoView({
					behavior: "smooth",
					block: "end",
				});
			}, 50);
			return () => clearTimeout(timer);
		}
		return undefined;
	}, [isLoading]);

	return (
		<div className="relative flex flex-col flex-1 gap-6 pt-4 min-w-0 overflow-y-scroll scroll-smooth">
			{messages.length === 0 && <Greeting />}

			{messages.map((message, index) => (
				<MessageBubble
					key={message.id}
					message={{
						id: message.id,
						role: message.role as "user" | "assistant",
						content: message.parts
							.filter((part) => part.type === "text")
							.map((part) => part.text)
							.join(""),
						timestamp: new Date(),
					}}
					isLoading={isLoading && messages.length - 1 === index}
				/>
			))}

			<motion.div
				ref={messagesEndRef}
				className="min-w-[24px] min-h-[24px] shrink-0"
			/>
		</div>
	);
}

export const Messages = memo(PureMessages);
