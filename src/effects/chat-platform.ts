import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { ChatManager } from "../internal/chat-manager";

type chatPlatformEffectParams = {
    alwaysSendKick?: boolean;
    alwaysSendTwitch?: boolean;
    chatterKick: "Streamer" | "Bot";
    chatterTwitch: "Streamer" | "Bot";
    copyMessageKick?: boolean;
    defaultSendKick: boolean;
    defaultSendTwitch: boolean;
    message: string;
    messageKick?: string;
    sendAsReply?: boolean;
    skipKick?: boolean;
    skipTwitch?: boolean;
}

export const chatPlatformEffect: Firebot.EffectType<chatPlatformEffectParams> = {
    definition: {
        id: "mage-kick-integration:chat-platform",
        name: "Chat (Platform Aware)",
        description: "Send a chat message to the platform from which the trigger originated.",
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
                    label="Use the Twitch message for Kick"
                    model="effect.copyMessageKick"
                    style="margin: 0px 15px 0px 0px"
                />
            </div>
        </eos-container>
    </eos-container>

    <eos-container header="Twitch Chat Settings" pad-top="true">
        <eos-container header="Chat As" pad-top="true">
            <dropdown-select options="['Streamer', 'Bot']" selected="effect.chatterTwitch"></dropdown-select>
        </eos-container>

        <eos-container header="Twitch Options" pad-top="true">
            <firebot-checkbox
                label="Send as reply"
                tooltip="Replying only works within a Command or Chat Message event and currently only works on Twitch."
                model="effect.sendAsReply"
                style="margin: 0px 15px 0px 0px"
            />

            <firebot-checkbox
                label="Always send to Twitch"
                model="effect.alwaysSendTwitch"
                style="margin: 0px 15px 0px 0px"
            />

            <firebot-checkbox
                label="Never send to Twitch"
                model="effect.skipTwitch"
                style="margin: 0px 15px 0px 0px"
            />
        </div>
    </eos-container>

    <eos-container header="Kick Chat Settings" pad-top="true">
        <eos-container header="Chat As" pad-top="true">
            <dropdown-select options="['Streamer', 'Bot']" selected="effect.chatterKick"></dropdown-select>
        </eos-container>

        <eos-container header="Kick Options" pad-top="true">
            <firebot-checkbox
                label="Always send to Kick"
                model="effect.alwaysSendKick"
                style="margin: 0px 15px 0px 0px"
            />

            <firebot-checkbox
                label="Never send to Kick"
                model="effect.skipKick"
                style="margin: 0px 15px 0px 0px"
            />
        </div>
    </eos-container>

    <eos-container header="Undefined Trigger Handling" pad-top="true">
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
                chatterKick: "Streamer",
                chatterTwitch: "Bot",
                copyMessageKick: true,
                defaultSendKick: false,
                defaultSendTwitch: false,
                message: "",
                messageKick: "",
                sendAsReply: false,
                skipKick: false,
                skipTwitch: false
            };
        }
        if (typeof $scope.effect.copyMessageKick !== "boolean") {
            $scope.effect.copyMessageKick = true;
        }
        if (typeof $scope.effect.skipKick !== "boolean") {
            $scope.effect.skipKick = false;
        }
        if (typeof $scope.effect.skipTwitch !== "boolean") {
            $scope.effect.skipTwitch = false;
        }
        if (typeof $scope.effect.sendAsReply !== "boolean") {
            $scope.effect.sendAsReply = false;
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
            $scope.effect.chatterKick = "Streamer";
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
        if (effect.alwaysSendKick && effect.skipKick) {
            errors.push("You cannot always send to Kick and skip sending to Kick at the same time.");
        }
        if (effect.alwaysSendTwitch && effect.skipTwitch) {
            errors.push("You cannot always send to Twitch and skip sending to Twitch at the same time.");
        }
        return errors;
    },
    onTriggerEvent: async ({ effect, trigger }) => {
        // The user ID determines which platform the message came from.
        const platform = ChatManager.getPlatformFromTrigger(trigger);

        // Send the message via the Kick
        if (platform === "kick" || (platform === "" && effect.defaultSendKick) || effect.alwaysSendKick) {
            if (effect.skipKick) {
                logger.debug("Skipping sending message to Kick as per effect settings.");
            } else {
                logger.debug("Sending message to Kick.");
                const messageToSend = effect.copyMessageKick ? effect.message : effect.messageKick || effect.message;
                await integration.kick.chatManager.sendKickChatMessage(messageToSend, effect.chatterKick || "Streamer");
            }
        }

        // Send the message via Twitch
        if (platform === "twitch" || (platform === "" && effect.defaultSendTwitch) || effect.alwaysSendTwitch) {
            if (effect.skipTwitch) {
                logger.debug("Skipping sending message to Twitch as per effect settings.");
            } else {
                let messageId = undefined;
                if (trigger.type === "command") {
                    messageId = trigger.metadata.chatMessage.id;
                } else if (trigger.type === "event") {
                    const chatMsg = trigger.metadata.eventData?.chatMessage;
                    if (chatMsg && typeof chatMsg === "object" && "id" in chatMsg) {
                        messageId = (chatMsg as { id: string }).id;
                    }
                }

                logger.debug("Sending message to Twitch.");
                const { twitchChat } = firebot.modules;
                await twitchChat.sendChatMessage(effect.message, "", effect.chatterTwitch !== "Streamer" ? "bot" : "streamer", messageId);
            }
        }

        return true;
    }
};
