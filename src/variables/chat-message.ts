import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const kickChatMessageVariable: ReplaceVariable = {
    definition: {
        handle: "kickChatMessage",
        description: "Outputs the chat message from the associated command or event.",
        triggers: {
            "manual": true,
            "event": [
                "mage-kick-integration:chat-message",
                "mage-kick-integration:viewer-arrived"
            ]
        },
        categories: ["common"],
        possibleDataOutput: ["number", "text"]
    },
    evaluator: (trigger: Effects.Trigger) => {
        let chatMessage = "";
        if (trigger.metadata.chatMessage) {
            chatMessage = trigger.metadata.chatMessage.rawText;
        } else if (trigger.type === "event" || trigger.type === "manual") {
            // if trigger is event/manual event, build chat message from chat event data
            chatMessage = typeof trigger.metadata.eventData?.messageText === "string"
                ? trigger.metadata.eventData.messageText
                : "";
        }

        return chatMessage.trim();
    }
};
