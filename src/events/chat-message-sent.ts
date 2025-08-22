import { FirebotChatMessage, FirebotParsedMessagePart } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { commandHandler } from "../internal/command";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { ChatMessage } from "../shared/types";

export async function handleChatMessageSentEvent(payload: ChatMessage): Promise<void> {
    const isRegistered = await integration.kick.chatManager.registerMessage(payload.messageId, 'kick');
    if (!isRegistered) {
        logger.debug(`Duplicate chat message ignored: id=${payload.messageId}`);
        return;
    }

    // Basic message parsing
    const helpers = new FirebotChatHelpers();
    const firebotChatMessage = await helpers.buildFirebotChatMessage(payload, payload.content);

    // Need to do better than this when we see more badge examples
    firebotChatMessage.badges = [];
    if (payload.sender.identity && payload.sender.identity.badges) {
        for (const badge of payload.sender.identity.badges) {
            switch (badge.type) {
                case "broadcaster":
                    // eslint-disable-next-line camelcase
                    firebotChatMessage.badges.push({ set_id: "mod", id: "1", info: badge.text });
                    break;
                default:
                    logger.debug(`Unknown badge type: type=${badge.type} text=${badge.text}`);
                    break;
            }
        }
    }

    // Create user if they do not exist, and increment their chat messages
    let viewer = await integration.kick.userManager.getViewerById(payload.sender.userId);
    if (!viewer) {
        viewer = await integration.kick.userManager.createNewViewer(payload.sender, [], true);
        if (!viewer) {
            logger.error(`Failed to create new viewer for userId=${payload.sender.userId}`);
            return;
        }
    }
    await integration.kick.userManager.incrementDbField(viewer._id, "chatMessages");

    // Command checking.
    await commandHandler.handleChatMessage(firebotChatMessage);

    // Trigger the chat message event
    triggerChatMessage(firebotChatMessage.userId, firebotChatMessage.username, firebotChatMessage);

    // Maybe trigger viewer arrived event
    if (integration.kick.chatManager.checkViewerArrived(viewer._id)) {
        triggerViewerArrived(
            firebotChatMessage.username,
            firebotChatMessage.userId,
            firebotChatMessage.userDisplayName || viewer.username || firebotChatMessage.username,
            firebotChatMessage.rawText,
            firebotChatMessage
        );
    }

    // Send to the chat client
    if (integration.isChatFeedEnabled()) {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("twitch:chat:message", firebotChatMessage);
    }
}

function triggerChatMessage(userId: string, username: string, firebotChatMessage: FirebotChatMessage): void {
    const { eventManager } = firebot.modules;
    const metadata = {
        username: username,
        userId: userId,
        userDisplayName: firebotChatMessage.userDisplayName,
        twitchUserRoles: [],
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

class FirebotChatHelpers {
    async buildFirebotChatMessage(msg: ChatMessage, msgText: string) {
        const firebotChatMessage: FirebotChatMessage = {
            id: msg.messageId,
            username: kickifyUsername(msg.sender.username),
            userId: kickifyUserId(msg.sender.userId.toString()),
            userDisplayName: unkickifyUsername(msg.sender.username),
            //profilePicUrl: msg.sender.profilePicture, // Currently broken, see https://github.com/KickEngineering/KickDevDocs/issues/166
            profilePicUrl: "https://kick.com/favicon.ico",
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
            badges: [],
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

        firebotChatMessage.isFounder = false; // Kick doesn't have a founder badge
        firebotChatMessage.isBroadcaster = msg.broadcaster.userId === msg.sender.userId;
        firebotChatMessage.isBot = false; // We can maybe determine this later
        firebotChatMessage.isMod = false; // We can maybe determine this later
        firebotChatMessage.isSubscriber = false; // We can maybe determine this later
        firebotChatMessage.isVip = false; // Kick doesn't have a VIP badge

        if (firebotChatMessage.isFounder) {
            firebotChatMessage.roles.push("founder");
            firebotChatMessage.roles.push("sub");
        } else if (firebotChatMessage.isSubscriber) {
            firebotChatMessage.roles.push("sub");
        }

        if (firebotChatMessage.isMod) {
            firebotChatMessage.roles.push("mod");
        }

        if (firebotChatMessage.isVip) {
            firebotChatMessage.roles.push("vip");
        }

        firebotChatMessage.isCheer = false; // No equivalent on Kick at the moment

        firebotChatMessage.color = msg.sender.identity?.usernameColor || "";

        return firebotChatMessage;
    }
}
