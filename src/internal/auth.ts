import { createHash, randomBytes, randomUUID } from "crypto";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { HttpCallRequest, httpCallWithTimeout } from "./http";

export class AuthManager {
    private authAborter = new AbortController();
    private streamerAuthRenewer: NodeJS.Timeout | null = null;
    private botAuthRenewer: NodeJS.Timeout | null = null;
    private codeChallenges: Record<string, string> = {};
    private tokenRequests: Record<string, 'streamer' | 'bot'> = {};
    private streamerAuthToken = "";
    streamerRefreshToken = "";
    private streamerTokenExpiresAt = 0;
    private streamerMissingScopes: string[] = [];
    private botAuthToken = "";
    botRefreshToken = "";
    private botTokenExpiresAt = 0;
    private botMissingScopes: string[] = [];

    init(refreshToken: string, botRefreshToken: string) {
        this.streamerRefreshToken = refreshToken;
        this.botRefreshToken = botRefreshToken;
    }

    canConnect(): boolean {
        return !!this.streamerRefreshToken;
    }

    isBotAuthorized(): boolean {
        return !!this.botAuthToken;
    }

    async connect(): Promise<void> {
        if (!this.canConnect()) {
            throw new Error(`Cannot connect Kick integration: No refresh token available.`);
        }

        logger.debug("Auth manager connecting...");
        try {
            const streamerTokenRenewal = await this.refreshStreamerToken();
            if (!streamerTokenRenewal) {
                logger.error("Failed to refresh streamer auth token");
                throw new Error("Failed to refresh streamer auth token");
            }

            const botTokenRenewal = await this.refreshBotToken();
            if (!botTokenRenewal) {
                logger.error("Failed to refresh bot auth token");
                throw new Error("Failed to refresh bot auth token");
            }
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
        if (this.streamerAuthRenewer) {
            clearTimeout(this.streamerAuthRenewer);
            this.streamerAuthRenewer = null;
        }
        if (this.botAuthRenewer) {
            clearTimeout(this.botAuthRenewer);
            this.botAuthRenewer = null;
        }
        this.streamerAuthToken = "";
        this.streamerMissingScopes = [];
        this.botAuthToken = "";
        this.botMissingScopes = [];
        logger.info("Auth manager disconnected.");
    }

    async getStreamerAuthToken(): Promise<string> {
        if (!this.streamerAuthToken) {
            if (this.streamerRefreshToken) {
                await this.refreshAuthTokenReal('streamer');
            } else {
                integration.sendCriticalErrorNotification("Streamer refresh token is missing. Open the Kick Accounts screen to re-authorize the streamer account.");
                return "";
            }
        }

        if (this.streamerAuthToken && this.streamerTokenExpiresAt > Date.now()) {
            return this.streamerAuthToken;
        }

        if (this.streamerAuthToken) {
            logger.warn("getAuthToken(): Auth token expired and has not yet been renewed");
            return "";
        }

        // If we reach this point, it means the auth token is not available
        logger.error("getAuthToken(): Auth token was never generated");
        return "";
    }

    async getBotAuthToken(): Promise<string> {
        if (!this.botRefreshToken) {
            logger.debug("getBotAuthToken(): Bot account not authorized.");
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
        const webhookProxyUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/+$/, "");
        const authUrl = `${webhookProxyUrl}/auth/authorize?${queryString}`;
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
            const webhookProxyUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/+$/, "");
            url = `${webhookProxyUrl}/auth/token`;
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
            const req: HttpCallRequest = {
                url,
                method: 'POST',
                body: payloadString
            };
            const response = await httpCallWithTimeout(req);
            let missingScopes: string[] = [];

            if (tokenType === 'bot') {
                missingScopes = this.verifyTokenScopes(response.scope, IntegrationConstants.BOT_SCOPES, 'bot');

                if (integration.getSettings().webhookProxy.webhookProxyUrl && response.proxy_poll_key) {
                    logger.warn(`Received proxy_poll_key (${response.proxy_poll_key}) when authorizing bot account via webhook proxy`);
                    res.status(400).send(`<p>This account cannot be authorized as a bot account because it is configured as a streamer account in the webhook proxy.</p><p>Please contact the webhook proxy administrator if this is in error, or <a href="/integrations/${IntegrationConstants.INTEGRATION_URI}/link/streamer">authorize this account as the streamer account</a> if that is what you intended to do.</p>`);
                    return;
                }

                if (!integration.kick.broadcaster) {
                    logger.warn("Broadcaster info not available when verifying bot account during authorization");
                    res.status(400).send(`<p>A bot account cannot be authorized until the streamer account has been authorized.</p><p>Please <a href="/integrations/${IntegrationConstants.INTEGRATION_URI}/link/streamer">authorize a streamer account</a> first.</p>`);
                    return;
                }

                try {
                    const botUserInfo = await this.verifyBotUser(response.access_token);
                    if (botUserInfo.userId === integration.kick.broadcaster.userId) {
                        logger.error(`Same account authorization attempt: Bot user ID ${botUserInfo.userId} matches broadcaster user ID ${integration.kick.broadcaster.userId}`);
                        res.status(400).send(`<p>Error: Cannot authorize the same account for both streamer and bot. The account "${botUserInfo.name}" is already authorized as the streamer.</p><p>Please <a href="/integrations/${IntegrationConstants.INTEGRATION_URI}/link/bot">authorize a different account</a> for the bot. (Consider opening this link in an incognito window to prevent the same problem from happening again.)</p>`);
                        return;
                    }
                    logger.debug(`Bot authorization verified: Bot user ID ${botUserInfo.userId} is different from broadcaster user ID ${integration.kick.broadcaster.userId}`);
                } catch (verificationError) {
                    logger.error(`Failed to verify bot user during authorization: ${verificationError}`);
                    res.status(500).send(`<p>Failed to verify bot account: ${verificationError}</p>`);
                    return;
                }

                this.botAuthToken = response.access_token;
                this.botRefreshToken = response.refresh_token;
                this.botTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setBotAuthToken(this.botAuthToken);
                integration.saveIntegrationTokenData(this.streamerRefreshToken, this.botRefreshToken, null);
                logger.info(`Kick integration token for bot refreshed successfully. Valid until: ${new Date(this.botTokenExpiresAt).toISOString()}`);
            }

            if (tokenType === 'streamer') {
                missingScopes = this.verifyTokenScopes(response.scope, IntegrationConstants.STREAMER_SCOPES, 'streamer');

                if (integration.getSettings().webhookProxy.webhookProxyUrl && !response.proxy_poll_key) {
                    logger.warn("No proxy_poll_key when authorizing streamer account via webhook proxy");
                    res.status(400).send(`<p>This account cannot be authorized as a streamer account because it is configured as a bot account in the webhook proxy.</p><p>Please contact the webhook proxy administrator if you believe this is an error, or <a href="/integrations/${IntegrationConstants.INTEGRATION_URI}/link/bot">authorize this account as the bot account</a> if that is what you intended to do.</p>`);
                    return;
                }

                this.streamerAuthToken = response.access_token;
                this.streamerRefreshToken = response.refresh_token;
                this.streamerTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setAuthToken(this.streamerAuthToken);
                integration.saveIntegrationTokenData(this.streamerRefreshToken, this.botRefreshToken, response.proxy_poll_key);
                logger.info(`Kick integration token for streamer refreshed successfully. Valid until: ${new Date(this.streamerTokenExpiresAt).toISOString()}`);
            }

            integration.disconnect();
            integration.connect();

            logger.info("Kick integration connected successfully!");
            const successPage = this.buildAuthResultPage(tokenType, missingScopes);
            res.status(200).send(successPage);
        } catch (error) {
            logger.error(`Failed to exchange code for tokens: ${error}`);
            if (integration.getSettings().webhookProxy.webhookProxyUrl) {
                res.status(500).send(`<p>Failed to exchange code for tokens via webhook proxy: ${error}.</p><p>Please contact the webhook proxy administrator for assistance.</p>`);
            } else {
                res.status(500).send(`<p>Failed to exchange code for tokens: ${error}</p>`);
            }
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

    private buildAuthResultPage(tokenType: 'streamer' | 'bot', missingScopes: string[]): string {
        const readableTokenType = tokenType === 'streamer' ? "streamer account" : "bot account";
        const hasWarnings = missingScopes.length > 0;
        const missingScopeList = missingScopes.map(scope => `<li><code>${scope}</code></li>`).join("");
        const reauthorizeUrl = `/integrations/${IntegrationConstants.INTEGRATION_URI}/link/${tokenType}`;
        const warningBlock = missingScopes.length ? `
                <div class="warning">
                    <div class="warning-title">WARNING: Important permissions were not granted</div>
                    <p>Kick did not give this plugin every permission it needs. This usually means the Kick app is not set up to request the right permissions. Without them, chat tools and channel controls may not work.</p>
                    <p><strong>Fix this now:</strong></p>
                    <p><strong>1.</strong> Open the troubleshooting guide. Follow the instructions to add missing permissions to your Kick app.</p>
                    <p><strong>2.</strong> After updating permissions, click the "Try Again" button below to re-authorize the ${readableTokenType}.</p>
                    <div class="actions">
                        <a class="link" href="https://github.com/TheStaticMage/firebot-mage-kick-integration/blob/main/doc/troubleshooting.md" target="_blank" rel="noopener noreferrer">Open the troubleshooting guide</a>
                        <a class="link secondary" href="${reauthorizeUrl}">Try Again</a>
                    </div>
                    <div class="missing-list">
                        <p>Permissions missing right now:</p>
                        <ul>${missingScopeList}</ul>
                    </div>
                </div>
            ` : "";

        const headingText = hasWarnings
            ? `Kick integration partially authorized for ${readableTokenType}!`
            : `Kick integration authorized for ${readableTokenType}!`;
        const subText = hasWarnings
            ? "Please fix the missing permissions below and authorize again before closing this window."
            : "You can close this window.";

        return `
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kick integration authorized</title>
    <style>
        * { box-sizing: border-box; }
        body {
            margin: 0;
            padding: 24px;
            background: linear-gradient(135deg, #0b132b, #1c2541);
            color: #0b132b;
            font-family: "Segoe UI", Arial, sans-serif;
        }
        .page {
            max-width: 760px;
            margin: 0 auto;
        }
        .card {
            background: #ffffff;
            border-radius: 12px;
            padding: 28px;
            box-shadow: 0 12px 30px rgba(0, 0, 0, 0.25);
        }
        .headline {
            display: flex;
            align-items: center;
            gap: 16px;
            margin-bottom: 8px;
        }
        .status {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #2fbf71;
            box-shadow: 0 0 0 6px rgba(47, 191, 113, 0.15);
        }
        h1 {
            margin: 0;
            font-size: 26px;
            color: #0b132b;
        }
        p {
            margin: 10px 0;
            line-height: 1.6;
        }
        .warning {
            margin-top: 20px;
            padding: 16px 18px;
            background: #fff8d6;
            border: 3px solid #b22222;
            border-radius: 12px;
            color: #4a1c1c;
        }
        .warning-title {
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 8px;
            letter-spacing: 0.5px;
        }
        .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 10px;
            margin: 8px 0 12px;
        }
        .link {
            display: inline-block;
            padding: 10px 14px;
            background: #b22222;
            color: #ffffff;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
        }
        .link:hover {
            background: #8f1b1b;
        }
        .link.secondary {
            background: #ffffff;
            color: #b22222;
            border: 2px solid #b22222;
        }
        .link.secondary:hover {
            background: #fceaea;
        }
        .missing-list {
            margin-top: 10px;
            padding: 10px 12px;
            background: #ffffff;
            border-radius: 8px;
            border: 1px dashed #b22222;
        }
        .inline-link {
            color: #b22222;
            font-weight: 700;
        }
        .inline-link:hover {
            color: #8f1b1b;
        }
        ul {
            margin: 6px 0;
            padding-left: 20px;
        }
        code {
            background: #f1f1f1;
            padding: 2px 4px;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="card">
            <div class="headline">
                <div class="status" aria-hidden="true"></div>
                <div>
                    <h1>${headingText}</h1>
                    <p>${subText}</p>
                </div>
            </div>
            ${warningBlock}
        </div>
    </div>
</body>
</html>
        `;
    }

    private async refreshStreamerToken(): Promise<boolean> {
        // Streamer token is required - check for missing token upfront
        if (!this.streamerRefreshToken) {
            logger.error("Streamer refresh token is missing. Disconnecting integration.");
            this.disconnect();
            integration.sendCriticalErrorNotification("You need to authorize the streamer account. Open the Kick Accounts screen to set up authorization.");
            return false;
        }

        try {
            await this.refreshAuthTokenReal('streamer');
            this.scheduleNextStreamerTokenRenewal(this.streamerTokenExpiresAt - Date.now() - 300000); // Refresh 5 minutes before expiration
            return true;
        } catch (error) {
            logger.error(`Error refreshing streamer auth token: ${error}`);
            this.scheduleNextStreamerTokenRenewal(10000); // Try again in 10 seconds if there's an error
        }
        return false;
    }

    private async refreshBotToken(): Promise<boolean> {
        // Bot token is optional - if not provided, just log and return success
        if (!this.botRefreshToken) {
            logger.info("Bot refresh token is not configured. Skipping bot token refresh.");
            return true;
        }

        try {
            await this.refreshAuthTokenReal('bot');
            this.scheduleNextBotTokenRenewal(this.botTokenExpiresAt - Date.now() - 300000); // Refresh 5 minutes before expiration
            return true;
        } catch (error) {
            logger.error(`Error refreshing bot auth token: ${error}`);
            this.scheduleNextBotTokenRenewal(10000); // Try again in 10 seconds if there's an error
        }
        return false;
    }

    private async refreshAuthTokenReal(tokenType: 'streamer' | 'bot') {
        const payload = {
            // eslint-disable-next-line camelcase
            grant_type: "refresh_token",
            // eslint-disable-next-line camelcase
            refresh_token: tokenType === 'streamer' ? this.streamerRefreshToken : this.botRefreshToken
        };

        let url = "";
        let payloadString = "";

        if (integration.getSettings().webhookProxy.webhookProxyUrl) {
            const webhookProxyUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/+$/, "");
            url = `${webhookProxyUrl}/auth/token`;
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
            const req: HttpCallRequest = {
                url,
                method: 'POST',
                body: payloadString
            };
            const response = await httpCallWithTimeout(req);
            const expectedScopes = tokenType === 'streamer' ? IntegrationConstants.STREAMER_SCOPES : IntegrationConstants.BOT_SCOPES;
            this.verifyTokenScopes(response.scope, expectedScopes, tokenType);

            if (tokenType === 'streamer') {
                this.streamerAuthToken = response.access_token;
                this.streamerRefreshToken = response.refresh_token;
                this.streamerTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setAuthToken(this.streamerAuthToken);
                logger.info(`Kick integration token for streamer refreshed successfully. Valid until: ${new Date(this.streamerTokenExpiresAt).toISOString()}`);
            } else {
                this.botAuthToken = response.access_token;
                this.botRefreshToken = response.refresh_token;
                this.botTokenExpiresAt = Date.now() + (response.expires_in * 1000); // Convert seconds to milliseconds
                integration.kick.setBotAuthToken(this.botAuthToken);
                logger.info(`Kick integration token for bot refreshed successfully. Valid until: ${new Date(this.botTokenExpiresAt).toISOString()}`);
            }
        } catch (error: any) {
            // Check if error has a status property and handle 401 specifically
            if (error && typeof error === 'object' && 'status' in error && error.status === 401) {
                integration.sendCriticalErrorNotification(`Kick integration ${tokenType} refresh token is invalid. Open the Kick Accounts screen to re-authorize the ${tokenType} account.`);
                if (tokenType === 'streamer') {
                    this.streamerRefreshToken = "";
                    this.streamerMissingScopes = [];
                } else {
                    this.botRefreshToken = "";
                    this.botMissingScopes = [];
                }
                logger.error(`Kick integration ${tokenType} refresh token is invalid. Please re-authorize.`);
                return;
            }

            logger.error(`Error refreshing ${tokenType} auth token: ${error}`);
            throw error;
        } finally {
            integration.saveIntegrationTokenData(this.streamerRefreshToken, this.botRefreshToken);
        }
    }

