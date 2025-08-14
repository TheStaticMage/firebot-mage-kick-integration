import { IntegrationData, IntegrationDefinition } from "@crowbartools/firebot-custom-scripts-types";
import { EventEmitter } from "events";
import { IntegrationConstants } from "./constants";
import { chatEffect } from "./effects/chat";
import { chatPlatformEffect } from "./effects/chat-platform";
import { streamGameEffect } from "./effects/stream-game";
import { streamTitleEffect } from "./effects/stream-title";
import { eventSource } from './event-source';
import { AuthManager } from "./internal/auth";
import { Kick } from "./internal/kick";
import { Poller } from "./internal/poll";
import { KickPusher } from "./internal/pusher/pusher";
import { firebot, logger } from "./main";
import { platformRestriction } from "./restrictions/platform";
import { getDataFilePath } from "./util/datafile";
import { kickBanDuration } from "./variables/banDuration";
import { kickCategoryVariable } from "./variables/category";
import { kickCategoryIdVariable } from "./variables/category-id";
import { kickCategoryImageUrlVariable } from "./variables/category-image-url";
import { kickChannelIdVariable } from "./variables/channel-id";
import { kickChatMessageVariable } from "./variables/chat-message";
import { kickCurrentViewerCountVariable } from "./variables/current-viewer-count";
import { kickModReason } from "./variables/mod-reason";
import { kickModerator } from "./variables/moderator";
import { kickStreamIsLiveVariable } from "./variables/stream-is-live";
import { kickStreamTitleVariable } from "./variables/stream-title";
import { kickStreamerVariable } from "./variables/streamer";
import { kickStreamerIdVariable } from "./variables/streamer-id";
import { kickUptimeVariable } from "./variables/uptime";
import { kickUserDisplayNameVariable } from "./variables/user-display-name";

const pusherAppKey = "32cbd69e4b950bf97679";

export type IntegrationParameters = {
    connectivity: {
        webhookProxyUrl: string;
        firebotUrl: string;
        pusherAppKey: string;
        chatroomId: string;
    };
    general: {
        chatFeed: boolean;
    };
    advanced: {
        sendTwitchEvents: boolean;
        logWebhooks: boolean;
        logApiResponses: boolean;
        logWebsocketEvents: boolean;
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
            webhookProxyUrl: "",
            firebotUrl: "http://localhost:7472",
            pusherAppKey: pusherAppKey,
            chatroomId: ""
        },
        general: {
            chatFeed: true
        },
        advanced: {
            sendTwitchEvents: false,
            logWebhooks: false,
            logApiResponses: false,
            logWebsocketEvents: false,
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
            this.authManager.init(this, fileData.refreshToken);
            this.proxyPollKey = fileData.proxyPollKey;
        } else {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration data file not found or invalid. Please link the integration.`);
            this.authManager.init(this, "");
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

        const { eventManager } = firebot.modules;
        eventManager.registerEventSource(eventSource);

        const { replaceVariableManager } = firebot.modules;
        replaceVariableManager.registerReplaceVariable(kickCategoryIdVariable);
        replaceVariableManager.registerReplaceVariable(kickCategoryImageUrlVariable);
        replaceVariableManager.registerReplaceVariable(kickCategoryVariable);
        replaceVariableManager.registerReplaceVariable(kickChannelIdVariable);
        replaceVariableManager.registerReplaceVariable(kickChatMessageVariable);
        replaceVariableManager.registerReplaceVariable(kickCurrentViewerCountVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamerIdVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamerVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamIsLiveVariable);
        replaceVariableManager.registerReplaceVariable(kickStreamTitleVariable);
        replaceVariableManager.registerReplaceVariable(kickUptimeVariable);
        replaceVariableManager.registerReplaceVariable(kickUserDisplayNameVariable);
        replaceVariableManager.registerReplaceVariable(kickBanDuration);
        replaceVariableManager.registerReplaceVariable(kickModReason);
        replaceVariableManager.registerReplaceVariable(kickModerator);

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
        if (!this.authManager.canConnect() || !this.proxyPollKey) {
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
            return;
        }

        // Kick API integration setup
        try {
            await this.kick.connect(this.authManager.getAuthToken());
            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Kick API integration connected successfully.`);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to connect Kick API integration: ${error}`);
            this.disconnect();
            return;
        }

        // Start the poller
        this.poller.connect(this.proxyPollKey);

        // Websocket (pusher) connection setup
        this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId);

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

            if (integrationData.userSettings.connectivity.webhookProxyUrl !== oldSettings.connectivity.webhookProxyUrl) {
                logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Kick integration webhook proxy URL changed. You may need to re-link the integration.`);
            }

            if (integrationData.userSettings.connectivity.pusherAppKey !== oldSettings.connectivity.pusherAppKey ||
                integrationData.userSettings.connectivity.chatroomId !== oldSettings.connectivity.chatroomId) {
                logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Pusher App ID or Chatroom ID changed. Reconnecting...`);
                this.pusher.disconnect();
                this.pusher.connect(this.settings.connectivity.pusherAppKey, this.settings.connectivity.chatroomId);
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
                webhookProxyUrl: {
                    title: "Webhook Proxy URL",
                    tip: "The URL of the webhook proxy server to use for Kick events.",
                    type: "string",
                    default: "",
                    sortRank: 1
                },
                firebotUrl: {
                    title: "Firebot URL",
                    tip: "The URL of the Firebot instance to connect to for the authentication callback.",
                    type: "string",
                    default: "http://localhost:7472",
                    sortRank: 2
                },
                pusherAppKey: {
                    title: "Pusher App Key",
                    tip: "The Pusher App Key to use for Kick websocket events. See documentation.",
                    type: "string",
                    default: pusherAppKey,
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
        general: {
            title: "General Settings",
            sortRank: 2,
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
                logWebhooks: {
                    title: "Log Webhooks",
                    tip: "Log all webhooks received from Kick to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 2
                },
                logApiResponses: {
                    title: "Log API Calls and Responses",
                    tip: "Log all API calls and responses to/from Kick to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 3
                },
                logWebsocketEvents: {
                    title: "Log Websocket Events",
                    tip: "Log all Pusher (websocket) events to the Firebot log. Useful for debugging.",
                    type: "boolean",
                    default: false,
                    sortRank: 4
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
