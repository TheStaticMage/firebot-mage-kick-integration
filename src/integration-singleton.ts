import { IntegrationData, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { platformCondition } from "./conditions/platform";
import { viewerRolesCondition } from "./conditions/viewer-roles";
import { IntegrationConstants } from "./constants";
import { chatEffect } from "./effects/chat";
import { chatPlatformEffect } from "./effects/chat-platform";
import { deleteChatMessageEffect } from "./effects/delete-chat-message";
import { maintenanceEffect } from "./effects/maintenance";
import { moderatorBanEffect } from "./effects/moderator-ban";
import { moderatorTimeoutEffect } from "./effects/moderator-timeout";
import { rewardEnableDisableEffect } from "./effects/reward-enable-disable";
import { rewardManageEffect } from "./effects/reward-manage";
import { streamGameEffect } from "./effects/stream-game";
import { streamTitleEffect } from "./effects/stream-title";
import { eventSource } from './event-source';
import { hostViewerCountFilter } from "./filters/host-viewer-count";
import { platformFilter } from "./filters/platform";
import { streamerOrBotFilter } from "./filters/streamer-or-bot";
import { usernameFilter } from "./filters/username";
import { viewerRolesFilter } from "./filters/viewer-roles";
import { webhookReceivedEventTypeFilter, webhookReceivedLatencyFilter } from "./filters/webhook-received";
import { AuthManager } from "./internal/auth";
import { getConnectionStatusMessage } from "./internal/connection-utils";
import { Kick } from "./internal/kick";
import { kickRewardsBackend } from "./internal/kick-rewards-backend";
import { KickRewardsState } from "./internal/kick-rewards-state";
import { KickPusher } from "./internal/pusher/pusher";
import { reflectorExtension } from "./internal/reflector";
import { webhookHandler } from './internal/webhook-handler/webhook-handler';
import { verifyWebhookSignature, WebhookSignatureVerificationError } from "./internal/webhook-handler/webhook-signature-verifier";
import { InboundWebhook } from './internal/webhook-handler/webhook';
import { firebot, logger } from "./main";
import { platformRestriction } from "./restrictions/platform";
import { ConnectionStateUpdate, ConnectionUpdateData, KickConnection } from "./shared/types";
import { kickExtension } from "./ui-extensions/kick";
import { getDataFilePath } from "./util/datafile";
import { kickCategoryVariable } from "./variables/category";
import { kickCategoryIdVariable } from "./variables/category-id";
import { kickCategoryImageUrlVariable } from "./variables/category-image-url";
import { kickChannelIdVariable } from "./variables/channel-id";
import { kickChatMessageVariable } from "./variables/chat-message";
import { kickCurrentViewerCountVariable } from "./variables/current-viewer-count";
import { hostTargetUserDisplayName } from "./variables/host-target-user-display-name";
import { hostTargetUserId } from "./variables/host-target-user-id";
import { hostTargetUsername } from "./variables/host-target-username";
import { hostViewerCount } from "./variables/host-viewer-count";
import { cheerKicksAmountVariable } from "./variables/kicks/cheer-kicks-amount";
import { kicksGiftIdVariable } from "./variables/kicks/kicks-gift-id";
import { kicksGiftNameVariable } from "./variables/kicks/kicks-gift-name";
import { kicksGiftTierVariable } from "./variables/kicks/kicks-gift-tier";
import { kicksGiftTypeVariable } from "./variables/kicks/kicks-gift-type";
import { kickModReason } from "./variables/mod-reason";
import { kickModeratorVariable } from "./variables/moderator";
import { kickRewardIdVariable } from "./variables/reward-id";
import { kickRewardMessageVariable } from "./variables/reward-message";
import { kickRewardNameVariable } from "./variables/reward-name";
import { kickStreamIsLiveVariable } from "./variables/stream-is-live";
import { kickStreamTitleVariable } from "./variables/stream-title";
import { kickStreamerVariable } from "./variables/streamer";
import { kickStreamerIdVariable } from "./variables/streamer-id";
import { kickGiftCountVariable } from "./variables/subs/gift-count";
import { kickGiftGiverUsernameVariable } from "./variables/subs/gift-giver-username";
import { kickGiftReceiverUsernameVariable } from "./variables/subs/gift-receiver-username";
import { kickIsAnonymousVariable } from "./variables/subs/is-anonymous";
import { kickSubMonthsVariable } from "./variables/subs/sub-months";
import { kickSubStreakVariable } from "./variables/subs/sub-streak";
import { kickSubTypeVariable } from "./variables/subs/sub-type";
import { kickTimeoutDurationVariable } from "./variables/timeout-duration";
import { kickUnbanTypeVariable } from "./variables/unban-type";
import { kickUptimeVariable } from "./variables/uptime";
import { kickUserDisplayNameVariable } from "./variables/user-display-name";
import { webhookReceivedEventTypeVariable, webhookReceivedEventVersionVariable, webhookReceivedLatencyVariable } from "./variables/webhook-received";
import { registerRoutes, unregisterRoutes } from "./server/server";

type IntegrationParameters = {
    connectivity: {
        firebotUrl: string;
        pusherAppKey: string;
        channelId: string;
        chatroomId: string;
    };
    kickApp: {
        clientId: string;
        clientSecret: string;
    };
    chat: {
        chatFeed: boolean;
        chatSend: boolean;
    };
    triggerTwitchEvents: {
        chatMessage: boolean;
        cheer: boolean;
        follower: boolean;
        raid: boolean;
        raidSentOff: boolean;
        streamOnline: boolean;
        streamOffline: boolean;
        sub: boolean;
        subCommunityGift: boolean;
        subGift: boolean;
        titleChanged: boolean;
        viewerArrived: boolean;
        viewerBanned: boolean;
        viewerTimeout: boolean;
        viewerUnbanned: boolean;
    };
    logging: {
        logWebhooks: boolean;
        logApiResponses: boolean;
        logWebsocketEvents: boolean;
    };
    advanced: {
        allowTestWebhooks: boolean;
        suppressChatFeedNotifications: boolean;
    };
};

export class KickIntegration extends EventEmitter {
    // connected needs to be set to true when the integration is successfully
    // connected. The Firebot integration manager checks this variable directly
    // rather than using a method.
    connected = false;

    // kick is an instance of the Kick class, which handles HTTP calls to the Kick API.
    kick = new Kick();

    // pusher is an instance of the KickPusher class, which handles websocket
    // connections to Kick for real-time events.
    pusher = new KickPusher();

    // kickRewardsState handles the synchronization state of Kick channel rewards
    private kickRewardsState = new KickRewardsState();

    // authManager is an instance of the AuthManager class, which handles authentication
    private authManager = new AuthManager();

    // dataFilePath is the path to the integration data file, which stores the
    // refresh token, broadcaster ID, and proxy poll key.
    private dataFilePath = "";

    // Integration Parameters with default settings
    private settings: IntegrationParameters = {
        connectivity: {
            firebotUrl: "http://localhost:7472",
            pusherAppKey: IntegrationConstants.PUSHER_APP_KEY,
            channelId: "",
            chatroomId: ""
        },
        kickApp: {
            clientId: "",
            clientSecret: ""
        },
        chat: {
            chatFeed: true,
            chatSend: false
        },
        triggerTwitchEvents: {
            chatMessage: false,
            cheer: false,
            follower: false,
            raid: false,
            raidSentOff: false,
            streamOffline: false,
            streamOnline: false,
            sub: false,
            subCommunityGift: false,
            subGift: false,
            titleChanged: false,
            viewerArrived: false,
            viewerBanned: false,
            viewerTimeout: false,
            viewerUnbanned: false
        },
        logging: {
            logWebhooks: false,
            logApiResponses: false,
            logWebsocketEvents: false
        },
        advanced: {
            allowTestWebhooks: false,
            suppressChatFeedNotifications: false
        }
    };

    // Whether to insert Kick chat messages into the Firebot chat dashboard.
    private chatFeed = true;

    init(linked: boolean, integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
        }

        const { httpServer } = firebot.modules;
        httpServer.registerCustomRoute(IntegrationConstants.INTEGRATION_URI, "link/streamer", "GET", async (req, res) => {
            this.authManager.handleLinkCallback(req, res);
        });
        httpServer.registerCustomRoute(IntegrationConstants.INTEGRATION_URI, "link/bot", "GET", async (req, res) => {
            this.authManager.handleLinkCallback(req, res);
        });
        httpServer.registerCustomRoute(IntegrationConstants.INTEGRATION_URI, "callback", "GET", async (req, res) => {
            this.authManager.handleAuthCallback(req, res);
        });

        const { conditionManager } = firebot.modules;
        conditionManager.registerConditionType(platformCondition);
        conditionManager.registerConditionType(viewerRolesCondition);

        const { effectManager } = firebot.modules;
        effectManager.registerEffect(chatEffect);
        effectManager.registerEffect(chatPlatformEffect);
        effectManager.registerEffect(deleteChatMessageEffect);
        effectManager.registerEffect(maintenanceEffect);
        effectManager.registerEffect(moderatorBanEffect);
        effectManager.registerEffect(moderatorTimeoutEffect);
        effectManager.registerEffect(rewardEnableDisableEffect);
        effectManager.registerEffect(rewardManageEffect);
        effectManager.registerEffect(streamGameEffect);
        effectManager.registerEffect(streamTitleEffect);

        const { eventManager } = firebot.modules;
        eventManager.registerEventSource(eventSource);

        const { eventFilterManager } = firebot.modules;
        eventFilterManager.registerFilter(hostViewerCountFilter);
        eventFilterManager.registerFilter(platformFilter);
        eventFilterManager.registerFilter(streamerOrBotFilter);
        eventFilterManager.registerFilter(usernameFilter);
        eventFilterManager.registerFilter(viewerRolesFilter);
        eventFilterManager.registerFilter(webhookReceivedEventTypeFilter);
        eventFilterManager.registerFilter(webhookReceivedLatencyFilter);

        const { replaceVariableManager } = firebot.modules;

        // Category variables
        replaceVariableManager.registerReplaceVariable(kickCategoryIdVariable);
        replaceVariableManager.registerReplaceVariable(kickCategoryImageUrlVariable);
        replaceVariableManager.registerReplaceVariable(kickCategoryVariable);

        // Channel variables
        replaceVariableManager.registerReplaceVariable(kickChannelIdVariable);

        // Chat variables
        replaceVariableManager.registerReplaceVariable(kickChatMessageVariable);

        // Streamer variables
        replaceVariableManager.registerReplaceVariable(kickStreamerIdVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamerVariable);

        // Hosts (raids)
        replaceVariableManager.registerReplaceVariable(hostViewerCount);
        replaceVariableManager.registerReplaceVariable(hostTargetUserId);
        replaceVariableManager.registerReplaceVariable(hostTargetUserDisplayName);
        replaceVariableManager.registerReplaceVariable(hostTargetUsername);

        // Stream variables
        replaceVariableManager.registerReplaceVariable(kickCurrentViewerCountVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamIsLiveVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamTitleVariable);
        replaceVariableManager.registerReplaceVariable(kickUptimeVariable);

        // User variables
        replaceVariableManager.registerReplaceVariable(kickUserDisplayNameVariable);

        // Ban and timeout variables
        replaceVariableManager.registerReplaceVariable(kickModReason);
        replaceVariableManager.registerReplaceVariable(kickModeratorVariable);
        replaceVariableManager.registerReplaceVariable(kickTimeoutDurationVariable);
        replaceVariableManager.registerReplaceVariable(kickUnbanTypeVariable);

        // Reward variables
        replaceVariableManager.registerReplaceVariable(kickRewardIdVariable);
        replaceVariableManager.registerReplaceVariable(kickRewardNameVariable);
        replaceVariableManager.registerReplaceVariable(kickRewardMessageVariable);

        // Subscription related variables
        replaceVariableManager.registerReplaceVariable(kickGiftCountVariable);
        replaceVariableManager.registerReplaceVariable(kickGiftGiverUsernameVariable);
        replaceVariableManager.registerReplaceVariable(kickGiftReceiverUsernameVariable);
        replaceVariableManager.registerReplaceVariable(kickIsAnonymousVariable);
        replaceVariableManager.registerReplaceVariable(kickSubMonthsVariable);
        replaceVariableManager.registerReplaceVariable(kickSubStreakVariable);
        replaceVariableManager.registerReplaceVariable(kickSubTypeVariable);

        // Webhook received and latency variables
        replaceVariableManager.registerReplaceVariable(webhookReceivedEventTypeVariable);
        replaceVariableManager.registerReplaceVariable(webhookReceivedEventVersionVariable);
        replaceVariableManager.registerReplaceVariable(webhookReceivedLatencyVariable);

        // Kicks (like bits) variables
        replaceVariableManager.registerReplaceVariable(cheerKicksAmountVariable);
        replaceVariableManager.registerReplaceVariable(kicksGiftIdVariable);
        replaceVariableManager.registerReplaceVariable(kicksGiftNameVariable);
        replaceVariableManager.registerReplaceVariable(kicksGiftTierVariable);
        replaceVariableManager.registerReplaceVariable(kicksGiftTypeVariable);

        // Restrictions
        const { restrictionManager } = firebot.modules;
        restrictionManager.registerRestriction(platformRestriction);

        // UI Extensions
        const { uiExtensionManager } = firebot.modules;
        if (uiExtensionManager) {
            uiExtensionManager.registerUIExtension(reflectorExtension);
            uiExtensionManager.registerUIExtension(kickExtension);
        } else {
            logger.error("UI Extension Manager module not found. The Kick integration UI extension cannot be registered.");
        }

        this.registerUIExtensionEvents();
        this.registerKickRewardsIpcHandlers();

        // Register webhook early, before authentication
        this.registerWebhook();
        this.registerWebhookEventHandler();

        // Add events to effects, filters, and variables
        effectManager.addEventToEffect("firebot:chat-feed-custom-highlight", IntegrationConstants.INTEGRATION_ID, "chat-message");
        effectManager.addEventToEffect("firebot:chat-feed-custom-highlight", IntegrationConstants.INTEGRATION_ID, "viewer-arrived");
        effectManager.addEventToEffect("firebot:chat-feed-message-hide", IntegrationConstants.INTEGRATION_ID, "chat-message");

        eventFilterManager.addEventToFilter("firebot:cheerbitsamount", IntegrationConstants.INTEGRATION_ID, "kicks-gifted");
        eventFilterManager.addEventToFilter("firebot:raid-viewer-count", IntegrationConstants.INTEGRATION_ID, "raid-sent-off");
        eventFilterManager.addEventToFilter("firebot:raid-viewer-count", IntegrationConstants.INTEGRATION_ID, "raid");

        replaceVariableManager.addEventToVariable("chatMessage", IntegrationConstants.INTEGRATION_ID, "chat-message");
        replaceVariableManager.addEventToVariable("chatMessage", IntegrationConstants.INTEGRATION_ID, "chat-message-deleted");
        replaceVariableManager.addEventToVariable("chatMessage", IntegrationConstants.INTEGRATION_ID, "viewer-arrived");
        replaceVariableManager.addEventToVariable("cheerBitsAmount", IntegrationConstants.INTEGRATION_ID, "kicks-gifted");
        replaceVariableManager.addEventToVariable("cheerMessage", IntegrationConstants.INTEGRATION_ID, "kicks-gifted");
        replaceVariableManager.addEventToVariable("giftCount", IntegrationConstants.INTEGRATION_ID, "community-subs-gifted");
        replaceVariableManager.addEventToVariable("giftGiverUsername", IntegrationConstants.INTEGRATION_ID, "community-subs-gifted");
        replaceVariableManager.addEventToVariable("giftGiverUsername", IntegrationConstants.INTEGRATION_ID, "subs-gifted");
        replaceVariableManager.addEventToVariable("giftReceiverUsername", IntegrationConstants.INTEGRATION_ID, "subs-gifted");
        replaceVariableManager.addEventToVariable("isAnonymous", IntegrationConstants.INTEGRATION_ID, "community-subs-gifted");
        replaceVariableManager.addEventToVariable("isAnonymous", IntegrationConstants.INTEGRATION_ID, "subs-gifted");
        replaceVariableManager.addEventToVariable("moderator", IntegrationConstants.INTEGRATION_ID, "banned");
        replaceVariableManager.addEventToVariable("moderator", IntegrationConstants.INTEGRATION_ID, "timeout");
        replaceVariableManager.addEventToVariable("moderator", IntegrationConstants.INTEGRATION_ID, "unbanned");
        replaceVariableManager.addEventToVariable("modReason", IntegrationConstants.INTEGRATION_ID, "banned");
        replaceVariableManager.addEventToVariable("modReason", IntegrationConstants.INTEGRATION_ID, "timeout");
        replaceVariableManager.addEventToVariable("raidTargetUserDisplayName", IntegrationConstants.INTEGRATION_ID, "raid-sent-off");
        replaceVariableManager.addEventToVariable("raidTargetUserId", IntegrationConstants.INTEGRATION_ID, "raid-sent-off");
        replaceVariableManager.addEventToVariable("raidTargetUsername", IntegrationConstants.INTEGRATION_ID, "raid-sent-off");
        replaceVariableManager.addEventToVariable("raidViewerCount", IntegrationConstants.INTEGRATION_ID, "raid-sent-off");
        replaceVariableManager.addEventToVariable("raidViewerCount", IntegrationConstants.INTEGRATION_ID, "raid");
        replaceVariableManager.addEventToVariable("subMonths", IntegrationConstants.INTEGRATION_ID, "sub");
        replaceVariableManager.addEventToVariable("subStreak", IntegrationConstants.INTEGRATION_ID, "sub");
        replaceVariableManager.addEventToVariable("subType", IntegrationConstants.INTEGRATION_ID, "sub");
        replaceVariableManager.addEventToVariable("timeoutDuration", IntegrationConstants.INTEGRATION_ID, "timeout");
    }

    private registerWebhook(): boolean {
        const { webhookManager } = firebot.modules;
        try {
            let webhook = webhookManager.getWebhook(IntegrationConstants.WEBHOOK_NAME);
            if (webhook) {
                logger.debug("Crowbar webhook already exists. Not creating a new one.");
            } else {
                logger.info("Kick webhook not found. Creating new webhook.");
                webhook = webhookManager.saveWebhook(IntegrationConstants.WEBHOOK_NAME);
                if (webhook) {
                    logger.info("Crowbar webhook registered successfully.");
                } else {
                    logger.error("Failed to register Crowbar webhook. Webhook events will not be received.");
                    return false;
                }
            }
            return true;
        } catch (error) {
            logger.error(`Failed to initialize Crowbar webhooks: ${error}`);
            return false;
        }
    }

    private registerWebhookEventHandler(): void {
        try {
            const { webhookManager } = firebot.modules;
            webhookManager.on("webhook-received", async ({ config, payload, rawPayload, headers }: any) => {
                if (config.name === IntegrationConstants.WEBHOOK_NAME) {
                    await this.handleCrowbarWebhook(payload, rawPayload, headers);
                }
            });
        } catch (error) {
            logger.error(`Failed to register webhook event handler: ${error}`);
        }
    }

    async connect() {
        // Load current refresh token and proxy poll key from data file
        this.dataFilePath = getDataFilePath("integration-data.json");
        const fileData = this.loadIntegrationData();
        if (fileData) {
            this.authManager.init(fileData.refreshToken, fileData.botRefreshToken);
        } else {
            logger.warn("Kick integration data file not found or invalid. Please link the integration.");
            this.authManager.init("", "");
        }

        // Make sure the necessary tokens and settings are available
        if (!this.authManager.canConnect()) {
            await this.disconnect();
            this.sendCriticalErrorNotification("You need to set up authorization for the integration before you can use it. Open the Kick Accounts screen to authorize the streamer and bot accounts.");
            return;
        }

        this.emit("connecting", IntegrationConstants.INTEGRATION_ID);

        // Refresh the auth token (we always do this upon connecting)
        try {
            await this.authManager.connect();
            logger.info("Kick authentication connected successfully.");
        } catch (error) {
            logger.error(`Failed to connect Kick authentication: ${error}`);
            await this.disconnect();
            return;
        }

        // Kick API integration setup
        try {
            const streamerToken = await this.authManager.getStreamerAuthToken();
            const botToken = await this.authManager.getBotAuthToken();
            await this.kick.connect(streamerToken, botToken);
            this.kickRewardsState.loadManagementState();
            this.notifyRewardManagementStateChange();
            logger.info("Kick API integration connected successfully.");
        } catch (error) {
            logger.error(`Failed to connect Kick API integration: ${error}`);
            await this.disconnect();
            return;
        }

        // Websocket (pusher) connection setup
        try {
            this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId, this.settings.connectivity.channelId);
        } catch (error) {
            logger.error(`Failed to connect Kick websocket (Pusher) integration: ${error}`);
            await this.disconnect();
            this.sendCriticalErrorNotification(`Failed to connect to the Kick websocket (Pusher). You may need to reconfigure your channel and chatroom IDs in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`);
            return;
        }

        // Register platform-lib REST API operation handlers
        try {
            registerRoutes(this);
        } catch (error) {
            logger.error(`Failed to register platform-lib REST API operation handlers: ${error}`);
            await this.disconnect();
            return;
        }

        // Mark the integration as connected
        this.connected = true;
        this.emit("connected", IntegrationConstants.INTEGRATION_ID);
        this.notifyConnectionStateChange();
    }

    async disconnect() {
        logger.debug("Kick integration disconnecting...");
        this.emit("disconnecting", IntegrationConstants.INTEGRATION_ID);
        unregisterRoutes();
        this.connected = false;
        this.authManager.disconnect();
        await this.kick.disconnect();
        this.kickRewardsState.clearState();
        this.pusher.disconnect();
        this.notifyConnectionStateChange();
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info("Kick integration disconnected.");
    }

    async onUserSettingsUpdate(integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            logger.debug("Kick integration user settings updated.");
            const oldSettings = JSON.parse(JSON.stringify(this.settings));
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
            let mustReconnect = false;

            if (integrationData.userSettings.kickApp.clientId !== oldSettings.kickApp.clientId
                || integrationData.userSettings.kickApp.clientSecret !== oldSettings.kickApp.clientSecret
            ) {
                logger.info("Kick integration client credentials have changed. You may need to re-link the integration.");
                this.kick.setAuthToken('');
                this.kick.setBotAuthToken('');
                mustReconnect = true;
            }

            if (integrationData.userSettings.connectivity.pusherAppKey !== oldSettings.connectivity.pusherAppKey ||
                integrationData.userSettings.connectivity.chatroomId !== oldSettings.connectivity.chatroomId ||
                integrationData.userSettings.connectivity.channelId !== oldSettings.connectivity.channelId) {
                logger.info("Pusher settings have changed. The Kick integration will reconnect.");
                mustReconnect = true;
            }

            if (mustReconnect) {
                logger.info("Reconnecting integration due to settings change...");
                await this.disconnect();
                await this.connect();
            }
        }
    }

    isChatFeedEnabled(): boolean {
        return this.settings.chat.chatFeed;
    }

    getModules(): ScriptModules {
        return firebot.modules;
    }

    getSettings(): IntegrationParameters {
        return this.settings;
    }

    getKickRewardsState(): KickRewardsState {
        return this.kickRewardsState;
    }

    sendCriticalErrorNotification(message: string) {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("error", `Kick Integration: ${message}`);
        logger.info(`Pop-up critical notification sent: ${JSON.stringify(message)}`);
    }

    sendChatFeedErrorNotification(message: string) {
        if (this.settings.advanced.suppressChatFeedNotifications) {
            logger.warn(`Chat feed notifications suppressed. Not sending this message: ${JSON.stringify(message)}`);
            return;
        }

        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("chatUpdate", {
            fbEvent: "ChatAlert",
            message: `Kick Integration: ${message}`,
            icon: "fas fa-exclamation-triangle"
        });
        logger.info(`Chat feed notification sent: ${JSON.stringify(message)}`);
    }

    private async handleCrowbarWebhook(payload: any, rawPayload: string | undefined, headers: any): Promise<void> {
        try {
            // Verify webhook signature
            try {
                verifyWebhookSignature({
                    payload,
                    rawPayload,
                    headers: {
                        'kick-event-signature': headers['kick-event-signature'],
                        'kick-event-message-id': headers['kick-event-message-id'],
                        'kick-event-message-timestamp': headers['kick-event-message-timestamp']
                    },
                    allowTestWebhooks: this.settings.advanced.allowTestWebhooks,
                    testWebhookPublicKey: IntegrationConstants.TEST_WEBHOOK_PUBLIC_KEY,
                    productionWebhookPublicKey: IntegrationConstants.WEBHOOK_PUBLIC_KEY
                });
            } catch (e) {
                if (e instanceof WebhookSignatureVerificationError) {
                    logger.warn(`Webhook signature verification failed: ${e.message}`);
                    return;
                }
                logger.error(`Error verifying webhook signature: ${e}`);
                return;
            }

            const isTestEvent = payload.is_test_event === true;
            const messageId = headers['kick-event-message-id'];
            const timestamp = headers['kick-event-message-timestamp'];

            // Transform Crowbar format to InboundWebhook format
            const webhook: InboundWebhook = {
                kickEventMessageId: messageId || '',
                kickEventSubscriptionId: headers['kick-event-subscription-id'] || '',
                kickEventMessageTimestamp: timestamp || '',
                kickEventType: headers['kick-event-type'] || '',
                kickEventVersion: headers['kick-event-version'] || '',
                rawData: JSON.stringify(payload),
                isTestEvent
            };

            await webhookHandler.handleWebhook(webhook);
        } catch (error) {
            logger.error(`Failed to handle Crowbar webhook: ${error}. Payload: ${JSON.stringify(payload)}. Headers: ${JSON.stringify(headers)}`);
        }
    }

    private loadIntegrationData(): integrationFileData | null {
        const { fs } = firebot.modules;
        if (!fs.existsSync(this.dataFilePath)) {
            logger.warn("Kick integration data file not found. Please link the integration.");
            return null;
        }

        try {
            const data = fs.readFileSync(this.dataFilePath, "utf-8");
            return JSON.parse(data) as integrationFileData;
        } catch (error) {
            logger.error(`Failed to read Kick integration configuration file: ${error}`);
            return null;
        }
    }

    saveIntegrationTokenData(refreshToken: string, botRefreshToken: string): void {
        const data: integrationFileData = {
            refreshToken: refreshToken,
            botRefreshToken: botRefreshToken
        };

        const { fs } = firebot.modules;
        fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        logger.debug("Kick integration token data saved.");
    }

    private notifyConnectionStateChange(): void {
        const { frontendCommunicator } = firebot.modules;
        if (!frontendCommunicator) {
            return;
        }

        const streamerStatus = this.authManager.getStreamerConnectionStatus();
        const botStatus = this.authManager.getBotConnectionStatus();

        const streamerConnection: KickConnection = {
            type: "streamer",
            accessToken: "",
            refreshToken: "",
            tokenExpiresAt: streamerStatus.tokenExpiresAt,
            ready: streamerStatus.ready,
            username: "",
            missingScopes: streamerStatus.missingScopes
        };

        const botConnection: KickConnection = {
            type: "bot",
            accessToken: "",
            refreshToken: "",
            tokenExpiresAt: botStatus.tokenExpiresAt,
            ready: botStatus.ready,
            username: "",
            missingScopes: botStatus.missingScopes
        };

        const streamerData: ConnectionUpdateData = {
            ready: streamerStatus.ready,
            status: getConnectionStatusMessage(streamerConnection, this.connected),
            tokenExpiresAt: streamerStatus.tokenExpiresAt,
            missingScopes: streamerStatus.missingScopes
        };

        const botData: ConnectionUpdateData = {
            ready: botStatus.ready,
            status: getConnectionStatusMessage(botConnection, this.connected),
            tokenExpiresAt: botStatus.tokenExpiresAt,
            missingScopes: botStatus.missingScopes
        };

        const update: ConnectionStateUpdate = {
            connected: this.connected,
            streamer: streamerData,
            bot: botData
        };

        logger.debug(`Notifying frontend of connection state change: ${JSON.stringify(update)}`);
        frontendCommunicator.send("kick:connections-update", update);
    }

    private registerUIExtensionEvents(): void {
        const { frontendCommunicator } = firebot.modules;
        const firebotUrl = this.settings.connectivity.firebotUrl || "http://localhost:7472";
        this.authManager.registerUIExtensionEvents(frontendCommunicator, firebotUrl, () => {
            this.notifyConnectionStateChange();
        });

        // Register webhook data handler
        frontendCommunicator.on("kick:get-webhook-data", () => {
            try {
                logger.debug("Received request for Kick integration webhook data.");
                const { webhookManager } = firebot.modules;
                if (!webhookManager) {
                    return { url: "" };
                }

                logger.debug("Fetching Kick integration webhook data from Crowbar...");
                const webhook = webhookManager.getWebhook(IntegrationConstants.WEBHOOK_NAME);
                if (!webhook) {
                    return { url: "" };
                }

                logger.debug("Retrieving Kick integration webhook URL...");
                const url = webhookManager.getWebhookUrl(IntegrationConstants.WEBHOOK_NAME);
                logger.debug(`Retrieved webhook URL: ${url}`);
                return { url: url || "" };
            } catch (error) {
                logger.error(`Failed to retrieve webhook data: ${error}`);
                return { url: "" };
            }
        });

        // Register webhook registration handler
        frontendCommunicator.onAsync("kick:register-webhook", async () => {
            try {
                const success = this.registerWebhook();
                if (success) {
                    const { webhookManager } = firebot.modules;
                    const url = webhookManager.getWebhookUrl(IntegrationConstants.WEBHOOK_NAME);
                    logger.debug(`Webhook registration successful. URL: ${url}`);
                    return { success: true, url: url || "" };
                }
                return { success: false, url: "", error: "Failed to register webhook" };
            } catch (error) {
                logger.error(`Error in kick:register-webhook handler: ${error}`);
                return { success: false, url: "", error: String(error) };
            }
        });

        // Register reset webhook subscriptions handler
        frontendCommunicator.onAsync("kick:reset-webhook-subscriptions", async () => {
            try {
                logger.info("Webhook subscription reset requested by user.");
                await this.kick.webhookSubscriptionManager.resetWebhookSubscriptions();
                logger.info("Webhook subscriptions reset successfully. Disconnecting and reconnecting integration...");

                // Disconnect and reconnect the integration to ensure a clean state
                await this.disconnect();
                await this.connect();

                logger.info("Integration reconnected after webhook subscription reset.");
                return { success: true };
            } catch (error) {
                logger.error(`Error resetting webhook subscriptions: ${error}`);
                return { success: false, error: String(error) };
            }
        });
    }

    private registerKickRewardsIpcHandlers(): void {
        kickRewardsBackend.registerHandlers();
    }

    private notifyRewardManagementStateChange(): void {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("kick:reward-management-state-updated", this.kickRewardsState.getAllManagementData());
    }
}

interface integrationFileData {
    refreshToken: string;
    botRefreshToken: string;
}

export const integration = new KickIntegration();