    private scheduleNextStreamerTokenRenewal(delay: number) {
        if (this.streamerAuthRenewer) {
            clearTimeout(this.streamerAuthRenewer);
        }
        this.streamerAuthRenewer = setTimeout(async () => {
            try {
                await this.refreshStreamerToken();
            } catch (error) {
                logger.error(`Uncaught error in scheduled streamer token renewal: ${error}`);
            }
        }, delay);
        logger.debug(`Next streamer auth token renewal scheduled at ${new Date(Date.now() + delay).toISOString()}.`);
    }

    private scheduleNextBotTokenRenewal(delay: number) {
        if (this.botAuthRenewer) {
            clearTimeout(this.botAuthRenewer);
        }
        this.botAuthRenewer = setTimeout(async () => {
            try {
                await this.refreshBotToken();
            } catch (error) {
                logger.error(`Uncaught error in scheduled bot token renewal: ${error}`);
            }
        }, delay);
        logger.debug(`Next bot auth token renewal scheduled at ${new Date(Date.now() + delay).toISOString()}.`);
    }

    private verifyTokenScopes(
        tokenScope: string | string[] | undefined,
        expectedScopes: readonly string[],
        tokenType: 'streamer' | 'bot'
    ): string[] {
        const scopesFromToken = Array.isArray(tokenScope)
            ? tokenScope
            : typeof tokenScope === 'string'
                ? tokenScope.split(/\s+/).filter(scope => scope.trim().length > 0)
                : [];
        const normalizedScopes = scopesFromToken.map(scope => scope.trim()).filter(scope => scope.length > 0);
        const missingScopes = expectedScopes.filter(expected => !normalizedScopes.includes(expected));
        this.setMissingScopes(tokenType, missingScopes);
        if (missingScopes.length) {
            logger.error(`Missing required ${tokenType} token scopes: ${missingScopes.join(', ')}`);
            integration.sendCriticalErrorNotification(`The Kick ${tokenType} token is missing required scopes (${missingScopes.join(', ')}). This will cause certain functionality to break. To fix this problem, open the Kick Accounts screen and re-authorize the ${tokenType} account.`);
        } else {
            logger.debug(`Scope check for ${tokenType} token passed. All required scopes are present. ${scopesFromToken.join(', ')}`);
        }
        return missingScopes;
    }

