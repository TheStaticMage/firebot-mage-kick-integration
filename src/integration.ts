import { IntegrationData, IntegrationDefinition } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { IntegrationConstants } from "./constants";
import { chatEffect } from "./effects/chat";
import { chatPlatformEffect } from "./effects/chat-platform";
import { streamGameEffect } from "./effects/stream-game";
import { streamTitleEffect } from "./effects/stream-title";
import { triggerCustomChannelRewardEffect } from "./effects/trigger-custom-channel-reward";
import { eventSource } from './event-source';
import { rewardTitleFilter } from "./filters/reward-title";
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
import { kickModReason } from "./variables/mod-reason";
import { kickModerator } from "./variables/moderator";
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

const pusherAppKey = "32cbd69e4b950bf97679";

export type IntegrationParameters = {
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
    general: {
        chatFeed: boolean;
    };
    logging: {
        logWebhooks: boolean;
        logApiResponses: boolean;
        logWebsocketEvents: boolean;
    };
    advanced: {
        sendTwitchEvents: boolean;
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
            pusherAppKey: pusherAppKey,
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
        general: {
            chatFeed: true
        },
        logging: {
            logWebhooks: false,
            logApiResponses: false,
            logWebsocketEvents: false
        },
        advanced: {
            sendTwitchEvents: false,
            dangerousOperations: false
        }
    };

    // Whether to insert Kick chat messages into the Firebot chat dashboard.
    private chatFeed = true;

    init(linked: boolean, integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));
        }

        this.dataFilePath = getDataFilePath("integration-data.json");
        const fileData = this.loadIntegrationData();
        if (fileData) {
            this.authManager.init(fileData.refreshToken);
            this.proxyPollKey = fileData.proxyPollKey;
        } else {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration data file not found or invalid. Please link the integration.`);
            this.authManager.init("");
        }

        const { httpServer } = firebot.modules;
        httpServer.registerCustomRoute(IntegrationConstants.INTEGRATION_URI, "link", "GET", async (req, res) => {
            this.authManager.handleLinkCallback(req, res);
        });
        httpServer.registerCustomRoute(IntegrationConstants.INTEGRATION_URI, "callback", "GET", async (req, res) => {
            this.authManager.handleAuthCallback(req, res);
        });

        const { effectManager } = firebot.modules;
        effectManager.registerEffect(chatEffect);
        effectManager.registerEffect(chatPlatformEffect);
        effectManager.registerEffect(streamGameEffect);
        effectManager.registerEffect(streamTitleEffect);
        effectManager.registerEffect(triggerCustomChannelRewardEffect);

        const { eventManager } = firebot.modules;
        eventManager.registerEventSource(eventSource);

        const { eventFilterManager } = firebot.modules;
        eventFilterManager.registerFilter(rewardTitleFilter);

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

        // Stream variables
        replaceVariableManager.registerReplaceVariable(kickCurrentViewerCountVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamIsLiveVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamTitleVariable);
        replaceVariableManager.registerReplaceVariable(kickUptimeVariable);

        // User variables
        replaceVariableManager.registerReplaceVariable(kickUserDisplayNameVariable);

        // Ban and timeout variables
        replaceVariableManager.registerReplaceVariable(kickModReason);
        replaceVariableManager.registerReplaceVariable(kickModerator);
        replaceVariableManager.registerReplaceVariable(kickTimeoutDurationVariable);

        // Reward variables
        replaceVariableManager.registerReplaceVariable(kickRewardIdVariable);
        replaceVariableManager.registerReplaceVariable(kickRewardNameVariable);
        replaceVariableManager.registerReplaceVariable(kickRewardMessageVariable);

        const { restrictionManager } = firebot.modules;
        restrictionManager.registerRestriction(platformRestriction);

        const isLinked = this.loadIntegrationData();
        if (!isLinked) {
            this.unlink();
            return;
        }
    }

    async link() {
        this.saveCurrentUserSettings();

        // THIS IS HORRIBLE AND I AM SORRY
        // Can't figure a good way to open the URL in the user's browser
        // from the script. The modals seem to escape HTML, and this was
        // the best one I could find.
        const { frontendCommunicator } = firebot.modules;
        const authUrl = `${this.settings.connectivity.firebotUrl}/integrations/${IntegrationConstants.INTEGRATION_URI}/link`;
        frontendCommunicator.send("info", `Please copy and paste this URL into your browser to authorize the integration: ${authUrl}`);
    }

    async unlink() {
        this.disconnect();
        this.authManager.unlink();

        const { fs } = firebot.modules;
        if (fs.existsSync(this.dataFilePath)) {
            fs.unlinkSync(this.dataFilePath);
            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration data file deleted.`);
        }

        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration unlinking complete.`);
    }

    private saveCurrentUserSettings() {
        // Firebot wipes out all record of the integration in the database,
        // including the user settings, when it unlinks the integration. At
        // least put the settings back into the database when re-linking.
        const { integrationManager } = firebot.modules;
        integrationManager.saveIntegrationUserSettings(IntegrationConstants.INTEGRATION_ID, this.settings, false);
    }

    async connect() {
        // Make sure the necessary tokens and settings are available
        if (!this.authManager.canConnect()) {
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.send("error", "Kick Integration: You need to link the integration before you can connect it.");
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration is not properly linked. Please link the integration first.`);
            this.disconnect();
            return;
        }

        // Refresh the auth token (we always do this upon connecting)
        try {
            await this.authManager.connect();
            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick authentication connected successfully.`);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to connect Kick authentication: ${error}`);
            this.disconnect();
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.send("error", "Kick Integration: Failed to authenticate to Kick. You may need to re-link the integration.");
            return;
        }

        // Kick API integration setup
        try {
            await this.kick.connect(this.authManager.getAuthToken());
            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration connected successfully.`);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to connect Kick API integration: ${error}`);
            this.disconnect();
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.send("error", "Kick Integration: Failed to connect to the Kick API. You may need to re-link the integration.");
            return;
        }

        // Start the poller
        this.poller.connect(this.proxyPollKey);

        // Websocket (pusher) connection setup
        try {
            this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId, this.settings.connectivity.channelId);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to connect Kick websocket (Pusher) integration: ${error}`);
            this.disconnect();
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.send("error", "Kick Integration: Failed to connect to the Kick websocket (Pusher) integration. You may need to re-link the integration or configure your channel and chatroom IDs.");
            return;
        }

        // Mark the integration as connected
        this.connected = true;
        this.emit("connected", IntegrationConstants.INTEGRATION_ID);
    }

    async disconnect() {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration disconnecting...`);
        this.connected = false;
        this.authManager.disconnect();
        this.kick.disconnect();
        this.poller.disconnect(this.proxyPollKey);
        this.pusher.disconnect();
        this.emit("disconnected", IntegrationConstants.INTEGRATION_ID);
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration disconnected.`);
    }

    onUserSettingsUpdate(integrationData: IntegrationData<IntegrationParameters>) {
        if (integrationData.userSettings) {
            const oldSettings = JSON.parse(JSON.stringify(this.settings));
            this.settings = JSON.parse(JSON.stringify(integrationData.userSettings));

            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration user settings updated.`);
            logger.debug(JSON.stringify(this.settings));

            if (integrationData.userSettings.webhookProxy.webhookProxyUrl !== oldSettings.webhookProxy.webhookProxyUrl
                || integrationData.userSettings.kickApp.clientId !== oldSettings.kickApp.clientId
                || integrationData.userSettings.kickApp.clientSecret !== oldSettings.kickApp.clientSecret
            ) {
                logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration webhook proxy URL or client credentials changed. You may need to re-link the integration.`);
            }

            if (integrationData.userSettings.connectivity.pusherAppKey !== oldSettings.connectivity.pusherAppKey ||
                integrationData.userSettings.connectivity.chatroomId !== oldSettings.connectivity.chatroomId ||
                integrationData.userSettings.connectivity.channelId !== oldSettings.connectivity.channelId) {
                logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Pusher settings changed. Reconnecting...`);
                this.pusher.disconnect();
                this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId, this.settings.connectivity.channelId);
            }
        }
    }

    areDangerousOpsEnabled(): boolean {
        return this.settings.advanced.dangerousOperations;
    }

    isChatFeedEnabled(): boolean {
        return this.settings.general.chatFeed;
    }

    getEventSources(): string[] {
        const sources: string[] = [IntegrationConstants.INTEGRATION_ID];
        if (this.settings.advanced.sendTwitchEvents) {
            sources.push("twitch");
        }
        return sources;
    }

    getSettings(): IntegrationParameters {
        return this.settings;
    }

    private loadIntegrationData(): integrationFileData | null {
        const { fs } = firebot.modules;
        if (!fs.existsSync(this.dataFilePath)) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration data file not found. Please link the integration.`);
            return null;
        }

        try {
            const data = fs.readFileSync(this.dataFilePath, "utf-8");
            return JSON.parse(data) as integrationFileData;
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to read Kick integration configuration file: ${error}`);
            return null;
        }
    }

    saveIntegrationTokenData(refreshToken: string, proxyPollKey: string | null = null): void {
        const data: integrationFileData = {
            refreshToken: refreshToken,
            proxyPollKey: proxyPollKey || this.proxyPollKey
        };

        const { fs } = firebot.modules;
        fs.writeFileSync(this.dataFilePath, JSON.stringify(data, null, 2));
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration token data saved.`);

        this.proxyPollKey = data.proxyPollKey;
    }
}

interface integrationFileData {
    refreshToken: string;
    proxyPollKey: string;
}

export const integration = new KickIntegration();

export const definition: IntegrationDefinition = {
    id: IntegrationConstants.INTEGRATION_ID,
    name: IntegrationConstants.INTEGRATION_NAME,
    description: IntegrationConstants.INTEGRATION_DESCRIPTION,
    connectionToggle: true,
    configurable: true,
    linkType: "other", // Firebot doesn't support PKCE yet, so we use 'other' for now.
    settingCategories: {
        connectivity: {
            title: "Connectivity Settings",
            sortRank: 1,
            settings: {
                firebotUrl: {
                    title: "Firebot URL",
                    tip: "The base URL of your firebot installation.",
                    type: "string",
                    default: "http://localhost:7472",
                    sortRank: 1
                },
                pusherAppKey: {
                    title: "Pusher App Key",
                    tip: "The Pusher App Key to use for Kick websocket events. See documentation.",
                    type: "string",
                    default: pusherAppKey,
                    sortRank: 2
                },
                channelId: {
                    title: "Channel ID",
                    tip: "The ID of your Kick channel for Kick websocket events. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 3
                },
                chatroomId: {
                    title: "Chatroom ID",
                    tip: "The ID of the your chatroom for Kick websocket events. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 4
                }
            }
        },
        webhookProxy: {
            title: "Webhook Proxy Settings",
            sortRank: 2,
            settings: {
                webhookProxyUrl: {
                    title: "Webhook Proxy URL",
                    tip: "The URL of the webhook proxy server to use for Kick events. Leave blank if you want to use your own Kick app. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 1
                }
            }
        },
        kickApp: {
            title: "Kick App Settings",
            sortRank: 3,
            settings: {
                clientId: {
                    title: "Client ID",
                    tip: "The Client ID for your Kick app. Ignored when using webhook proxy. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 1
                },
                clientSecret: {
                    title: "Client Secret",
                    tip: "The Client Secret for your Kick app. Ignored when using webhook proxy. See documentation.",
                    type: "string",
                    default: "",
                    sortRank: 2
                }
            }
        },
        general: {
            title: "General Settings",
            sortRank: 4,
            settings: {
                chatFeed: {
                    title: "Chat Feed",
                    tip: "Add Kick chat messages to the Firebot chat dashboard.",
                    type: "boolean",
                    default: true,
                    sortRank: 1
                }
            }
        },
        logging: {
            title: "Logging Settings",
            sortRank: 98,
            settings: {
                logWebhooks: {
                    title: "Log Webhooks",
                    tip: "Log all webhooks received from Kick to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 1
                },
                logApiResponses: {
                    title: "Log API Calls and Responses",
                    tip: "Log all API calls and responses to/from Kick to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 2
                },
                logWebsocketEvents: {
                    title: "Log Websocket Events",
                    tip: "Log all Pusher (websocket) events to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 3
                }
            }
        },
        advanced: {
            title: "Advanced Settings",
            sortRank: 99,
            settings: {
                sendTwitchEvents: {
                    title: "Send Equivalent Twitch Events",
                    tip: "Send the equivalent Twitch events for all Kick events that occur. THIS COULD BREAK FIREBOT! READ DOCUMENTATION CAREFULLY BEFORE ENABLING!",
                    type: "boolean",
                    default: false,
                    sortRank: 1
                },
                dangerousOperations: {
                    title: "Allow Dangerous Operations -- THIS COULD BREAK FIREBOT!",
                    tip: "Enable dangerous operations that can create and modify users in the Firebot database. THIS COULD BREAK FIREBOT! READ DOCUMENTATION CAREFULLY BEFORE ENABLING!",
                    type: "boolean",
                    default: false,
                    sortRank: 99
                }
            }
        }
    }
};
