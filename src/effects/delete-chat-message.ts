import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { IntegrationConstants } from "../constants";
import { getPropertyFromChatMessage } from "../util/util";

export const deleteChatMessageEffect: Firebot.EffectType<any> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:delete-chat-message`,
        name: "Delete Chat Message (Kick)",
        description: "Delete the associated chat message",
        icon: "fad fa-comment-times",
        categories: ["chat based", "advanced"],
        dependencies: ["chat"],
        triggers: {
            command: true,
            event: [`${IntegrationConstants.INTEGRATION_ID}:chat-message`]
        }
    },
    optionsTemplate: `
        <eos-container>
            <p>This effect deletes the associated chat message (for a Command or Chat Message Event)</p>
        </eos-container>
    `,
    onTriggerEvent: async ({ trigger }) => {
        const chatMessageId = getPropertyFromChatMessage(trigger, "id");
        const eventMessageId = trigger.metadata.eventData?.messageId;

        let messageId: string | null = null;
        if (typeof chatMessageId === "string" && chatMessageId !== "") {
            messageId = chatMessageId;
        } else if (typeof eventMessageId === "string" && eventMessageId !== "") {
            messageId = eventMessageId;
        } else if (typeof eventMessageId === "number") {
            messageId = eventMessageId.toString();
        }

        if (!messageId) {
            logger.error("No message ID found in trigger context");
            return false;
        }

        const success = await integration.kick.chatManager.deleteKickChatMessage(messageId);
        if (!success) {
            logger.error(`Failed to delete message ${messageId} via the Delete Chat Message effect.`);
            return false;
        }

        logger.debug(`Message ${messageId} was deleted via the Delete Chat Message effect.`);
        return true;
    }
};
