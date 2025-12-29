import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { ChatManager } from "../internal/chat-manager";
import { logger } from "../main";
import { getPropertyFromChatMessage } from "../util/util";

type chatPlatformEffectParams = {
    alwaysSendKick?: boolean; // DEPRECATED
    alwaysSendTwitch?: boolean; // DEPRECATED
    chatterKick: "Streamer" | "Bot";
    chatterTwitch: "Streamer" | "Bot";
    copyMessageKick?: boolean;
    defaultSendKick: boolean;
    defaultSendTwitch: boolean;
    message: string;
    messageKick?: string;
    sendAsReply?: boolean;
    sendAsReplyKick?: boolean;
    skipKick?: boolean; // DEPRECATED
    skipTwitch?: boolean; // DEPRECATED
    sendTwitch: "never" | "always" | "trigger";
    sendKick: "never" | "always" | "trigger";
}

export const chatPlatformEffect: Firebot.EffectType<chatPlatformEffectParams> = {
    definition: {
        id: "mage-kick-integration:chat-platform",
        name: "Chat (Platform Aware) [DEPRECATED]",
        description: "Send a chat message to the platform from which the trigger originated. (This effect is deprecated, use 'Chat (Multi-Platform)' instead)",
        icon: "fad fa-comment-lines",
        categories: ["common", "chat based"],
        dependencies: ["chat"]
    },
    optionsTemplate: `
    <eos-container header="Message" pad-top="true">
        <eos-container header="Twitch" pad-top="true">
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

        <eos-container header="Kick" pad-top="true">
            <firebot-input
                model="effect.messageKick"
                use-text-area="true"
                placeholder-text="Enter message"
                rows="4"
                cols="40"
                menu-position="under"
                ng-if="!effect.copyMessageKick"
            />
            <div style="color: #fb7373;" ng-if="effect.messageKick && effect.messageKick.length > 500">Chat messages cannot be longer than 500 characters. This message will get automatically chunked into multiple messages if it is too long after all replace variables have been populated.</div>
            <div style="padding-top: 10pt;">
                <firebot-checkbox
                    label="Send the same message as above to Kick"
                    model="effect.copyMessageKick"
                    style="margin: 0px 15px 0px 0px"
                />
            </div>
        </eos-container>
    </eos-container>

    <eos-container header="Twitch Chat Settings" pad-top="true">
        <eos-container header="Send to Twitch" pad-top="true">
            <dropdown-select options="{always: 'Always', never: 'Never', trigger: 'When Trigger was on Twitch'}" selected="effect.sendTwitch"></dropdown-select>
        </eos-container>

        <eos-container header="Chat As" pad-top="true">
            <dropdown-select options="['Streamer', 'Bot']" selected="effect.chatterTwitch"></dropdown-select>
        </eos-container>

        <eos-container header="Options" pad-top="true">
            <firebot-checkbox
                label="Send as reply"
                tooltip="Replying only works within a Command or Chat Message event."
                model="effect.sendAsReply"
                style="margin: 0px 15px 0px 0px"
            />
        </eos-container>
    </eos-container>

    <eos-container header="Kick Chat Settings" pad-top="true">
        <eos-container header="Send to Kick" pad-top="true">
            <dropdown-select options="{always: 'Always', never: 'Never', trigger: 'When Trigger was on Kick'}" selected="effect.sendKick"></dropdown-select>
        </eos-container>

        <eos-container header="Chat As" pad-top="true">
            <dropdown-select options="['Streamer', 'Bot']" selected="effect.chatterKick"></dropdown-select>
        </eos-container>

        <eos-container header="Options" pad-top="true">
            <firebot-checkbox
                label="Send as reply"
                tooltip="Replying only works within a Command or Chat Message event."
                model="effect.sendAsReplyKick"
                style="margin: 0px 15px 0px 0px"
            />
        </eos-container>
    </eos-container>

    <eos-container header="Unknown Trigger Handling" pad-top="true">
        <p class="muted">If the trigger cannot be determined, send the message to:</p>

        <div style="display: flex; flex-direction: row; width: 100%; height: 36px; margin: 10px 0 10px; align-items: center;">
            <firebot-checkbox
                label="Kick"
                model="effect.defaultSendKick"
                style="margin: 0px 15px 0px 0px"
            />

            <firebot-checkbox
                label="Twitch"
                model="effect.defaultSendTwitch"
                style="margin: 0px 15px 0px 0px"
            />
        </div>
    </eos-container>
    `,
    optionsController: ($scope) => {
        if (!$scope.effect) {
            $scope.effect = {
                chatterKick: "Bot",
                chatterTwitch: "Bot",
                copyMessageKick: true,
                defaultSendKick: false,
                defaultSendTwitch: false,
                message: "",
                messageKick: "",
                sendAsReply: false,
                sendAsReplyKick: false,
                sendKick: "trigger",
                sendTwitch: "trigger"
            };
        }

        // Backward compatibility / update
        if ($scope.effect.sendKick === undefined) {
            $scope.effect.sendKick = $scope.effect.alwaysSendKick ? "always" : ($scope.effect.skipKick ? "never" : "trigger");
        }
        if ($scope.effect.sendTwitch === undefined) {
            $scope.effect.sendTwitch = $scope.effect.alwaysSendTwitch ? "always" : ($scope.effect.skipTwitch ? "never" : "trigger");
        }

        // Deprecation
        $scope.effect.alwaysSendKick = undefined;
        $scope.effect.skipKick = undefined;
        $scope.effect.alwaysSendTwitch = undefined;
        $scope.effect.skipTwitch = undefined;

        // Defaults
        if (typeof $scope.effect.copyMessageKick !== "boolean") {
            $scope.effect.copyMessageKick = true;
        }
        if (typeof $scope.effect.sendAsReply !== "boolean") {
            $scope.effect.sendAsReply = false;
        }
        if (typeof $scope.effect.sendAsReplyKick !== "boolean") {
            $scope.effect.sendAsReplyKick = false;
        }
        if (typeof $scope.effect.message !== "string") {
            $scope.effect.message = "";
        }
        if (typeof $scope.effect.messageKick !== "string") {
            $scope.effect.messageKick = "";
        }
        if (typeof $scope.effect.defaultSendKick !== "boolean") {
            $scope.effect.defaultSendKick = false;
        }
        if (typeof $scope.effect.defaultSendTwitch !== "boolean") {
            $scope.effect.defaultSendTwitch = false;
        }
        if (!$scope.effect.chatterKick) {
            $scope.effect.chatterKick = "Bot";
        }
        if (!$scope.effect.chatterTwitch) {
            $scope.effect.chatterTwitch = "Bot";
        }
        if (typeof $scope.effect.copyMessageKick !== "boolean") {
            $scope.effect.copyMessageKick = false;
        }
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.message == null || effect.message === "") {
            errors.push("Chat message can't be blank.");
        }
        if (!effect.copyMessageKick && (effect.messageKick == null || effect.messageKick === "")) {
            errors.push("Kick chat message can't be blank when separate messages are enabled.");
        }
        if (!effect.sendKick) {
            errors.push("You must specify an option of when to send messages to Kick.");
        }
        if (!effect.sendTwitch) {
            errors.push("You must specify an option of when to send messages to Twitch.");
        }
        return errors;
    },
    onTriggerEvent: async ({ effect, trigger }) => {
        // Handle deprecated parameters gracefully
        if (effect.sendKick === undefined) {
            effect.sendKick = effect.alwaysSendKick ? "always" : (effect.skipKick ? "never" : "trigger");
        }
        if (effect.sendTwitch === undefined) {
            effect.sendTwitch = effect.alwaysSendTwitch ? "always" : (effect.skipTwitch ? "never" : "trigger");
        }

        // The user ID determines which platform the message came from.
        const platform = ChatManager.getPlatformFromTrigger(trigger);

        // Send the message via the Kick
        if ((platform === "kick" && effect.sendKick === "trigger") || (platform === "unknown" && effect.defaultSendKick && effect.sendKick === "trigger") || effect.sendKick === "always") {
            let messageId = undefined;
            if (effect.sendAsReplyKick && platform === 'kick') {
                messageId = getPropertyFromChatMessage(trigger, 'id') || undefined;
            }

            logger.debug(`Sending message to Kick. (Reply: ${messageId ? messageId : "N/A"})`);
            const messageToSend = effect.copyMessageKick ? effect.message : effect.messageKick || effect.message;
            await integration.kick.chatManager.sendKickChatMessage(messageToSend, effect.chatterKick || "Streamer", messageId);
        }

        // Send the message via Twitch
        if ((platform === "twitch" && effect.sendTwitch === "trigger") || (platform === "unknown" && effect.defaultSendTwitch && effect.sendTwitch === "trigger") || effect.sendTwitch === "always") {
            let messageId = undefined;
            if (effect.sendAsReply && platform === 'twitch') {
                messageId = getPropertyFromChatMessage(trigger, 'id') || undefined;
            }

            logger.debug(`Sending message to Twitch. (Reply: ${messageId ? messageId : "N/A"})`);
            const { twitchChat } = integration.getModules();
            await twitchChat.sendChatMessage(effect.message, "", effect.chatterTwitch !== "Streamer" ? "bot" : "streamer", messageId);
        }

        return true;
    }
};
