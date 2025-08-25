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

export async function handleChatMessageSentEvent(payload: ChatMessage, delay = 0): Promise<void> {
    // Basic message parsing
    const helpers = new FirebotChatHelpers();
    const firebotChatMessage = await helpers.buildFirebotChatMessage(payload, payload.content);

    // Need to do better than this when we see more badge examples
    const badgeRoles: string[] = helpers.getBadges(payload.sender.identity).map(b => b.title);
    const possibleBadges: string[] = ["broadcaster", "moderator"];

    // Create user if they do not exist, and increment their chat messages
    let viewer = await integration.kick.userManager.getViewerById(payload.sender.userId);
    if (viewer) {
        await integration.kick.userManager.syncViewerRoles(viewer._id, badgeRoles, possibleBadges);
    } else {
        viewer = await integration.kick.userManager.createNewViewer(payload.sender, [], true);
        if (!viewer) {
            logger.error(`Failed to create new viewer for userId=${payload.sender.userId}`);
            return;
        }
    }

    // This might be delayed -- the webhook contains more information than
    // pusher (e.g. badges) but the pusher message usually comes first. However
    // the webhooks are sometimes delayed, so we don't want to wait too long for
    // the webhook to come either. This tries to make the best operational
    // choice.
    if (delay > 0) {
        logger.debug(`handleChatMessageSentEvent: Delaying message processing by ${delay} seconds`);
        await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    // Skip duplicate messages here
    const isRegistered = await integration.kick.chatManager.registerMessage(payload.messageId, 'kick');
    if (!isRegistered) {
        logger.debug(`Duplicate chat message ignored: id=${payload.messageId}`);
        return;
    }

    // Update chat message count
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
    getBadges(identity: KickIdentity): chatBadge[] {
        return identity.badges
            .map(badge => ({
                title: badge.type,
                url: IntegrationConstants.KICK_BADGE_URLS[badge.type] || ""
            }))
            .filter(badge => badge.url !== "");
    }

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

        firebotChatMessage.isFounder = msg.sender.identity.badges.some(b => b.type === "og");
        firebotChatMessage.isBroadcaster = msg.sender.identity.badges.some(b => b.type === "broadcaster");
        firebotChatMessage.isBot = false; // We can maybe determine this later
        firebotChatMessage.isMod = msg.sender.identity.badges.some(b => b.type === "moderator");
        firebotChatMessage.isSubscriber = msg.sender.identity.badges.some(b => b.type === "subscriber");
        firebotChatMessage.isVip = msg.sender.identity.badges.some(b => b.type === "vip");

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