    private setMissingScopes(tokenType: 'streamer' | 'bot', missingScopes: string[]): void {
        if (tokenType === 'streamer') {
            this.streamerMissingScopes = missingScopes;
        } else {
            this.botMissingScopes = missingScopes;
        }
    }

    private async verifyBotUser(botToken: string): Promise<{ userId: number; name: string }> {
        const req: HttpCallRequest = {
            url: `${IntegrationConstants.KICK_API_SERVER}/public/v1/users`,
            method: 'GET',
            authToken: botToken
        };
        const response = await httpCallWithTimeout(req);

        if (!response || !response.data || response.data.length !== 1) {
            throw new Error("Failed to retrieve bot user from Kick API.");
        }

        const userData = response.data[0];
        if (!userData.user_id) {
            logger.warn(`Bot user data from Kick API is missing ID: ${JSON.stringify(userData)}`);
            throw new Error("No user ID found in bot user API response.");
        }

        return {
            userId: userData.user_id,
            name: userData.name || 'Unknown'
        };
    }

    getStreamerConnectionStatus(): { ready: boolean; tokenExpiresAt: number; missingScopes: string[] } {
        return {
            ready: !!this.streamerRefreshToken && !!this.streamerAuthToken,
            tokenExpiresAt: this.streamerTokenExpiresAt || 0,
            missingScopes: this.streamerMissingScopes || []
        };
    }

