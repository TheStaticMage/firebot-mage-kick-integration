import { IntegrationDefinition } from "@crowbartools/firebot-custom-scripts-types";
import { IntegrationConstants } from "./constants";

export { integration } from './integration-singleton';

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
                    default: IntegrationConstants.PUSHER_APP_KEY,
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
        triggerTwitchEvents: {
            title: "Trigger Twitch Events",
            sortRank: 5,
            settings: {
                chatMessage: {
                    title: "Chat Message",
                    tip: "Trigger the 'Twitch:Chat Message' event when someone chats on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 1
                },
                follower: {
                    title: "Follower",
                    tip: "Trigger the 'Twitch:Follow' event when someone follows on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 2
                },
                raid: {
                    title: "Host (Raid)",
                    tip: "Trigger the 'Twitch:Raid' event when someone hosts (raids) your stream on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 3
                },
                streamOffline: {
                    title: "Stream Ended",
                    tip: "Trigger the 'Twitch:Stream Ended' event when the Kick stream goes offline",
                    type: "boolean",
                    default: false,
                    sortRank: 4
                },
                streamOnline: {
                    title: "Stream Started",
                    tip: "Trigger the 'Twitch:Stream Started' event when the Kick stream goes online",
                    type: "boolean",
                    default: false,
                    sortRank: 5
                },
                viewerArrived: {
                    title: "Viewer Arrived",
                    tip: "Trigger the 'Twitch:Viewer Arrived' event when a viewer arrives on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 6
                },
                viewerBanned: {
                    title: "Viewer Banned",
                    tip: "Trigger the 'Twitch:Viewer Banned' event when a viewer is banned on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 7
                },
                viewerTimeout: {
                    title: "Viewer Timeout",
                    tip: "Trigger the 'Twitch:Viewer Timeout' event when a viewer is timed out on Kick",
                    type: "boolean",
                    default: false,
                    sortRank: 8
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
