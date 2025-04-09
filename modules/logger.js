import pino from "pino";

// Create a pino logger instance
const logger = pino({
    level: process.env.LOG_LEVEL || "info", // Use LOG_LEVEL from environment or default to "info"

    transport: {
        targets: [
            {
                target: "pino-pretty", 
                options: { colorize: true },
            },
        ],
    },
});


// Export the logger instance
export default logger;