import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { getPropertyFromChatMessage } from '../util/util';

export const kickChatMessageVariable: ReplaceVariable = {
    definition: {
        handle: "kickChatMessage",
        description: "Outputs the chat message from the associated command or event.",
        triggers: {
            "manual": true,
            "event": [
                "mage-kick-integration:chat-message",
                "mage-kick-integration:chat-message-deleted",
                "mage-kick-integration:viewer-arrived"
            ]
        },
        categories: ["common"],
        possibleDataOutput: ["number", "text"]
    },
    evaluator: (trigger: Trigger) => {
        let chatMessage = getPropertyFromChatMessage(trigger, 'rawText');
        if (!chatMessage || chatMessage.trim() === "") {
            // if trigger is event/manual event, build chat message from chat event data
            chatMessage = typeof trigger.metadata.eventData?.messageText === "string"
                ? trigger.metadata.eventData.messageText
                : "";
        }

        return chatMessage.trim();
    }
};
