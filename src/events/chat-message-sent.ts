import { FirebotChatMessage, FirebotParsedMessagePart } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { commandHandler } from "../internal/command";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { ChatMessage, KickIdentity } from "../shared/types";

interface chatBadge {
    title: string;
    url: string;
}

interface PendingChatMessage {
    messageId: string;
    timeoutHandle: NodeJS.Timeout;
}

// Queue of messages from Pusher waiting to see if webhook arrives
const pendingPusherMessages = new Map<string, PendingChatMessage>();

// Mark a message as originating from webhook (not Pusher)
const webhookMessages = new Set<string>();

export async function handleChatMessageSentEvent(payload: ChatMessage, isFromWebhook = false): Promise<void> {
    const messageId = payload.messageId;

    // If this is from webhook, cancel any pending Pusher version
    if (isFromWebhook) {
        webhookMessages.add(messageId);
        const pending = pendingPusherMessages.get(messageId);
        if (pending) {
            clearTimeout(pending.timeoutHandle);
            pendingPusherMessages.delete(messageId);
            logger.debug(`Webhook arrived for message ${messageId}, cancelled pending Pusher message`);
        }
    } else {
        // If from Pusher, check if webhook version already processed this
        if (webhookMessages.has(messageId)) {
            logger.debug(`Duplicate Pusher message ignored (webhook already processed): id=${messageId}`);
            return;
        }

        // Schedule delivery after 5 seconds, allowing webhook to arrive and cancel it
        const timeoutHandle = setTimeout(async () => {
            pendingPusherMessages.delete(messageId);
            await processAndSendChatMessage(payload);
        }, 5000);

        pendingPusherMessages.set(messageId, { messageId, timeoutHandle });
        logger.debug(`Pusher chat message scheduled for delivery in 5s: id=${messageId}`);
        return;
    }

    // Webhook messages are processed immediately
    await processAndSendChatMessage(payload);
}

async function processAndSendChatMessage(payload: ChatMessage): Promise<void> {
    const helpers = new FirebotChatHelpers();
    const twitchBadgeRoles: string[] = helpers.getTwitchRoles(payload.sender.identity);

    // Create user if they do not exist
    const viewer = await integration.kick.userManager.getOrCreateViewer(payload.sender, [], true);
    if (viewer) {
        await integration.kick.userManager.setViewerRoles(viewer._id, twitchBadgeRoles);
    }

    // Build Firebot chat message with profile picture from payload
    const firebotChatMessage = await helpers.buildFirebotChatMessage(payload, payload.content);

    // Skip duplicate messages
    const isRegistered = await integration.kick.chatManager.registerMessage(payload.messageId, 'kick', firebotChatMessage);
    if (!isRegistered) {
        logger.debug(`Duplicate chat message ignored: id=${payload.messageId}`);
        return;
    }

    // Update chat message count
    await integration.kick.userManager.incrementDbField(payload.sender.userId, "chatMessages");

    // Command checking
    await commandHandler.handleChatMessage(firebotChatMessage);

    // Trigger the chat message event
    triggerChatMessage(firebotChatMessage.userId, firebotChatMessage.username, firebotChatMessage);

    // Maybe trigger viewer arrived event
    if (integration.kick.chatManager.checkViewerArrived(payload.sender.userId)) {
        triggerViewerArrived(
            firebotChatMessage.username,
            firebotChatMessage.userId,
            firebotChatMessage.userDisplayName || viewer?.username || firebotChatMessage.username,
            firebotChatMessage.rawText,
            firebotChatMessage
        );
    }

    // Send to the chat client
    if (integration.isChatFeedEnabled()) {
        const { frontendCommunicator } = firebot.modules;
        logger.debug(`Sending Kick chat message to Firebot: userId=${firebotChatMessage.userId}, profilePicUrl=${firebotChatMessage.profilePicUrl || "(empty)"}`);
        frontendCommunicator.send("twitch:chat:message", firebotChatMessage);
    }
}

function triggerChatMessage(userId: string, username: string, firebotChatMessage: FirebotChatMessage): void {
    const { eventManager } = firebot.modules;
    const metadata = {
        username: username,
        userId: userId,
        userDisplayName: firebotChatMessage.userDisplayName,
        twitchUserRoles: firebotChatMessage.roles,
        messageText: firebotChatMessage.rawText,
        messageId: firebotChatMessage.id,
        chatMessage: firebotChatMessage,
        platform: "kick"
    };

    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "chat-message", metadata);
    if (integration.getSettings().triggerTwitchEvents.chatMessage) {
        eventManager.triggerEvent("twitch", "chat-message", metadata);
    }
}

export function triggerViewerArrived(
    username: string,
    userId: string,
    userDisplayName: string,
    messageText: string,
    firebotChatMessage: FirebotChatMessage
) {
    const { eventManager } = firebot.modules;
    const metadata = {
        username: username,
        userId: userId,
        userDisplayName: userDisplayName,
        messageText: messageText,
        chatMessage: firebotChatMessage,
        platform: "kick"
    };

    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "viewer-arrived", metadata);
    if (integration.getSettings().triggerTwitchEvents.chatMessage) {
        eventManager.triggerEvent("twitch", "viewer-arrived", metadata);
    }
}

