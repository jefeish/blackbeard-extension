import jwksClient from 'jwks-rsa';
import dotenv from 'dotenv';
import util from 'util';
import logger from './logger.js';

// Load environment variables from .env file
dotenv.config();

// JWKS client setup for GitHub OIDC tokens
const jwks = jwksClient({
    jwksUri: 'https://github.com/login/oauth/.well-known/jwks.json'
});

/**
 * @description Helper function to retrieve signing key
 * @param {*} header 
 * @returns 
 */
async function getSigningKey(header) {
    return new Promise((resolve, reject) => {
        jwks.getSigningKey(header.kid, (err, key) => {
            if (err) {
                logger.error('Error fetching signing key:', err);
                return reject(err);
            }
            const signingKey = key.getPublicKey();
            logger.debug("Successfully fetched signing key: \n" + signingKey); // Debugging: Log the signing key
            resolve(signingKey);
        });
    });
}

/**
 * @description Validates a JWT payload for required fields.
 * @param {Object} payload - The decoded JWT payload.
 * @returns {boolean} - Returns true if the JWT is valid, otherwise throws an error.
 */
async function isValidJWT(payload) {
    logger.info("Validating JWT payload");

    // Optional: Retrieve the validation data from the environment
    const GITHUB_APP_CLIENT_ID = process.env.GITHUB_APP_CLIENT_ID
    const ACTOR = process.env.ACTOR || "https://api.githubcopilot.com";

    const now = Math.floor(Date.now() / 1000); // Current timestamp in seconds
    logger.debug("\t payload.aud: " + payload.aud);

    // Validate audience (aud)
    logger.debug("\t audience (aud): " + payload.aud);
    if (payload.aud !== GITHUB_APP_CLIENT_ID) {
        throw new Error(`Invalid audience (aud). Expected: ${GITHUB_APP_CLIENT_ID}, Received: ${payload.aud}`);
    }

    // Validate subject (sub)
    logger.debug("\t subject (sub): " + payload.sub);
    if (!payload.sub || typeof payload.sub !== "string") {
        throw new Error("Invalid subject (sub). It must be a non-empty string.");
    }

    // Validate issued at (iat)
    logger.debug("\t issued at (iat): " + payload.iat);
    if (!payload.iat || typeof payload.iat !== "number" || payload.iat > now) {
        // Debug statement for iat validation
        const iatDate = new Date(payload.iat * 1000).toISOString(); // Convert iat to human-readable format
        const nowDate = new Date(now * 1000).toISOString(); // Convert current timestamp to human-readable format
        logger.debug(`Debugging iat validation: payload.iat=${payload.iat} (${iatDate}), now=${now} (${nowDate}), isFuture=${payload.iat > now}`);
        throw new Error("Invalid issued at (iat). It must be a timestamp in the past.");
    }

    // Validate not before (nbf)
    logger.debug("\t not before (nbf): " + payload.nbf);
    if (!payload.nbf || typeof payload.nbf !== "number" || payload.nbf > now) {
        throw new Error("Invalid not before (nbf). It must be a timestamp in the past.");
    }

    // Validate expiration time (exp)
    logger.debug("\t expiration time (exp): " + payload.exp);
    if (!payload.exp || typeof payload.exp !== "number" || payload.exp <= now) {
        throw new Error("Invalid expiration time (exp). It must be a timestamp in the future.");
    }

    // Validate actor (act)
    logger.debug("\t actor (act): "+ util.inspect(payload.act));
    if (!payload.act || payload.act.sub !== ACTOR) {
        throw new Error("Invalid actor (act). Expected: "+ ACTOR +", Received: " + payload.act.sub);
    }

    return true; // All validations passed
}

// Export the functions
export { getSigningKey, isValidJWT };