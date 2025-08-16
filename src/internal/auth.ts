
import { createHash, randomBytes, randomUUID } from "crypto";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { httpCallWithTimeout } from "./http";

export class AuthManager {
    private authAborter = new AbortController();
    private authRenewer: NodeJS.Timeout | null = null;
    private codeChallenges: Record<string, string> = {};
    private authToken = "";
    private refreshToken = "";
    private tokenExpiresAt = 0;

    init(refreshToken: string) {
        this.refreshToken = refreshToken;
    }

    canConnect(): boolean {
        return !!this.refreshToken;
    }

    async connect(): Promise<void> {
        if (!this.canConnect()) {
            throw new Error(`Cannot connect Kick integration: No refresh token available.`);
        }

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Auth manager connecting...`);

        this.authAborter = new AbortController();

        try {
            await this.refreshAuthToken();
        } catch (error) {
            this.disconnect();
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to refresh Kick tokens: ${error}`);
            throw error;
        }

        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Auth manager connected.`);
    }

    disconnect(): void {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Auth manager disconnecting...`);
        this.authAborter.abort();
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
            this.authRenewer = null;
        }
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Auth manager disconnected.`);
    }

    getAuthToken(): string {
        if (this.authToken && this.tokenExpiresAt > Date.now()) {
            return this.authToken;
        }

        if (this.authToken) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] getAuthToken(): Auth token expired and has not yet been renewed`);
            return "";
        }

        // If we reach this point, it means the auth token is not available
        logger.error(`[${IntegrationConstants.INTEGRATION_ID}] getAuthToken(): Auth token was never generated`);
        return "";
    }

    getAuthorizationRequestUrl(): string {
        // Generate a random state value using uuidv4
        const state = randomUUID();

        // Generate a PKCE code challenge and verifier
        const { challenge: codeChallengeSha256, verifier: randomVerifier } = this.generatePKCEPair();
        this.codeChallenges[state] = randomVerifier;

        // Depending on configuration, use either the webhook proxy or direct authorization
        if (integration.getSettings().webhookProxy.webhookProxyUrl) {
            return this.getAuthorizationRequestUrlWebhookProxy(state, codeChallengeSha256);
        }
        if (integration.getSettings().kickApp.clientId && integration.getSettings().kickApp.clientSecret) {
            return this.getAuthorizationRequestUrlDirect(state, codeChallengeSha256);
        }
        throw new Error("Cannot generate authorization URL: Missing webhook proxy URL or client credentials.");
    }

    private getLocalRedirectUri(): string {
        return `${integration.getSettings().connectivity.firebotUrl}/integrations/${IntegrationConstants.INTEGRATION_URI}/callback`;
    }

    private getAuthorizationRequestUrlWebhookProxy(state: string, codeChallengeSha256: string): string {
        // Upstream webhook proxy adds the client ID
        const params = new URLSearchParams({
            // eslint-disable-next-line camelcase
            redirect_uri: this.getLocalRedirectUri(),
            scope: IntegrationConstants.SCOPES.join(" "),
            // eslint-disable-next-line camelcase
            code_challenge: codeChallengeSha256,
            // eslint-disable-next-line camelcase
            code_challenge_method: "S256",
            state
        });
        const queryString = params.toString();
        const authUrl = `${integration.getSettings().webhookProxy.webhookProxyUrl}/auth/authorize?${queryString}`;
        return authUrl;
    }

    private getAuthorizationRequestUrlDirect(state: string, codeChallengeSha256: string): string {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Generating authorization URL for Kick app...`);
        if (!integration.getSettings().kickApp.clientId || !integration.getSettings().kickApp.clientSecret) {
            throw new Error("Kick app client ID or secret is not set in settings.");
        }

        const params = new URLSearchParams({
            // eslint-disable-next-line camelcase
            redirect_uri: this.getLocalRedirectUri(),
            scope: IntegrationConstants.SCOPES.join(" "),
            // eslint-disable-next-line camelcase
            code_challenge: codeChallengeSha256,
            // eslint-disable-next-line camelcase
            code_challenge_method: "S256",
            // eslint-disable-next-line camelcase
            client_id: integration.getSettings().kickApp.clientId || "",
            // eslint-disable-next-line camelcase
            response_type: "code",
            state
        });
        const queryString = params.toString();
        const authUrl = `${IntegrationConstants.KICK_AUTH_SERVER}/oauth/authorize?${queryString}`;
        return authUrl;
    }

    unlink() {
        this.authToken = "";
        this.refreshToken = "";
        this.tokenExpiresAt = 0;
        this.codeChallenges = {};
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
            this.authRenewer = null;
        }
        this.authAborter.abort();
    }

    private generatePKCEPair() {
        const NUM_OF_BYTES = 22; // Total of 44 characters (1 Bytes = 2 char) (standard states that: 43 chars <= verifier <= 128 chars)
        const HASH_ALG = "sha256";
        const randomVerifier = randomBytes(NUM_OF_BYTES).toString('hex'); // Generate a random string for the code verifier
        const hash = createHash(HASH_ALG).update(randomVerifier).digest('base64');
        const challenge = hash.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // Clean base64 to make it URL safe
        return {verifier: randomVerifier, challenge};
    }

    async handleAuthCallback(req: any, res: any) {
        const { code, state } = req.query;
        if (!code || !state) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Missing 'code' or 'state' in auth callback.`);
            res.status(400).send("Missing 'code' or 'state' in callback.");
            return;
        }
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] handleAuthCallback received code for state: ${state}`);

        const payload = {
            // eslint-disable-next-line camelcase
            grant_type: "authorization_code",
            code: code,
            // eslint-disable-next-line camelcase
            code_verifier: this.codeChallenges[state]
        };

        let url = "";
        let payloadString = "";

        if (integration.getSettings().webhookProxy.webhookProxyUrl) {
            url = `${integration.getSettings().webhookProxy.webhookProxyUrl}/auth/token`;
            payloadString = JSON.stringify(payload);
        } else {
            url = `${IntegrationConstants.KICK_AUTH_SERVER}/oauth/token`;
            // eslint-disable-next-line camelcase
            Object.assign(payload, { client_id: integration.getSettings().kickApp.clientId || "" });
            // eslint-disable-next-line camelcase
            Object.assign(payload, { client_secret: integration.getSettings().kickApp.clientSecret || "" });
            // eslint-disable-next-line camelcase
            Object.assign(payload, { redirect_uri: this.getLocalRedirectUri() });
            payloadString = new URLSearchParams(payload).toString();
        }

        try {
            const response = await httpCallWithTimeout(url, 'POST', '', payloadString);
            this.authToken = response.access_token;
            this.refreshToken = response.refresh_token;
            const proxyPollKey = response.proxy_poll_key || "";
            this.tokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
            integration.kick.setAuthToken(this.authToken);
            integration.saveIntegrationTokenData(this.refreshToken, proxyPollKey);
            integration.connect();

            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration connected successfully!`);
            res.status(200).send("Kick integration connected successfully! You can close this tab.");
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to exchange code for tokens: ${error}`);
            res.status(500).send(`Failed to exchange code for tokens: ${error}`);
        }
    }

    async handleLinkCallback(req: any, res: any) {
        try {
            const authUrl = this.getAuthorizationRequestUrl();
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Redirecting user to authorization URL: ${authUrl}`);
            res.redirect(authUrl);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error handling link callback: ${error}`);
            res.status(500).send(`Error handling link callback: ${error}`);
        }
    }

    private async refreshAuthToken(): Promise<boolean> {
        try {
            await this.refreshAuthTokenReal();
            this.scheduleNextRenewal(this.tokenExpiresAt - Date.now() - 300000); // Refresh 5 minutes before expiration
            return true;
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error refreshing auth token: ${error}`);

            if (!this.refreshToken) {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Refresh token is missing. Disconnecting integration.`);
                this.disconnect();

                const { frontendCommunicator } = firebot.modules;
                frontendCommunicator.send("error", "Kick Integration: Your refresh token is invalid. Please re-link the integration.");
            } else {
                this.scheduleNextRenewal(10000); // Try again in 10 seconds if there's an error
            }
            return false;
        }
    }

    private async refreshAuthTokenReal() {
        const payload = {
            // eslint-disable-next-line camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line camelcase
            refresh_token: this.refreshToken
        };

        let url = "";
        let payloadString = "";

        if (integration.getSettings().webhookProxy.webhookProxyUrl) {
            url = `${integration.getSettings().webhookProxy.webhookProxyUrl}/auth/token`;
            payloadString = JSON.stringify(payload);
        } else {
            url = `${IntegrationConstants.KICK_AUTH_SERVER}/oauth/token`;
            // eslint-disable-next-line camelcase
            Object.assign(payload, { client_id: integration.getSettings().kickApp.clientId || "" });
            // eslint-disable-next-line camelcase
            Object.assign(payload, { client_secret: integration.getSettings().kickApp.clientSecret || "" });
            // eslint-disable-next-line camelcase
            Object.assign(payload, { redirect_uri: this.getLocalRedirectUri() });
            payloadString = new URLSearchParams(payload).toString();
        }

        const response = await httpCallWithTimeout(url, 'POST', '', payloadString);
        this.authToken = response.access_token;
        this.tokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
        this.refreshToken = response.refresh_token;
        integration.kick.setAuthToken(this.authToken);
        integration.saveIntegrationTokenData(this.refreshToken);
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration tokens refreshed successfully. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);
    }

    private scheduleNextRenewal(delay: number) {
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
        }
        this.authRenewer = setTimeout(async () => {
            await this.refreshAuthToken();
        }, delay);
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Next auth token renewal scheduled at ${new Date(Date.now() + delay).toISOString()}.`);
    }
}