    getBotConnectionStatus(): { ready: boolean; tokenExpiresAt: number; missingScopes: string[] } {
        return {
            ready: !!this.botRefreshToken && !!this.botAuthToken,
            tokenExpiresAt: this.botTokenExpiresAt || 0,
            missingScopes: this.botMissingScopes || []
        };
    }

    async deauthorizeStreamer(): Promise<void> {
        logger.debug("Deauthorizing streamer account...");
        this.streamerRefreshToken = "";
        this.streamerAuthToken = "";
        this.streamerTokenExpiresAt = 0;
        this.streamerMissingScopes = [];
        if (this.streamerAuthRenewer) {
            clearTimeout(this.streamerAuthRenewer);
            this.streamerAuthRenewer = null;
        }
        integration.saveIntegrationTokenData(this.streamerRefreshToken, this.botRefreshToken);
        logger.info("Streamer account deauthorized.");
    }

    async deauthorizeBot(): Promise<void> {
        logger.debug("Deauthorizing bot account...");
        this.botRefreshToken = "";
        this.botAuthToken = "";
        this.botTokenExpiresAt = 0;
        this.botMissingScopes = [];
        if (this.botAuthRenewer) {
            clearTimeout(this.botAuthRenewer);
            this.botAuthRenewer = null;
        }
        integration.saveIntegrationTokenData(this.streamerRefreshToken, this.botRefreshToken);
        logger.info("Bot account deauthorized.");
    }

