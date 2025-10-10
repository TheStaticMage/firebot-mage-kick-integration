import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { getPropertyFromChatMessage } from "../util/util";

type chatEffectParams = {
    chatter: "Streamer" | "Bot";
    message: string;
    sendAsReply: boolean;
}

export const chatEffect: Firebot.EffectType<chatEffectParams> = {
    definition: {
        id: "mage-kick-integration:chat",
        name: "Chat (Kick)",
        description: "Send a chat message to Kick.",
        icon: "fad fa-comment-lines",
        categories: ["common", "chat based"],
        dependencies: ["chat"]
    },
    optionsTemplate: `
    <eos-chatter-select effect="effect" title="Chat as"></eos-chatter-select>

    <eos-container header="Message To Send" pad-top="true">
        <firebot-input
            model="effect.message"
            use-text-area="true"
            placeholder-text="Enter message"
            rows="4"
            cols="40"
            menu-position="under"
        />
        <div style="color: #fb7373;" ng-if="effect.message && effect.message.length > 500">Chat messages cannot be longer than 500 characters. This message will get automatically chunked into multiple messages if it is too long after all replace variables have been populated.</div>
        <div style="display: flex; flex-direction: row; width: 100%; height: 36px; margin: 10px 0 10px; align-items: center;">
            <firebot-checkbox
                label="Send as reply"
                tooltip="Replying only works within a Command or Chat Message event"
                model="effect.sendAsReply"
                style="margin: 0px 15px 0px 0px"
            />
        </div>
    </eos-container>
    `,
    optionsController: () => {
        //
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.message == null || effect.message === "") {
            errors.push("Chat message can't be blank.");
        }
        return errors;
    },
    onTriggerEvent: async ({ trigger, effect }) => {
        let messageId: string | undefined = undefined;
        if (effect.sendAsReply) {
            messageId = getPropertyFromChatMessage(trigger, 'id') || undefined;
        }

        await integration.kick.chatManager.sendKickChatMessage(effect.message, effect.chatter || "Streamer", messageId);
        return true;
    }
};
