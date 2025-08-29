import { IntegrationData, ScriptModules } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { platformCondition } from "./conditions/platform";
import { IntegrationConstants } from "./constants";
import { chatEffect } from "./effects/chat";
import { chatPlatformEffect } from "./effects/chat-platform";
import { streamGameEffect } from "./effects/stream-game";
import { streamTitleEffect } from "./effects/stream-title";
import { triggerCustomChannelRewardEffect } from "./effects/trigger-custom-channel-reward";
import { eventSource } from './event-source';
import { hostViewerCountFilter } from "./filters/host-viewer-count";
import { platformFilter } from "./filters/platform";
import { rewardTitleFilter } from "./filters/reward-title";
import { usernameFilter } from "./filters/username";
import { AuthManager } from "./internal/auth";
import { Kick } from "./internal/kick";
import { Poller } from "./internal/poll";
import { KickPusher } from "./internal/pusher/pusher";
import { firebot, logger } from "./main";
import { platformRestriction } from "./restrictions/platform";
import { getDataFilePath } from "./util/datafile";
import { kickCategoryVariable } from "./variables/category";
import { kickCategoryIdVariable } from "./variables/category-id";
import { kickCategoryImageUrlVariable } from "./variables/category-image-url";
import { kickChannelIdVariable } from "./variables/channel-id";
import { kickChatMessageVariable } from "./variables/chat-message";
import { kickCurrentViewerCountVariable } from "./variables/current-viewer-count";
import { hostViewerCount } from "./variables/host-viewer-count";
import { kickModReason } from "./variables/mod-reason";
import { kickModerator } from "./variables/moderator";
import { platformVariable } from "./variables/platform";
import { platformAwareUserDisplayNameVariable } from "./variables/platform-aware-user-display-name";
import { kickRewardIdVariable } from "./variables/reward-id";
import { kickRewardMessageVariable } from "./variables/reward-message";
import { kickRewardNameVariable } from "./variables/reward-name";
import { kickStreamIsLiveVariable } from "./variables/stream-is-live";
import { kickStreamTitleVariable } from "./variables/stream-title";
import { kickStreamerVariable } from "./variables/streamer";
import { kickStreamerIdVariable } from "./variables/streamer-id";
import { kickTimeoutDurationVariable } from "./variables/timeout-duration";
import { kickUptimeVariable } from "./variables/uptime";
import { kickUserDisplayNameVariable } from "./variables/user-display-name";
import { streamerOrBotFilter } from "./filters/streamer-or-bot";
import { kickSubTypeVariable } from "./variables/subs/sub-type";
import { kickGiftReceiverUsernameVariable } from "./variables/subs/gift-receiver-username";
import { kickGiftGiverUsernameVariable } from "./variables/subs/gift-giver-username";
import { kickIsAnonymousVariable } from "./variables/subs/is-anonymous";
import { kickSubStreakVariable } from "./variables/subs/sub-streak";
import { kickSubMonthsVariable } from "./variables/subs/sub-months";
import { kickGiftCountVariable } from "./variables/subs/gift-count";
import { hostTargetUserDisplayName } from "./variables/host-target-user-display-name";
import { hostTargetUserId } from "./variables/host-target-user-id";
import { hostTargetUsername } from "./variables/host-target-username";

type IntegrationParameters = {
    connectivity: {
        firebotUrl: string;
        pusherAppKey: string;
        channelId: string;
        chatroomId: string;
    };
    webhookProxy: {
        webhookProxyUrl: string;
    };
    kickApp: {
        clientId: string;
        clientSecret: string;
    };
    accounts: {
        authorizeStreamerAccount: null;
        authorizeBotAccount: boolean;
    };
    chat: {
        chatFeed: boolean;
        chatSend: boolean;
    };
    triggerTwitchEvents: {
        chatMessage: boolean;
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
    };
    logging: {
        logWebhooks: boolean;
        logApiResponses: boolean;
        logWebsocketEvents: boolean;
    };
    advanced: {
        allowTestWebhooks: boolean;
        dangerousOperations: boolean;
    };
};

export class KickIntegration extends EventEmitter {
    // connected needs to be set to true when the integration is successfully
    // connected. The Firebot integration manager checks this variable directly
    // rather than using a method.
    connected = false;

