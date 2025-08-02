export interface Message {
	id: string;
	role: "user" | "assistant";
	content: string;
	timestamp: Date;
}

export interface QuickReply {
	id: string;
	text: string;
}
