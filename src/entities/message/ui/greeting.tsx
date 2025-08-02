import { motion } from "framer-motion";

const GREETING = "hello world";
const INSTRUCTIONS =
	"Ask a question or type a message to start the conversation.";

export const Greeting = () => {
	return (
		<div
			key="overview"
			className="flex flex-col justify-center mx-auto md:mt-20 px-4 max-w-3xl size-full text-center"
		>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 10 }}
				transition={{ delay: 0.5 }}
				className="font-semibold text-2xl"
			>
				{GREETING}
			</motion.div>
			<motion.div
				initial={{ opacity: 0, y: 10 }}
				animate={{ opacity: 1, y: 0 }}
				exit={{ opacity: 0, y: 10 }}
				transition={{ delay: 0.6 }}
				className="text-muted-foreground text-2xl"
			>
				{INSTRUCTIONS}
			</motion.div>
		</div>
	);
};
