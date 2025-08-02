"use client";

import { useCallback, useEffect, useRef } from "react";
import { ArrowUpIcon, StopIcon } from "@/shared/components/icons";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";

interface MessageInputProps {
	input: string;
	setInput: (value: string) => void;
	handleSubmit: (e?: React.FormEvent) => void;
	status: "ready" | "submitted" | "streaming" | "error";
	stop: () => void;
}

export function MessageInput({
	input,
	setInput,
	handleSubmit,
	status,
	stop,
}: MessageInputProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const adjustHeight = useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${textareaRef.current.scrollHeight + 2}px`;
		}
	}, []);

	const resetHeight = useCallback(() => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = "98px";
		}
	}, []);

	useEffect(() => {
		if (textareaRef.current) {
			adjustHeight();
		}
	}, [adjustHeight]);

	const handleInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(event.target.value);
		adjustHeight();
	};

	const submitForm = useCallback(
		(e?: React.FormEvent) => {
			if (e) e.preventDefault();
			handleSubmit(e);
			resetHeight();
		},
		[handleSubmit, resetHeight],
	);

	return (
		<div className="relative flex flex-col gap-4 w-full">
			<Textarea
				data-testid="multimodal-input"
				ref={textareaRef}
				placeholder="Отправить сообщение..."
				value={input}
				onChange={handleInput}
				disabled={status !== "ready"}
				className={cn(
					"bg-muted pb-10 dark:border-zinc-700 rounded-2xl min-h-[24px] max-h-[calc(50dvh)] overflow-y-auto !text-base resize-none",
				)}
				rows={2}
				autoFocus
				onKeyDown={(event) => {
					if (
						event.key === "Enter" &&
						!event.shiftKey &&
						!event.nativeEvent.isComposing
					) {
						event.preventDefault();

						if (status === "ready") {
							submitForm();
						}
					}
				}}
			/>

			<div className="right-2 bottom-2 absolute flex flex-row justify-end p-2 w-fit">
				{status === "streaming" || status === "submitted" ? (
					<Button
						data-testid="stop-button"
						className="p-2 border dark:border-zinc-600 rounded-full h-fit"
						onClick={(event) => {
							event.preventDefault();
							stop();
						}}
					>
						<StopIcon size={20} className="size-6" />
					</Button>
				) : (
					<Button
						data-testid="send-button"
						className="p-2 border dark:border-zinc-600 rounded-full h-fit"
						onClick={(event) => {
							event.preventDefault();
							submitForm();
						}}
						disabled={input.length === 0 || status !== "ready"}
					>
						<ArrowUpIcon size={20} className="size-6" />
					</Button>
				)}
			</div>
		</div>
	);
}