    registerUIExtensionEvents(frontendCommunicator: any, firebotUrl: string, notifyConnectionStateChange: () => void): void {
        if (!frontendCommunicator) {
            logger.warn("Frontend communicator not available for UI extension events");
            return;
        }

        frontendCommunicator.onAsync("kick:get-connections", async () => {
            notifyConnectionStateChange();
            return null;
        });

        frontendCommunicator.on("kick:authorize-streamer", () => {
            const authUrl = `${firebotUrl}/integrations/${IntegrationConstants.INTEGRATION_URI}/link/streamer`;
            frontendCommunicator.send("kick:streamer-auth-url", authUrl);
        });

        frontendCommunicator.on("kick:authorize-bot", () => {
            const authUrl = `${firebotUrl}/integrations/${IntegrationConstants.INTEGRATION_URI}/link/bot`;
            frontendCommunicator.send("kick:bot-auth-url", authUrl);
        });

        frontendCommunicator.onAsync("kick:deauthorize-streamer", async () => {
            try {
                await this.deauthorizeStreamer();
                notifyConnectionStateChange();
            } catch (error: any) {
                logger.error(`Failed to deauthorize streamer: ${error.message}`);
            }
            return null;
        });

        frontendCommunicator.onAsync("kick:deauthorize-bot", async () => {
            try {
                await this.deauthorizeBot();
                notifyConnectionStateChange();
            } catch (error: any) {
                logger.error(`Failed to deauthorize bot: ${error.message}`);
            }
            return null;
        });
    }
}