    // proxyPollKey is learned upon linking and subsequently read from the
    // integration data file. It is used to identify the poller on the upstream
    // server.
    private proxyPollKey = "";

    // kick is an instance of the Kick class, which handles HTTP calls to the Kick API.
    kick = new Kick();

    // pusher is an instance of the KickPusher class, which handles websocket
    // connections to Kick for real-time events.
    pusher = new KickPusher();

    // poller is an instance of the Poller class, which handles polling for events.
    private poller = new Poller();

    // authManager is an instance of the AuthManager class, which handles authentication
    private authManager = new AuthManager();

    // dataFilePath is the path to the integration data file, which stores the
    // refresh token, broadcaster ID, and proxy poll key.
    private dataFilePath = "";

    // Can be toggled to true to enable dangerous operations that can create
    // and modify users in the Firebot database. THIS COULD BREAK FIREBOT!
    // READ DOCUMENTATION CAREFULLY BEFORE ENABLING!
    private settings: IntegrationParameters = {
        connectivity: {
            firebotUrl: "http://localhost:7472",
            pusherAppKey: IntegrationConstants.PUSHER_APP_KEY,
            channelId: "",
            chatroomId: ""
        },
        webhookProxy: {
            webhookProxyUrl: ""
        },
        kickApp: {
            clientId: "",
            clientSecret: ""
        },
        accounts: {
            authorizeStreamerAccount: null,
            authorizeBotAccount: false
        },
        chat: {
            chatFeed: true,
            chatSend: false
        },
        triggerTwitchEvents: {
            chatMessage: false,
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
            viewerTimeout: false
        },
        logging: {
            logWebhooks: false,
            logApiResponses: false,
            logWebsocketEvents: false
        },
        advanced: {
            allowTestWebhooks: false,
            dangerousOperations: false
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

        const { effectManager } = firebot.modules;
        effectManager.registerEffect(chatEffect);
        effectManager.registerEffect(chatPlatformEffect);
        effectManager.registerEffect(streamGameEffect);
        effectManager.registerEffect(streamTitleEffect);
        effectManager.registerEffect(triggerCustomChannelRewardEffect);

        const { eventManager } = firebot.modules;
        eventManager.registerEventSource(eventSource);

        const { eventFilterManager } = firebot.modules;
        eventFilterManager.registerFilter(hostViewerCountFilter);
        eventFilterManager.registerFilter(platformFilter);
        eventFilterManager.registerFilter(rewardTitleFilter);
        eventFilterManager.registerFilter(streamerOrBotFilter);
        eventFilterManager.registerFilter(usernameFilter);

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
        replaceVariableManager.registerReplaceVariable(platformAwareUserDisplayNameVariable.replaceVariable);

        // Ban and timeout variables
        replaceVariableManager.registerReplaceVariable(kickModReason);
        replaceVariableManager.registerReplaceVariable(kickModerator);
        replaceVariableManager.registerReplaceVariable(kickTimeoutDurationVariable);

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

        // Miscellaneous variables
        replaceVariableManager.registerReplaceVariable(platformVariable);

        const { restrictionManager } = firebot.modules;
        restrictionManager.registerRestriction(platformRestriction);
    }

    async connect() {
        // Load current refresh token and proxy poll key from data file
        this.dataFilePath = getDataFilePath("integration-data.json");
        const fileData = this.loadIntegrationData();
        if (fileData) {
            this.authManager.init(fileData.refreshToken, fileData.botRefreshToken);
            this.proxyPollKey = fileData.proxyPollKey;
        } else {
            logger.warn("Kick integration data file not found or invalid. Please link the integration.");
            this.authManager.init("", "");
        }

        // Make sure the necessary tokens and settings are available
        if (!this.authManager.canConnect()) {
            await this.disconnect();
            this.sendCriticalErrorNotification("You need to set up authorization for the integration before you can use it. Do that in Settings > Integrations > Kick.");
            return;
        }

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
            logger.info("Kick API integration connected successfully.");
        } catch (error) {
            logger.error(`Failed to connect Kick API integration: ${error}`);
            await this.disconnect();
            return;
        }

        // Start the poller
        await this.poller.connect(this.proxyPollKey);

        // Websocket (pusher) connection setup
        try {
            this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId, this.settings.connectivity.channelId);
        } catch (error) {
            logger.error(`Failed to connect Kick websocket (Pusher) integration: ${error}`);
            await this.disconnect();
            this.sendCriticalErrorNotification(`Failed to connect to the Kick websocket (Pusher). You may need to reconfigure your channel and chatroom IDs in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`);
            return;
        }

