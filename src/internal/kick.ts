import { IntegrationConstants } from "../constants";
import { logger } from "../main";
import { BasicKickUser } from "../shared/types";
import { KickChannelManager } from "./channel-manager";
import { httpCallWithTimeout } from "./http";
import { KickUserManager } from "./user-manager";
import { ChatManager } from "./chat-manager";

export class Kick {
    private apiAborter = new AbortController();
    private authToken = "";
    broadcaster: BasicKickUser | null = null;
    channelManager: KickChannelManager;
    chatManager: ChatManager;
    userManager: KickUserManager;

    constructor() {
        this.channelManager = new KickChannelManager(this);
        this.chatManager = new ChatManager(this);
        this.userManager = new KickUserManager(this);
    }

    async connect(token: string): Promise<void> {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration connecting...`);

        this.setAuthToken(token);
        this.apiAborter = new AbortController();

        try {
            this.broadcaster = await this.userManager.getUser();
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to get broadcaster ID: ${error}`);
            this.disconnect();
            throw error;
        }

        try {
            await this.subscribeToEvents();
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to subscribe to events: ${error}`);
            this.disconnect();
            throw error;
        }

        this.channelManager.start();
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration connected.`);
    }

    disconnect(): void {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration disconnecting...`);
        this.apiAborter.abort();
        this.channelManager.stop();
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration disconnected.`);
    }

    setAuthToken(token: string) {
        this.authToken = token;
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick auth token set successfully.`);
    }

    async subscribeToEvents(): Promise<void> {
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
                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Successfully subscribed to Kick events: ${JSON.stringify(response)}`);
                    resolve(response);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    async httpCallWithTimeout(uri: string, method: string, body = '', signal: AbortSignal | null = null, timeout = 10000): Promise<any> {
        return httpCallWithTimeout(
            `${IntegrationConstants.KICK_API_SERVER}${uri}`,
            method,
            this.authToken,
            body,
            AbortSignal.any([this.apiAborter.signal, ...(signal ? [signal] : [])]),
            timeout
        );
    }
}