export class FirebotChatHelpers {
    getBadges(identity: KickIdentity): chatBadge[] {
        return identity.badges
            .map(badge => ({
                title: badge.type,
                url: IntegrationConstants.KICK_BADGE_DATA[badge.type] ? `data:image/svg+xml;base64,${btoa(IntegrationConstants.KICK_BADGE_DATA[badge.type])}` : ""
            }))
            .filter(badge => badge.url !== "");
    }

    getTwitchRoles(identity: KickIdentity): string[] {
        const roles = new Set<string>();

        identity.badges.forEach((badge) => {
            const twitchRoles = IntegrationConstants.KICK_ROLES_TO_TWITCH_ROLES[badge.type];
            if (twitchRoles) {
                for (const role of twitchRoles) {
                    roles.add(role);
                }
            }
        });

        return Array.from(roles);
    }

    async buildFirebotChatMessage(msg: ChatMessage, msgText: string) {
        const firebotChatMessage: FirebotChatMessage = {
            id: msg.messageId,
            username: kickifyUsername(msg.sender.username),
            userId: kickifyUserId(msg.sender.userId.toString()),
            userDisplayName: unkickifyUsername(msg.sender.username),
            profilePicUrl: msg.sender.profilePicture || "",
            customRewardId: undefined,
            isHighlighted: false,
            isAnnouncement: false,
            isHiddenFromChatFeed: false,
            isFirstChat: false,
            isReturningChatter: false,
            isReply: msg.repliesTo && msg.repliesTo.messageId ? true : undefined,
            replyParentMessageId: msg.repliesTo && msg.repliesTo.messageId ? msg.repliesTo.messageId : undefined,
            replyParentMessageText: msg.repliesTo && msg.repliesTo.content ? msg.repliesTo.content : undefined,
            replyParentMessageSenderUserId: msg.repliesTo && msg.repliesTo.sender.userId ? kickifyUserId(msg.repliesTo.sender.userId) : undefined,
            replyParentMessageSenderDisplayName: msg.repliesTo && msg.repliesTo.sender.displayName ? msg.repliesTo.sender.displayName : undefined,
            threadParentMessageId: undefined,
            threadParentMessageSenderUserId: undefined,
            threadParentMessageSenderDisplayName: undefined,

            //TODO: Waiting for EventSub to supply these 3 fields
            isRaider: false,
            raidingFrom: "",
            isSuspiciousUser: false,

            rawText: msgText,
            whisper: false,
            whisperTarget: undefined,
            action: false,
            tagged: false,
            isCheer: false,
            badges: this.getBadges(msg.sender.identity),
            parts: [],
            roles: [],
            isSharedChatMessage: false,
            sharedChatRoomId: undefined
        };

        const messageParts: FirebotParsedMessagePart[] = [];
        const emoteRegex = /\[emote:(\d+):([^\]\s]+)\]/g;
        let lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = emoteRegex.exec(msgText)) !== null) {
            // Add preceding text part if any. Any text must have length > 0 and whitespace will be trimmed.
            if (match.index > lastIndex) {
                const text = msgText.slice(lastIndex, match.index).trim();
                if (text.length > 0) {
                    messageParts.push({
                        type: "text",
                        text
                    });
                }
            }
            // Add emote part
            messageParts.push({
                type: "emote",
                id: match[1],
                url: `https://files.kick.com/emotes/${match[1]}/fullsize`
            });
            lastIndex = emoteRegex.lastIndex;
        }

        // Add any remaining text after the last emote
        if (lastIndex < msgText.length) {
            const text = msgText.slice(lastIndex).trim();
            if (text.length > 0) {
                messageParts.push({
                    type: "text",
                    text
                });
            }
        }
        firebotChatMessage.parts = messageParts;

        firebotChatMessage.isFounder = msg.sender.identity.badges.some(b => b.type === "founder");
        firebotChatMessage.isBroadcaster = msg.sender.identity.badges.some(b => b.type === "broadcaster");
        firebotChatMessage.isBot = kickifyUserId(msg.sender.userId) === kickifyUserId(integration.kick.bot?.userId || "");
        firebotChatMessage.isMod = msg.sender.identity.badges.some(b => b.type === "moderator");
        firebotChatMessage.isSubscriber = msg.sender.identity.badges.some(b => b.type === "subscriber");
        firebotChatMessage.isVip = msg.sender.identity.badges.some(b => b.type === "vip");

        firebotChatMessage.roles = this.getTwitchRoles(msg.sender.identity);

        firebotChatMessage.isCheer = false; // No equivalent on Kick at the moment

        firebotChatMessage.color = msg.sender.identity?.usernameColor || "";

        return firebotChatMessage;
    }
}
