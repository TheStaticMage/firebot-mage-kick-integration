import { EventSource } from '@crowbartools/firebot-custom-scripts-types/types/modules/event-manager';
import { unkickifyUsername } from './internal/util';
import { getNumberFromUnknown } from './util/util';

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
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567",
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
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567"
            },
            activityFeed: {
                icon: "fas fa-heart",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    return `**${userDisplayName}** followed on Kick`;
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
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567"
            },
            activityFeed: {
                icon: "fad fa-house-return",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    return `**${userDisplayName}** arrived on Kick`;
                }
            }
        },
        {
            id: "banned",
            name: "Viewer Banned (Kick)",
            description: "When someone is banned in your channel",
            cached: false,
            manualMetadata: {
                username: "cavemobster@kick",
                userDisplayName: "CaveMobster",
                userId: "k2345678",
                moderator: "Firebot",
                modReason: "They were extra naughty"
            },
            activityFeed: {
                icon: "fad fa-gavel",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const moderator = typeof eventData.moderator === "string" ? unkickifyUsername(eventData.moderator) : "Unknown Moderator";
                    const modReason = typeof eventData.modReason === "string" ? eventData.modReason : "";

                    let message = `**${userDisplayName}** was banned by **${moderator}** on Kick.`;
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
                userId: "k3456789",
                timeoutDuration: "60", // Kick reports this in minutes but we convert to seconds before calling the event
                moderator: "Firebot",
                modReason: "They were naughty"
            },
            activityFeed: {
                icon: "fad fa-stopwatch",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const moderator = typeof eventData.moderator === "string" ? unkickifyUsername(eventData.moderator) : "Unknown Moderator";
                    const modReason = typeof eventData.modReason === "string" ? eventData.modReason : "";
                    const timeoutDuration = getNumberFromUnknown(eventData.timeoutDuration, "Unknown");

                    let message = `**${userDisplayName}** was timed out for **${timeoutDuration} sec(s)** by **${moderator}** on Kick.`;
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
                userId: "k1234567",
                rewardName: "Test Reward",
                messageText: "Test message"
            },
            activityFeed: {
                icon: "fad fa-circle",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    return `**${userDisplayName}** redeemed **${eventData.rewardName}** on Kick${
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
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567"
            }
        },
        {
            id: "raid",
            name: "Incoming Host (Kick)",
            description: "When someone else hosts (raids) your channel on Kick",
            cached: true,
            cacheMetaKey: "username",
            manualMetadata: {
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567",
                viewerCount: 42
            },
            activityFeed: {
                icon: "fad fa-inbox-in",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const viewerCount = getNumberFromUnknown(eventData.viewerCount, "Unknown");
                    return `**${userDisplayName}** hosted on Kick with **${viewerCount}** viewer(s)`;
                }
            }
        },
        {
            id: "title-changed",
            name: "Title Changed",
            description: "When you change your Kick stream title.",
            cached: false,
            manualMetadata: {
                title: "Stream Title"
            },
            activityFeed: {
                icon: "fad fa-text",
                getMessage: (eventData) => {
                    return `Kick stream title changed to **${eventData.title}**`;
                }
            }
        },
        {
            id: "category-changed",
            name: "Category Changed",
            description: "When you change your Kick stream category.",
            cached: false,
            manualMetadata: {
                category: "Just Chatting",
                categoryId: 15
            },
            activityFeed: {
                icon: "fad fa-th-large",
                getMessage: (eventData) => {
                    return `Kick stream category changed to **${eventData.category}**`;
                }
            }
        },
        {
            id: "sub",
            name: "Sub",
            description: "When someone subscribes (or resubscribes) to your channel on Kick.",
            cached: false,
            manualMetadata: {
                username: "firebot@kick",
                userDisplayName: "Firebot",
                userId: "k1234567",
                isResub: false,
                subMessage: "Test message",
                totalMonths: 10
            },
            activityFeed: {
                icon: "fas fa-star",
                getMessage: (eventData) => {
                    const username = typeof eventData.username === "string" ? unkickifyUsername(eventData.username) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const totalMonths = getNumberFromUnknown(eventData.totalMonths, "1");
                    const durationString = eventData.isResub ? ` for **${totalMonths}** month(s)` : "";
                    return `**${userDisplayName}** ${eventData.isResub ? "resubscribed" : "subscribed"} on Kick${durationString}`;
                }
            }
        },
        {
            id: "subs-gifted",
            name: "Sub Gifted",
            description: "When someone gifts a sub to someone else in your channel on Kick.",
            cached: false,
            manualMetadata: {
                gifterUsername: "Firebot@kick",
                isAnonymous: false,
                gifteeUsername: "MageEnclave@kick"
            },
            activityFeed: {
                icon: "fad fa-gift",
                getMessage: (eventData) => {
                    const username = eventData.isAnonymous ? "An Anonymous Gifter" : typeof eventData.gifterUsername === "string" ? unkickifyUsername(eventData.gifterUsername) : "Unknown User";
                    const userDisplayName = eventData.isAnonymous ? "An Anonymous Gifter" : typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    return `**${userDisplayName}** gifted a sub to **${eventData.gifteeUsername}** on Kick`;
                }
            }
        },
        {
            id: "community-subs-gifted",
            name: "Community Subs Gifted",
            description: "When someone gifts subs to the community of the channel on Kick.",
            cached: false,
            manualMetadata: {
                gifterUsername: "Firebot@kick",
                isAnonymous: false,
                subCount: 5,
                giftReceivers: {
                    type: "gift-receivers-list",
                    value: [
                        { gifteeUsername: "User1@kick", giftSubMonths: 1 },
                        { gifteeUsername: "User2@kick", giftSubMonths: 1 },
                        { gifteeUsername: "User3@kick", giftSubMonths: 1 },
                        { gifteeUsername: "User4@kick", giftSubMonths: 1 },
                        { gifteeUsername: "User5@kick", giftSubMonths: 1 }
                    ]
                }
            },
            activityFeed: {
                icon: "fad fa-gifts",
                getMessage: (eventData) => {
                    const username = eventData.isAnonymous ? "An Anonymous Gifter" : typeof eventData.gifterUsername === "string" ? unkickifyUsername(eventData.gifterUsername) : "Unknown User";
                    const userDisplayName = eventData.isAnonymous ? "An Anonymous Gifter" : typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const subCount = getNumberFromUnknown(eventData.subCount, "Unknown Number");
                    return `**${userDisplayName}** gifted **${subCount}** sub(s) to the community on Kick`;
                }
            }
        },
        {
            id: "raid-sent-off",
            name: "Outgoing Host (Raid)",
            description: "When your outgoing host (raid) is completed on Kick.",
            cached: false,
            manualMetadata: {
                username: "firebot@kick",
                userId: "k1234567",
                userDisplayName: "Firebot",
                raidTargetUsername: "user@kick",
                raidTargetUserId: "k7654321",
                raidTargetUserDisplayName: "User",
                viewerCount: 5
            },
            activityFeed: {
                icon: "fad fa-inbox-out",
                getMessage: (eventData) => {
                    const username = typeof eventData.raidTargetUsername === "string" ? unkickifyUsername(eventData.raidTargetUsername) : "Unknown User";
                    const userDisplayName = typeof eventData.userDisplayName === "string" ? eventData.userDisplayName : username;
                    const viewerCount = getNumberFromUnknown(eventData.viewerCount, "Unknown");
                    return `Hosted **${userDisplayName}** with **${viewerCount}** viewer(s)`;
                }
            }
        }
    ]
};