        // Mark the integration as connected
        this.connected = true;
        this.emit("connected", IntegrationConstants.INTEGRATION_ID);
    }

    async disconnect() {
        logger.debug("Kick integration disconnecting...");
        this.connected = false;
        this.authManager.disconnect();
        await this.kick.disconnect();
        await this.poller.disconnect(this.proxyPollKey);
        this.pusher.disconnect();
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info("Kick integration disconnected.");
    }

    async onUserSettingsUpdate(integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            logger.debug("Kick integration user settings updated.");
            const oldSettings = JSON.parse(JSON.stringify(this.settings));
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
            let mustReconnect = false;

            if (integrationData.userSettings.webhookProxy.webhookProxyUrl !== oldSettings.webhookProxy.webhookProxyUrl) {
                logger.info("Kick integration webhook proxy URL has changed. You may need to re-link the integration.");
                this.kick.setAuthToken('');
                this.kick.setBotAuthToken('');
                mustReconnect = true;
            }

            if (integrationData.userSettings.kickApp.clientId !== oldSettings.kickApp.clientId
                || integrationData.userSettings.kickApp.clientSecret !== oldSettings.kickApp.clientSecret
            ) {
                logger.info("Kick integration webhook client credentials have changed. You may need to re-link the integration.");
                if (!integrationData.userSettings.webhookProxy.webhookProxyUrl) {
                    this.kick.setAuthToken('');
                    this.kick.setBotAuthToken('');
                    mustReconnect = true;
                }
            }

            if (!integrationData.userSettings.webhookProxy.webhookProxyUrl && this.proxyPollKey) {
                logger.info("Webhook proxy URL removed but a proxy key was previously set.");
                this.proxyPollKey = '';
                this.saveIntegrationTokenData(this.authManager.streamerRefreshToken, this.authManager.botRefreshToken, null);
                mustReconnect = true;
            }

            if (integrationData.userSettings.connectivity.pusherAppKey !== oldSettings.connectivity.pusherAppKey ||
                integrationData.userSettings.connectivity.chatroomId !== oldSettings.connectivity.chatroomId ||
                integrationData.userSettings.connectivity.channelId !== oldSettings.connectivity.channelId) {
                logger.info("Pusher settings have changed. The Kick integration will reconnect.");
                mustReconnect = true;
            }

            if (integrationData.userSettings.accounts.authorizeBotAccount && !oldSettings.accounts.authorizeBotAccount) {
                logger.info("Bot account authorization has been enabled. You may need to authorize the bot account.");
                this.kick.setBotAuthToken('');
                mustReconnect = true;
            }

            if (!integrationData.userSettings.accounts.authorizeBotAccount && oldSettings.accounts.authorizeBotAccount) {
                logger.info("Bot account authorization has been disabled. The Kick integration will reconnect.");
                this.kick.setBotAuthToken('');
                mustReconnect = true;
            }

            if (mustReconnect) {
                logger.info("Reconnecting integration due to settings change...");
                await this.disconnect();
                this.poller.setProxyPollKey(this.proxyPollKey);
                this.poller.setProxyPollUrl(integrationData.userSettings.webhookProxy.webhookProxyUrl);
                await this.connect();
            }
        }
    }

    areDangerousOpsEnabled(): boolean {
        return this.settings.advanced.dangerousOperations;
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

    sendCriticalErrorNotification(message: string) {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("error", `Kick Integration: ${message}`);
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

    saveIntegrationTokenData(refreshToken: string, botRefreshToken: string, proxyPollKey: string | null = null): void {
        const data: integrationFileData = {
            refreshToken: refreshToken,
            botRefreshToken: botRefreshToken,
            proxyPollKey: proxyPollKey || this.proxyPollKey
        };

        const { fs } = firebot.modules;
        fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        logger.debug("Kick integration token data saved.");

        this.proxyPollKey = data.proxyPollKey;
    }
}

interface integrationFileData {
    refreshToken: string;
    botRefreshToken: string;
    proxyPollKey: string;
}

export const integration = new KickIntegration();
