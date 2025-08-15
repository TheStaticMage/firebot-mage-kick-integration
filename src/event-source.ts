import { EventSource } from '@crowbartools/firebot-custom-scripts-types/types/modules/event-manager';

export const eventSource: EventSource = {
    id: "mage-kick-integration",
    name: "Mage Kick Integration",
    events: [
        {
            id: "chat-message",
            name: "Chat Message (Kick)",
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
        },
        {
            id: "banned",
            name: "Viewer Banned (Kick)",
            description: "When someone is banned in your channel",
            cached: false,
            manualMetadata: {
                username: "cavemobster",
                userDisplayName: "CaveMobster",
                userId: "",
                moderator: "Firebot",
                modReason: "They were extra naughty"
            },
            activityFeed: {
                icon: "fad fa-gavel",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? eventData.username : "";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : "";
                    const showUserIdName = username.toLowerCase() !== userDisplayName.toLowerCase();
                    const moderator = typeof eventData.moderator === "string" ? eventData.moderator : "Unknown Moderator";
                    const modReason = typeof eventData.modReason === "string" ? eventData.modReason : "";

                    let message = `**${userDisplayName}${
                        showUserIdName ? ` (${username})` : ""
                    }** was banned by **${moderator}**.`;

                    if (modReason) {
                        message = `${message} Reason: **${modReason}**`;
                    }
                    return message;
                }
            }
        },
        {
            id: "timeout",
            name: "Viewer Timeout (Kick)",
            description: "When someone is timed out in your channel",
            cached: false,
            manualMetadata: {
                username: "alca",
                userDisplayName: "Alca",
                userId: "",
                timeoutDuration: "60", // Kick reports this in minutes but we convert to seconds before calling the event
                moderator: "Firebot",
                modReason: "They were naughty"
            },
            activityFeed: {
                icon: "fad fa-stopwatch",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? eventData.username : "";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : "";
                    const showUserIdName = username.toLowerCase() !== userDisplayName.toLowerCase();
                    const moderator = typeof eventData.moderator === "string" ? eventData.moderator : "Unknown Moderator";
                    const modReason = typeof eventData.modReason === "string" ? eventData.modReason : "";

                    let message = `**${userDisplayName}${
                        showUserIdName ? ` (${username})` : ""
                    }** was timed out for **${eventData.timeoutDuration} sec(s)** by **${moderator}**.`;

                    if (modReason) {
                        message = `${message} Reason: **${modReason}**`;
                    }
                    return message;
                }
            }
        },
        {
            id: "channel-reward-redemption",
            name: "Channel Reward Redemption (Kick)",
            description: "When someone redeems a channel reward on Kick",
            cached: false,
            manualMetadata: {
                username: "firebot",
                userDisplayName: "Firebot",
                userId: "",
                rewardName: "Test Reward",
                messageText: "Test message"
            },
            activityFeed: {
                icon: "fad fa-circle",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? eventData.username : "";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : "";
                    const showUserIdName = username.toLowerCase() !== userDisplayName.toLowerCase();
                    return `**${userDisplayName}${
                        showUserIdName ? ` (${username})` : ""
                    }** redeemed **${eventData.rewardName}**${
                        typeof eventData.messageText === "string" && eventData.messageText.length > 0 ? `: *${eventData.messageText}*` : ""
                    }`;
                }
            }
        },
        {
            id: "channel-data-updated",
            name: "Channel Data Updated (Kick)",
            description: "When the channel data is updated on Kick (this happens periodically)",
            cached: false,
            manualMetadata: {
                username: "firebot",
                userDisplayName: "Firebot",
                userId: ""
            }
        }
    ]
};
