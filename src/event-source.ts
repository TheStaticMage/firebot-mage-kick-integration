import { EventSource } from '@crowbartools/firebot-custom-scripts-types/types/modules/event-manager';

export const eventSource: EventSource = {
    id: "mage-kick-integration",
    name: "Mage Kick Integration",
    events: [
        {
            id: "chat-message",
            name: "Chat Message",
            description: "When someone chats in your channel on Kick",
            cached: false,
            manualMetadata: {
                username: "firebot",
                userDisplayName: "Firebot",
                userId: "",
                messageText: "Test message"
            }
        },
        {
            id: "follow",
            name: "Follow (Kick)",
            description: "When someone follows your channel on Kick",
            cached: true,
            cacheMetaKey: "username",
            manualMetadata: {
                username: "firebot",
                userDisplayName: "Firebot",
                userId: ""
            },
            activityFeed: {
                icon: "fas fa-heart",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? eventData.username : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const showUserIdName = username.toLowerCase() !== userDisplayName.toLowerCase();
                    return `**${eventData.userDisplayName}${
                        showUserIdName ? ` (${eventData.username})` : ""
                    }** followed`;
                }
            }
        },
        {
            id: "stream-online",
            name: "Stream Started (Kick)",
            description: "When your stream starts on Kick.",
            cached: false,
            manualMetadata: {},
            activityFeed: {
                icon: "fad fa-play-circle",
                getMessage: () => {
                    return `Stream started on Kick.`;
                }
            }
        },
        {
            id: "stream-offline",
            name: "Stream Ended (Kick)",
            description: "When your stream ends on Kick.",
            cached: false,
            manualMetadata: {},
            activityFeed: {
                icon: "fad fa-stop-circle",
                getMessage: () => {
                    return `Stream ended on Kick.`;
                }
            }
        },
        {
            id: "viewer-arrived",
            name: "Viewer Arrived (Kick)",
            description: "When a viewer initially chats in any given stream.",
            cached: true,
            cacheMetaKey: "username",
            manualMetadata: {
                username: "firebot",
                userDisplayName: "Firebot",
                userId: ""
            },
            activityFeed: {
                icon: "fad fa-house-return",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? eventData.username : "";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : "";
                    const showUserIdName = username.toLowerCase() !== userDisplayName.toLowerCase();
                    return `**${eventData.userDisplayName}${
                        showUserIdName ? ` (${eventData.username})` : ""
                    }** arrived`;
                }
            }
        }
    ]
};
