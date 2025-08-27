import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { BasicKickUser } from "../shared/types";
import { KickChannelManager } from "./channel-manager";
import { ChatManager } from "./chat-manager";
import { httpCallWithTimeout } from "./http";
import { KickUserApi } from "./user-api";
import { KickUserManager } from "./user-manager";
import { parseBasicKickUser } from "./webhook-handler/webhook-parsers";

export class Kick {
    private apiAborter = new AbortController();
    private authToken = "";
    private botAuthToken = "";
    bot: BasicKickUser | null = null;
    broadcaster: BasicKickUser | null = null;
    channelManager: KickChannelManager;
    chatManager: ChatManager;
    userApi: KickUserApi;
    userManager: KickUserManager;

    constructor() {
        this.channelManager = new KickChannelManager(this);
        this.chatManager = new ChatManager(this);
        this.userApi = new KickUserApi(this);
        this.userManager = new KickUserManager(this);
    }

    async connect(token: string, botToken: string): Promise<void> {
        logger.debug("Kick API integration connecting...");

        this.setAuthToken(token);
        this.setBotAuthToken(botToken);
        this.apiAborter = new AbortController();

        try {
            this.broadcaster = await this.userManager.lookupUserById();
        } catch (error) {
            logger.error(`Failed to get broadcaster ID: ${error}`);
            await this.disconnect();
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
                this.bot = null;
            }
        } else {
            logger.debug("No bot token is given.");
            this.bot = null;
        }

        try {
            await this.subscribeToEvents();
        } catch (error) {
            logger.error(`Failed to subscribe to events: ${error}`);
            await this.disconnect();
            throw error;
        }

        this.channelManager.start();
        await this.chatManager.start();
        this.userApi.start();
        await this.userManager.connectViewerDatabase();
        logger.info("Kick API integration connected.");
    }

    async disconnect(): Promise<void> {
        logger.debug("Kick API integration disconnecting...");
        await this.deleteExistingSubscriptions();
        this.apiAborter.abort();
        this.channelManager.stop();
        await this.chatManager.stop();
        this.userApi.stop();
        this.userManager.disconnectViewerDatabase();
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

    private async deleteExistingSubscriptions(): Promise<void> {
        if (!integration.getSettings().webhookProxy.webhookProxyUrl) {
            logger.debug("Webhook proxy URL not set, skipping event unsubscription.");
            return;
        }

        interface webhookSubscriptionResponse {
            data: {
                id: string;
                event: string;
            }[];
        }

        try {
            const response: webhookSubscriptionResponse = await this.httpCallWithTimeout('/public/v1/events/subscriptions', "GET");
            const unsubscribePromises = response.data.map((subscription) => {
                const params = new URLSearchParams({ id: subscription.id });
                logger.debug(`Unsubscribing from event subscription with ID: ${subscription.id}`);
                return this.httpCallWithTimeout(`/public/v1/events/subscriptions?${params.toString()}`, "DELETE");
            });

            await Promise.all(unsubscribePromises);
            logger.info("Successfully deleted existing event subscriptions.");
        } catch (error) {
            logger.error(`Failed to delete existing event subscriptions: ${error}`);
        }
    }

    private async subscribeToEvents(): Promise<void> {
        if (!integration.getSettings().webhookProxy.webhookProxyUrl) {
            logger.debug("Webhook proxy URL not set, skipping event subscription.");
            return;
        }

        await this.deleteExistingSubscriptions();

        const payload = {
            events: [
                {
                    name: "chat.message.sent",
                    version: 1
                },
                {
                    name: "channel.followed",
                    version: 1
                },
                {
                    name: "livestream.metadata.updated",
                    version: 1
                },
                {
                    name: "livestream.status.updated",
                    version: 1
                },
                {
                    name: "channel.subscription.renewal",
                    version: 1
                },
                {
                    name: "channel.subscription.gifts",
                    version: 1
                },
                {
                    name: "channel.subscription.new",
                    version: 1
                },
                {
                    name: "moderation.banned",
                    version: 1
                }
            ],
            method: "webhook"
        };

        return new Promise((resolve, reject) => {
            this.httpCallWithTimeout('/public/v1/events/subscriptions', "POST", JSON.stringify(payload))
                .then((response) => {
                    logger.debug("Successfully subscribed to Kick events.");
                    resolve(response);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    async httpCallWithTimeout(uri: string, method: string, body = '', signal: AbortSignal | null = null, timeout = 10000, authToken = this.authToken): Promise<any> {
        const requestId = crypto.randomUUID();
        if (integration.getSettings().logging.logApiResponses) {
            const asUser = authToken === this.botAuthToken ? 'bot' : (this.authToken === this.authToken ? 'streamer' : (this.authToken === '' ? 'unauthenticated' : 'unknown'));
            logger.debug(`[${requestId}] Making API call as ${asUser} to ${uri} with method ${method} and body: ${JSON.stringify(body)}`);
        }

        try {
            const response = await httpCallWithTimeout(
                `${IntegrationConstants.KICK_API_SERVER}${uri}`,
                method,
                authToken,
                body,
                AbortSignal.any([this.apiAborter.signal, ...(signal ? [signal] : [])]),
                timeout
            );

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
