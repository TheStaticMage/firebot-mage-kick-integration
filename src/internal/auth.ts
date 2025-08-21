import { createHash, randomBytes, randomUUID } from "crypto";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { httpCallWithTimeout } from "./http";

export class AuthManager {
    private authAborter = new AbortController();
    private authRenewer: NodeJS.Timeout | null = null;
    private codeChallenges: Record<string, string> = {};
    private tokenRequests: Record<string, 'streamer' | 'bot'> = {};
    private authToken = "";
    private refreshToken = "";
    private tokenExpiresAt = 0;
    private botAuthToken = "";
    private botRefreshToken = "";
    private botTokenExpiresAt = 0;

    init(refreshToken: string, botRefreshToken: string) {
        this.refreshToken = refreshToken;
        this.botRefreshToken = botRefreshToken;
    }

    canConnect(): boolean {
        return !!this.refreshToken;
    }

    isBotAuthorized(): boolean {
        return !!this.botAuthToken;
    }

    async connect(): Promise<void> {
        if (!this.canConnect()) {
            throw new Error(`Cannot connect Kick integration: No refresh token available.`);
        }

        logger.debug("Auth manager connecting...");

        this.authAborter = new AbortController();

        try {
            await this.refreshAuthTokens();
        } catch (error) {
            this.disconnect();
            logger.error(`Failed to refresh Kick tokens: ${error}`);
            throw error;
        }

        logger.info("Auth manager connected.");
    }

