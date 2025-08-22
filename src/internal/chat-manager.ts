import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { firebot, logger } from "../main";
import { platformVariable } from "../variables/platform";
import { Kick } from "./kick";
import { integration } from "../integration";

interface inboundSendChatMessage {
    message: string,
    accountType: "Streamer" | "Bot",
    replyToMessageId: string | undefined
}

export class ChatManager {
    private isListeningForChatMessages = false;
    private isRunning = false;
    private kick: Kick;
    private messagePlatform: Record<string, 'twitch' | 'kick' | 'unknown'> = {};
    private viewerArrivedCache = new Set<string>();

    constructor(kick: Kick) {
        this.kick = kick;
    }

    async start(): Promise<void> {
        logger.debug("Starting ChatManager...");

        if (!this.isListeningForChatMessages) {
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.onAsync("send-chat-message", this.handleChatMessageTypedInChatFeed.bind(this));
            this.isListeningForChatMessages = true;
        }

        this.isRunning = true;
        return;
    }

    async stop(): Promise<void> {
        logger.debug("Stopping ChatManager...");
        this.isRunning = false;
        // Currently not possible to un-listen to frontendCommunicator events
        return;
    }

    private async handleChatMessageTypedInChatFeed(payload: inboundSendChatMessage): Promise<boolean> {
        logger.debug("Handling chat message from frontend");

        if (!this.isRunning) {
            logger.warn("ChatManager is not running. Ignoring inbound chat message.");
            return false;
        }

        if (!integration.getSettings().chat.chatSend) {
            logger.debug("Not sending message typed in chat feed: This option is disabled in the settings.");
            return false;
        }

        // Slash commands in the message are not implemented (yet).
        if (payload.message.startsWith("/")) {
            logger.debug(`Not sending unimplemented slash command as a Kick chat message: ${payload.message}`);
            return false;
        }

        // Handle the chat message
        return this.sendKickChatMessage(payload.message, payload.accountType, payload.replyToMessageId);
    }

    async registerMessage(messageId: string, platform: 'twitch' | 'kick' | 'unknown'): Promise<boolean> {
        if (this.messagePlatform[messageId]) {
            return false;
        }
        this.messagePlatform[messageId] = platform;
        return true;
    }

    async sendKickChatMessage(msg: string, chatter: "Streamer" | "Bot", replyToMessageId: string | undefined = undefined): Promise<boolean> {
        // This could get called with a twitch message ID, so we're going to
        // make sure that we have seen the Kick message we are supposedly
        // replying to. This can avoid problems with the API call.
        if (replyToMessageId && (!this.messagePlatform[replyToMessageId] || this.messagePlatform[replyToMessageId] !== 'kick')) {
            logger.debug(`Discarding reply-to with non-Kick message ID: ${replyToMessageId}`);
            replyToMessageId = undefined;
        }

        const segments: string[] = [];
        const maxLen = 500;
        while (msg.length > 0) {
            if (msg.length <= maxLen) {
                segments.push(msg);
                break;
            }
            // Try to split at the last space before maxLen
            let splitIdx = msg.lastIndexOf(' ', maxLen);
            if (splitIdx === -1 || splitIdx < maxLen * 0.5) {
                // No reasonable space found, hard split
                splitIdx = maxLen;
            }
            segments.push(msg.slice(0, splitIdx));
            msg = msg.slice(splitIdx).trimStart();
        }
        for (const segment of segments) {
            await this.sendChatMessage(segment, chatter || "Streamer", replyToMessageId);
        }
        return true;
    }

    private async sendChatMessage(message: string, chatter: "Streamer" | "Bot", replyToMessageId: string | undefined = undefined): Promise<void> {
        if (!this.kick.broadcaster) {
            logger.error("Cannot send chat message, broadcaster info not available.");
            return;
        }

        if (chatter === "Bot" && !this.kick.bot) {
            logger.warn("Cannot send chat message as Bot as bot account is not authorized. Falling back to streamer.");
            chatter = "Streamer";
        }

        const payload: Record<string, any> = {
            content: message,
            type: "user", // "bot" here is the registered Kick integration, not the second account registered as the bot
            // eslint-disable-next-line camelcase
            broadcaster_user_id: this.kick.broadcaster.userId
        };
        if (replyToMessageId) {
            // eslint-disable-next-line camelcase
            payload.reply_to_message_id = replyToMessageId;
        }

        try {
            await this.kick.httpCallWithTimeout('/public/v1/chat', "POST", JSON.stringify(payload), null, undefined, chatter === "Bot" ? this.kick.getBotAuthToken() : this.kick.getAuthToken());
            logger.debug(`Successfully sent chat message as ${chatter}`);
        } catch (error) {
            logger.error(`Failed to send chat message: ${error}`);
        }
    }

    checkViewerArrived(userId: string): boolean {
        if (this.viewerArrivedCache.has(userId)) {
            return false;
        }
        this.viewerArrivedCache.add(userId);
        return true;
    }

    static getPlatformFromTrigger(trigger: Effects.Trigger): string {
        try {
            return platformVariable.evaluator(trigger) || "unknown";
        } catch (error) {
            logger.error(`Error determining platform from trigger: ${error}`);
            return "unknown";
        }
    }
}
