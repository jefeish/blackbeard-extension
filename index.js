import { Octokit } from "@octokit/core";
import express from "express";
import { Readable } from "node:stream";
import { handleTokenExchange } from "./modules/exchangeController.js";
import util from 'util';
import { logger } from './modules/logger.js';

// Set up the Express app
const app = express()

// middleware to parse form-encoded data and parse JSON data
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/**
 * @description Welcome message endpoint
 * @route GET /
 */
app.get("/", (req, res) => {
    res.send("Ahoy, matey! Welcome to the Blackbeard Pirate GitHub Copilot Extension!")
});

/**
 * @description Handles the Copilot Chat request.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 */
app.post("/", express.json(), async (req, res) => {
    logger.info("Received Copilot Chat request at endpoint '/'");
    try {
        // log the request headers
        logger.debug("Request Headers '/': " + util.inspect(req.headers, { depth: null, colors: true }));
        // Validate GitHub API token from headers
        const tokenForUser = req.get("X-GitHub-Token");
        if (!tokenForUser) {
            logger.error("Missing GitHub token in request headers");
            return res.status(400).json({ error: "missing_github_token" });
        }

        // Identify the user via GitHub API
        const octokit = new Octokit({ auth: tokenForUser });
        const user = await octokit.request("GET /user");

        logger.info("Requester - User: " + user.data.login);
        logger.debug("Requester - User ID: " + user.data.id);

        // Validate and parse request payload
        const payload = req.body;
        if (!payload || !Array.isArray(payload.messages)) {
            logger.error("Invalid payload: " + payload);
            return res.status(400).json({ error: "invalid_payload" });
        }

        // Insert pirate-y system messages
        const messages = payload.messages;
        messages.unshift({
            role: "system",
            content: "You are a helpful assistant that replies to user messages as if you were the Blackbeard Pirate.",
        });
        messages.unshift({
            role: "system",
            content: "Start every response with the user's name, which is @${user.data.login}",
        });

        // Call Copilot's LLM API
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

        // Check Copilot API response status
        if (!copilotLLMResponse.ok) {
            const errorText = await copilotLLMResponse.text();
            logger.error("Copilot API error: " + errorText);
            return res.status(502).json({ error: "copilot_api_error", details: errorText });
        }

        // Stream the response straight back to the user
        Readable.from(copilotLLMResponse.body).pipe(res);
    } catch (error) {
        logger.error("Internal server error: " + error);
        res.status(500).json({ error: "internal_server_error" });
    }
});

/**
 * @description Endpoint to handle token exchange requests (OIDC token exchange)
 * @route POST /exchange
 */
app.post('/exchange', handleTokenExchange);

const port = Number(process.env.PORT || '3000')
app.listen(port, () => {
    logger.info(`Server running on port ${port}`)
});