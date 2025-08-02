"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useState } from "react";
import { Messages } from "@/entities/message";
import { MessageInput } from "@/features/send-message";

export function ChatInterface() {
	const [input, setInput] = useState("");

	const { messages, sendMessage, status, stop } = useChat({
		transport: new DefaultChatTransport({
			api: "/api/chat",
		}),
	});

	const handleSubmit = (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		if (input.trim()) {
			sendMessage({ text: input });
			setInput("");
		}
	};

	return (
		<div className="flex flex-col bg-background min-w-0 h-dvh">
			<Messages
				messages={messages}
				isLoading={status === "streaming" || status === "submitted"}
			/>

			{/* {messages.length === 0 && (
				<SuggestedActions setMessages={setMessages} messages={messages} />
			)} */}

			<form
				className="flex gap-2 bg-background mx-auto px-4 pt-4 pb-4 md:pb-6 w-full md:max-w-3xl"
				onSubmit={handleSubmit}
			>
				<MessageInput
					input={input}
					setInput={setInput}
					handleSubmit={handleSubmit}
					status={status}
					stop={stop}
				/>
			</form>
		</div>
	);
}
