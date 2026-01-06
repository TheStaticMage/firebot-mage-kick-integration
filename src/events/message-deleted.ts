import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";

export interface MessageDeletedPayload {
    id: string;
    message: {
        id: string;
    };
    aiModerated: boolean;
    violatedRules: string[];
}

export async function handleMessageDeletedEvent(payload: MessageDeletedPayload): Promise<void> {
    const messageId = payload.message.id;
    logger.debug(`Message deleted: ${messageId}`);

    const chatMessage = integration.kick.chatManager.getChatMessage(messageId);
    if (!chatMessage) {
        logger.debug(`No cached chat message found for ${messageId}; firing Chat Message Deleted with limited metadata.`);
    }

    const metadata = {
        username: chatMessage?.username ?? "",
        userId: chatMessage?.userId ?? "",
        userDisplayName: chatMessage?.userDisplayName ?? chatMessage?.username ?? "",
        messageText: chatMessage?.rawText ?? "",
        messageId,
        platform: "kick"
    };

    const { frontendCommunicator, eventManager } = firebot.modules;
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "chat-message-deleted", metadata);

    if (integration.getSettings().triggerTwitchEvents.chatMessage) {
        eventManager.triggerEvent("twitch", "chat-message-deleted", metadata);
    }

    frontendCommunicator.send("twitch:chat:message:deleted", messageId);
    integration.kick.chatManager.forgetMessage(messageId);
}
