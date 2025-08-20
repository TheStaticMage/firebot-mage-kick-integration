import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { BasicKickUser } from "../shared/types";
import { KickChannelManager } from "./channel-manager";
import { ChatManager } from "./chat-manager";
import { httpCallWithTimeout } from "./http";
import { KickUserApi } from "./user-api";
import { KickUserManager } from "./user-manager";

export class Kick {
    private apiAborter = new AbortController();
    private authToken = "";
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

    async connect(token: string): Promise<void> {
        logger.debug("Kick API integration connecting...");

        this.setAuthToken(token);
        this.apiAborter = new AbortController();

        try {
            this.broadcaster = await this.userManager.lookupUserById();
        } catch (error) {
            logger.error(`Failed to get broadcaster ID: ${error}`);
            this.disconnect();
            throw error;
        }

        try {
            await this.subscribeToEvents();
        } catch (error) {
            logger.error(`Failed to subscribe to events: ${error}`);
            this.disconnect();
            throw error;
        }

        this.channelManager.start();
        this.userApi.start();
        await this.userManager.connectViewerDatabase();
        logger.info("Kick API integration connected.");
    }

    disconnect(): void {
        logger.debug("Kick API integration disconnecting...");
        this.deleteExistingSubscriptions();
        this.apiAborter.abort();
        this.channelManager.stop();
        this.userApi.stop();
        this.userManager.disconnectViewerDatabase();
        logger.info("Kick API integration disconnected.");
    }

    setAuthToken(token: string) {
        this.authToken = token;
        logger.debug("Kick auth token set successfully.");
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
                    name: "livestream.status.updated",
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

    async httpCallWithTimeout(uri: string, method: string, body = '', signal: AbortSignal | null = null, timeout = 10000): Promise<any> {
        const requestId = crypto.randomUUID();
        if (integration.getSettings().logging.logApiResponses) {
            logger.debug(`[${requestId}] Making API call to ${uri} with method ${method} and body: ${JSON.stringify(body)}`);
        }

        try {
            const response = await httpCallWithTimeout(
                `${IntegrationConstants.KICK_API_SERVER}${uri}`,
                method,
                this.authToken,
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
