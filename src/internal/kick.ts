import crypto from "crypto";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { BasicKickUser } from "../shared/types";
import { KickChannelManager } from "./channel-manager";
import { ChatManager } from "./chat-manager";
import { HttpCallRequest, httpCallWithTimeout } from "./http";
import { IKick } from "./kick-interface";
import { RewardsManager } from "./rewards-manager";
import { RoleManager } from "./role-manager";
import { KickUserApi } from "./user-api";
import { KickUserManager } from "./user-manager";
import { parseBasicKickUser } from "./webhook-handler/webhook-parsers";
import { WebhookSubscriptionManager } from "./webhook-subscription-manager";

export class Kick implements IKick {
    private apiAborter = new AbortController();
    private authToken = "";
    private botAuthToken = "";
    bot: BasicKickUser | null = null;
    broadcaster: BasicKickUser | null = null;
    channelManager: KickChannelManager;
    chatManager: ChatManager;
    rewardsManager: RewardsManager;
    roleManager: RoleManager;
    webhookSubscriptionManager: WebhookSubscriptionManager;
    userApi: KickUserApi;
    userManager: KickUserManager;

    constructor() {
        this.channelManager = new KickChannelManager(this);
        this.chatManager = new ChatManager(this);
        this.rewardsManager = new RewardsManager(this);
        this.roleManager = new RoleManager(this);
        this.userApi = new KickUserApi(this);
        this.userManager = new KickUserManager(this);
        this.webhookSubscriptionManager = new WebhookSubscriptionManager(this);
    }

    async connect(token: string, botToken: string): Promise<void> {
        logger.debug("Kick API integration connecting...");

        this.setAuthToken(token);
        this.setBotAuthToken(botToken);
        this.apiAborter = new AbortController();

        try {
            try {
                this.broadcaster = await this.userManager.lookupUserById();
            } catch (error) {
                logger.error(`Failed to get broadcaster ID: ${error}`);
                throw error;
            }

            if (botToken) {
                try {
                    const uri = `/public/v1/users`;
                    const response = await this.httpCallWithTimeout(uri, "GET", '', null, 10000, botToken);

                    if (!response || !response.data || response.data.length !== 1) {
                        logger.debug(`Failed to retrieve user from Kick API response. ${JSON.stringify(response)}`);
                        throw new Error("Failed to retrieve user from Kick API.");
                    }

                    const user = parseBasicKickUser(response.data[0]);
                    if (!user.userId) {
                        logger.debug("No user ID found in Kick API response.");
                        throw new Error("No user ID found in Kick API response.");
                    }

                    logger.debug(`Successfully retrieved bot user: ${user.userId} (${user.name})`);
                    this.bot = user;
                } catch (error) {
                    logger.error(`Failed to get bot user: ${error}`);
                    throw error;
                }
            } else {
                logger.debug("No bot token is given.");
                this.bot = null;
            }

            // Check for same account used for both streamer and bot
            if (this.broadcaster && this.bot && this.broadcaster.userId === this.bot.userId) {
                logger.warn(`Same account detected: User ID ${this.broadcaster.userId} (${this.broadcaster.name}) is authorized for both streamer and bot. Bot functionality will be disabled.`);
                this.bot = null;
                integration.sendCriticalErrorNotification(`Bot account is the same as streamer account (${this.broadcaster.name}). Bot functionality has been disabled. Please authorize a different account for the bot in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`);
            }

            try {
                await this.webhookSubscriptionManager.initialize();
            } catch (error) {
                logger.error(`Failed to subscribe to events: ${error}`);
                throw error;
            }

            this.channelManager.start();
            await this.chatManager.start();
            this.userApi.start();
            await this.userManager.connectViewerDatabase();
            logger.info("Kick API integration connected.");
        } catch (error) {
            logger.error(`Failed to connect Kick API integration: ${error}`);
            await this.disconnect();
            throw new Error(`Failed to connect Kick API integration: ${error}`);
        }
    }

    async disconnect(): Promise<void> {
        logger.debug("Kick API integration disconnecting...");
        this.webhookSubscriptionManager.shutdown();
        this.apiAborter.abort();
        this.channelManager.stop();
        await this.chatManager.stop();
        this.userApi.stop();
        this.userManager.disconnectViewerDatabase();
        this.apiAborter = new AbortController();
        logger.info("Kick API integration disconnected.");
    }

    getAuthToken(): string {
        return this.authToken;
    }

    setAuthToken(token: string) {
        this.authToken = token;
        if (token) {
            logger.debug("Kick streamer auth token set successfully.");
        } else {
            logger.debug("Kick streamer auth token cleared.");
        }
    }

    getBotAuthToken(): string {
        return this.botAuthToken;
    }

    setBotAuthToken(token: string) {
        this.botAuthToken = token;
        if (token) {
            logger.debug("Kick bot auth token set successfully.");
        } else {
            logger.debug("Kick bot auth token cleared.");
        }
    }

    async httpCallWithTimeout(uri: string, method: string, body = '', signal: AbortSignal | null = null, timeout = 10000, authToken = this.authToken): Promise<any> {
        const requestId = crypto.randomUUID();
        if (integration.getSettings().logging.logApiResponses) {
            const asUser = authToken === this.botAuthToken ? 'bot' : (this.authToken === this.authToken ? 'streamer' : (this.authToken === '' ? 'unauthenticated' : 'unknown'));
            logger.debug(`[${requestId}] Making API call as ${asUser} to ${uri} with method ${method} and body: ${JSON.stringify(body)}`);
        }

        try {
            const req: HttpCallRequest = {
                url: `${IntegrationConstants.KICK_API_SERVER}${uri}`,
                method,
                authToken: authToken,
                body: body,
                signal: AbortSignal.any([this.apiAborter.signal, ...(signal ? [signal] : [])]),
                timeout
            };
            const response = await httpCallWithTimeout(req);
            if (integration.getSettings().logging.logApiResponses) {
                logger.debug(`[${requestId}] API call to ${method} ${uri} successful. Response: ${JSON.stringify(response)}`);
            }
            return response;
        } catch (error) {
            if (integration.getSettings().logging.logApiResponses) {
                logger.error(`[${requestId}] API call to ${method} ${uri} failed: ${error}`);
            }
            throw error;
        }
    }
}