    disconnect(): void {
        logger.debug("Auth manager disconnecting...");
        this.authAborter.abort();
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
            this.authRenewer = null;
        }
        logger.info("Auth manager disconnected.");
    }

    async getAuthToken(): Promise<string> {
        if (!this.authToken) {
            await this.refreshAuthTokenReal('streamer');
        }

        if (this.authToken && this.tokenExpiresAt > Date.now()) {
            return this.authToken;
        }

        if (this.authToken) {
            logger.warn("getAuthToken(): Auth token expired and has not yet been renewed");
            return "";
        }

        // If we reach this point, it means the auth token is not available
        logger.error("getAuthToken(): Auth token was never generated");
        return "";
    }

    async getBotAuthToken(): Promise<string> {
        if (!integration.getSettings().accounts.authorizeBotAccount) {
            logger.debug("getBotAuthToken(): Bot account authorization is disabled.");
            return "";
        }

        if (!this.botAuthToken) {
            await this.refreshAuthTokenReal('bot');
        }

        if (this.botAuthToken && this.botTokenExpiresAt > Date.now()) {
            return this.botAuthToken;
        }

        if (this.botAuthToken) {
            logger.warn("getBotAuthToken(): Bot auth token expired and has not yet been renewed");
            return "";
        }

        // If we reach this point, it means the bot auth token is not available
        logger.error("getBotAuthToken(): Bot auth token was never generated");
        return "";
    }

    getAuthorizationRequestUrl(tokenType: 'streamer' | 'bot'): string {
        // Generate a random state value using uuidv4
        const state = randomUUID();

        // Generate a PKCE code challenge and verifier
        const { challenge: codeChallengeSha256, verifier: randomVerifier } = this.generatePKCEPair();
        this.codeChallenges[state] = randomVerifier;

        // Are we getting this for the streamer or bot?
        this.tokenRequests[state] = tokenType;

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
        const tokenType = this.tokenRequests[state];

        // Upstream webhook proxy adds the client ID
        const params = new URLSearchParams({
            // eslint-disable-next-line camelcase
            redirect_uri: this.getLocalRedirectUri(),
            scope: (tokenType === 'streamer' ? IntegrationConstants.STREAMER_SCOPES : IntegrationConstants.BOT_SCOPES).join(" "),
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
        logger.debug("Generating authorization URL for Kick app...");
        if (!integration.getSettings().kickApp.clientId || !integration.getSettings().kickApp.clientSecret) {
            throw new Error("Kick app client ID or secret is not set in settings.");
        }

        const tokenType = this.tokenRequests[state];

        const params = new URLSearchParams({
            // eslint-disable-next-line camelcase
            redirect_uri: this.getLocalRedirectUri(),
            scope: (tokenType === 'streamer' ? IntegrationConstants.STREAMER_SCOPES : IntegrationConstants.BOT_SCOPES).join(" "),
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
            logger.error("Missing 'code' or 'state' in auth callback.");
            res.status(400).send("Missing 'code' or 'state' in callback.");
            return;
        }

        logger.info(`handleAuthCallback received code for state: ${state}`);
        const tokenType = this.tokenRequests[state];
        if (!tokenType) {
            logger.error(`Unknown token type for state: ${state}`);
            res.status(400).send(`Unknown token type for state: ${state}`);
            return;
        }

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

            if (tokenType === 'streamer') {
                this.authToken = response.access_token;
                this.refreshToken = response.refresh_token;
                this.tokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setAuthToken(this.authToken);
                logger.info(`Kick integration token for streamer refreshed successfully. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);
            } else {
                this.botAuthToken = response.access_token;
                this.botRefreshToken = response.refresh_token;
                this.botTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setBotAuthToken(this.botAuthToken);
                logger.info(`Kick integration token for bot refreshed successfully. Valid until: ${new Date(this.botTokenExpiresAt).toISOString()}`);
            }

            integration.saveIntegrationTokenData(this.refreshToken, this.botRefreshToken, tokenType === 'streamer' ? response.proxy_poll_key : null);
            integration.disconnect();
            integration.connect();

            logger.info("Kick integration connected successfully!");
            res.status(200).send(`Kick integration authorized for ${tokenType}! You can close this tab. (Be sure to save the integration settings in Firebot if you have that window open.)`);
        } catch (error) {
            logger.error(`Failed to exchange code for tokens: ${error}`);
            res.status(500).send(`Failed to exchange code for tokens: ${error}`);
        }
    }

    async handleLinkCallback(req: any, res: any) {
        let tokenType: 'streamer' | 'bot' = 'streamer';

        if (req.path.endsWith('/bot')) {
            tokenType = 'bot';
        } else if (req.path.endsWith('/streamer')) {
            tokenType = 'streamer';
        } else {
            res.status(400).send(`Invalid token type requested - Make sure you copy the URL exactly from Firebot!`);
            return;
        }

        try {
            const authUrl = this.getAuthorizationRequestUrl(tokenType);
            logger.debug(`Redirecting user to authorization URL: ${authUrl}`);
            res.redirect(authUrl);
        } catch (error) {
            logger.error(`Error handling link callback: ${error}`);
            res.status(500).send(`Error handling link callback: ${error}`);
        }
    }

    private async refreshAuthTokens(): Promise<boolean> {
        try {
            await this.refreshAuthTokenReal('streamer');
            this.scheduleNextRenewal(this.tokenExpiresAt - Date.now() - 300000); // Refresh 5 minutes before expiration
        } catch (error) {
            logger.error(`Error refreshing streamer auth token: ${error}`);

            if (!this.refreshToken) {
                logger.error("Streamer refresh token is missing. Disconnecting integration.");
                this.disconnect();

                const { frontendCommunicator } = firebot.modules;
                frontendCommunicator.send("error", "Kick Integration: Your refresh token is invalid. Please re-authorize the streamer account.");
            } else {
                this.scheduleNextRenewal(10000); // Try again in 10 seconds if there's an error
            }
            return false;
        }

        if (integration.getSettings().accounts.authorizeBotAccount && this.botRefreshToken) {
            try {
                await this.refreshAuthTokenReal('bot');
            } catch (error) {
                logger.error(`Error refreshing bot auth token: ${error}`);
            }
        }

        return true;
    }

    private async refreshAuthTokenReal(tokenType: 'streamer' | 'bot') {
        const payload = {
            // eslint-disable-next-line camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line camelcase
            refresh_token: tokenType === 'streamer' ? this.refreshToken : this.botRefreshToken
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
        if (tokenType === 'streamer') {
            this.authToken = response.access_token;
            this.refreshToken = response.refresh_token;
            this.tokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
            integration.kick.setAuthToken(this.authToken);
            logger.info(`Kick integration token for streamer refreshed successfully. Valid until: ${new Date(this.tokenExpiresAt).toISOString()}`);
        } else {
            this.botAuthToken = response.access_token;
            this.botRefreshToken = response.refresh_token;
            this.botTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
            integration.kick.setBotAuthToken(this.botAuthToken);
            logger.info(`Kick integration token for bot refreshed successfully. Valid until: ${new Date(this.botTokenExpiresAt).toISOString()}`);
        }
        integration.saveIntegrationTokenData(this.refreshToken, this.botRefreshToken);
    }

    private scheduleNextRenewal(delay: number) {
        if (this.authRenewer) {
            clearTimeout(this.authRenewer);
        }
        this.authRenewer = setTimeout(async () => {
            await this.refreshAuthTokens();
        }, delay);
        logger.debug(`Next auth token renewal scheduled at ${new Date(Date.now() + delay).toISOString()}.`);
    }
}
