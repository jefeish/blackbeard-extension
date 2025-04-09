import { Octokit } from "@octokit/core";
import express from "express";
import { Readable } from "node:stream";
import { handleTokenExchange } from "./modules/exchangeController.js";
import { logger } from './modules/logger.js';
import util from 'util';

const app = express()

// middleware to parse form-encoded data and parse JSON data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Ahoy, matey! Welcome to the Blackbeard Pirate GitHub Copilot Extension!")
});

app.post("/", express.json(), async (req, res) => {
    logger.info("Received Copilot Chat request at endpoint '/'");
    try {
        // log the request headers
        logger.debug("Request Headers '/': " + util.inspect(req.headers, { depth: null, colors: true }));

        const tokenForUser = req.get("X-GitHub-Token");
        const octokit = new Octokit({ auth: tokenForUser });
        const user = await octokit.request("GET /user");

        console.log("User:", user.data.login);

        // Parse the request payload and log it.
        const payload = req.body;
        console.log("Payload:", payload);

        // Insert pirate-y system messages
        const messages = payload.messages;
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant that replies to user messages as if you were the Blackbeard Pirate.",
        });
        messages.unshift({
            role: "system",
            content: `Start every response with the user's name, which is @${user.data.login}`,
        });

        // Use Copilot's LLM to generate a response to the user's messages, with
        // our extra system messages attached.
        const copilotLLMResponse = await fetch(
            "https://api.githubcopilot.com/chat/completions",
            {
                method: "POST",
                headers: {
                    authorization: `Bearer ${tokenForUser}`,
                    "content-type": "application/json",
                },
                body: JSON.stringify({
                    messages,
                    stream: true,
                }),
            }
        );

        // Stream the response straight back to the user
        Readable.from(copilotLLMResponse.body).pipe(res);
    } catch (error) {
        logger.error("Internal server error: " + error);
        res.status(500).json({ error: "internal_server_error" });
    }
});

// Endpoint to handle token exchange requests (OIDC token exchange)
app.post('/exchange', handleTokenExchange);

const port = Number(process.env.PORT || '3000')
app.listen(port, () => {
    console.log(`Server running on port ${port}`)
});