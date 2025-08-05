import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";

type chatEffectParams = {
    chatter: "Streamer" | "Bot";
    message: string;
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
    onTriggerEvent: async ({ effect }) => {
        await integration.kick.chatManager.sendKickChatMessage(effect.message, effect.chatter || "Streamer");
        return true;
    }
};
