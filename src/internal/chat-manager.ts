import type { FirebotChatMessage } from "@crowbartools/firebot-custom-scripts-types/types/chat";
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { getPlatformFromTrigger } from "./platform-detection";
import { Kick } from "./kick";
import { MessageQueue } from "./message-queue";

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
    private messageCache: Record<string, FirebotChatMessage> = {};
    private messageCacheOrder: string[] = [];
    private readonly maxCachedMessages = 100;
    private viewerArrivedCache = new Set<string>();
    private messageQueue: MessageQueue;

    constructor(kick: Kick) {
        this.kick = kick;
        this.messageQueue = new MessageQueue(this.sendKickChatMessage.bind(this));
    }

    async start(): Promise<void> {
        logger.debug("Starting ChatManager...");

        if (!this.isListeningForChatMessages) {
            const { frontendCommunicator } = firebot.modules;
            frontendCommunicator.onAsync("send-chat-message", this.handleChatMessageTypedInChatFeed.bind(this));
            frontendCommunicator.onAsync("delete-message", this.handleDeleteMessage.bind(this));
            this.isListeningForChatMessages = true;
        }

        this.messageQueue.start();
        this.isRunning = true;
        return;
    }

    async stop(): Promise<void> {
        logger.debug("Stopping ChatManager...");
        this.messageQueue.stop();
        this.isRunning = false;
        // Currently not possible to un-listen to frontendCommunicator events
        return;
    }

    private async handleChatMessageTypedInChatFeed(payload: inboundSendChatMessage): Promise<boolean> {
        logger.debug(`Handling chat message from frontend: ${JSON.stringify(payload)}`);

        if (!this.isRunning) {
            logger.warn("ChatManager is not running. Ignoring inbound chat message.");
            return false;
        }

        if (!integration.getSettings().chat.chatSend) {
            logger.debug("Not sending message typed in chat feed: This option is disabled in the settings.");
            return false;
        }

        // Many slash commands are implemented in Firebot, but only some are
        // available for Kick.
        if (payload.message.startsWith("/")) {
            try {
                return await this.handleSlashCommand(payload);
            } catch (error) {
                logger.error(`Error handling slash command: ${error}`);
                return false;
            }
        }

        // Handle the chat message
        return this.sendKickChatMessage(payload.message, payload.accountType, payload.replyToMessageId);
    }

    async handleDeleteMessage(messageId: string): Promise<boolean> {
        // Check if this is a Kick message
        const platform = this.messagePlatform[messageId];
        if (platform !== 'kick') {
            logger.debug(`Message ${messageId} is not a Kick message (platform: ${platform}). Skipping Kick deletion.`);
            return false;
        }

        return this.deleteKickChatMessage(messageId);
    }

    async registerMessage(
        messageId: string,
        platform: 'twitch' | 'kick' | 'unknown',
        chatMessage?: FirebotChatMessage
    ): Promise<boolean> {
        if (this.messagePlatform[messageId]) {
            return false;
        }
        this.messagePlatform[messageId] = platform;
        if (chatMessage) {
            this.messageCache[messageId] = chatMessage;
            this.messageCacheOrder.push(messageId);
            if (this.messageCacheOrder.length > this.maxCachedMessages) {
                const evictedId = this.messageCacheOrder.shift();
                if (evictedId) {
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete this.messageCache[evictedId];
                    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                    delete this.messagePlatform[evictedId];
                }
            }
        }
        return true;
    }

    getChatMessage(messageId: string): FirebotChatMessage | undefined {
        return this.messageCache[messageId];
    }

    forgetMessage(messageId: string): void {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.messagePlatform[messageId];
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete this.messageCache[messageId];
        this.messageCacheOrder = this.messageCacheOrder.filter(id => id !== messageId);
    }

    enqueueMessage(message: string, chatter: "Streamer" | "Bot", replyToMessageId?: string): string {
        return this.messageQueue.enqueue(message, chatter, replyToMessageId);
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

    async deleteKickChatMessage(messageId: string): Promise<boolean> {
        if (!this.kick.broadcaster) {
            logger.error("Cannot delete chat message, broadcaster info not available.");
            return false;
        }

        try {
            await this.kick.httpCallWithTimeout(`/public/v1/chat/${messageId}`, "DELETE", "", null, undefined, this.kick.getAuthToken());
            logger.debug(`Successfully deleted chat message: ${messageId}`);
            return true;
        } catch (error) {
            logger.error(`Failed to delete chat message (${messageId}): ${error}`);
            return false;
        }
    }

    checkViewerArrived(userId: string): boolean {
        if (this.viewerArrivedCache.has(userId)) {
            return false;
        }
        this.viewerArrivedCache.add(userId);
        return true;
    }

    static getPlatformFromTrigger(trigger: Trigger): string {
        try {
            return getPlatformFromTrigger(trigger) || "unknown";
        } catch (error) {
            logger.error(`Error determining platform from trigger: ${error}`);
            return "unknown";
        }
    }

    private async handleSlashCommand(payload: inboundSendChatMessage): Promise<boolean> {
        const parts = payload.message.trim().split(/\s+/);
        const command = parts[0].toLowerCase();
        const args = parts.slice(1);
        logger.debug(`Handling slash command: ${command} with args: ${args.join(' ')}`);

        switch (command) {
            case "/ban": {
                if (args.length === 0) {
                    throw new Error("Usage: /ban <user> [reason]");
                }
                const reason = args.length > 1 ? args.slice(1).join(' ') : 'No reason given';
                const success = await this.kick.userApi.banUserByUsername(args[0], 0, true, reason);
                if (!success) {
                    throw new Error(`Failed to ban user: ${args[0]}`);
                }
                return true;
            }
            case "/timeout": {
                if (args.length < 2) {
                    throw new Error("Usage: /timeout <user> <duration> [reason]");
                }
                const durationSeconds = parseInt(args[1], 10);
                if (isNaN(durationSeconds) || durationSeconds <= 0) {
                    throw new Error("Duration must be a positive integer representing seconds.");
                }

                // Convert seconds to minutes with required constraints
                let durationMinutes: number;
                if (durationSeconds < 60) {
                    // Round up any value below 1 minute to 1 minute
                    durationMinutes = 1;
                } else {
                    // Round to nearest minute
                    durationMinutes = Math.round(durationSeconds / 60);
                }

                // Check maximum limit (10800 minutes)
                if (durationMinutes > 10800) {
                    throw new Error("Timeout duration cannot exceed 10800 minutes (7.5 days).");
                }

                const reason = args.length > 2 ? args.slice(2).join(' ') : 'No reason given';
                const success = await this.kick.userApi.banUserByUsername(args[0], durationMinutes, true, reason);
                if (!success) {
                    throw new Error(`Failed to timeout user: ${args[0]}`);
                }
                return true;
            }
            case "/unban":
            case "/untimeout": {
                if (args.length === 0) {
                    throw new Error(`Usage: ${command} <user>`);
                }
                const success = await this.kick.userApi.banUserByUsername(args[0], 0, false);
                if (!success) {
                    throw new Error(`Failed to unban/untimeout user: ${args[0]}`);
                }
                return true;
            }
            case "/announce":
            case "/announceblue":
            case "/announcegreen":
            case "/announceorange":
            case "/announcepurple": {
                // Kick doesn't have an announcement feature per se, so we'll
                // just post this message in the chat.
                if (args.length === 0) {
                    throw new Error(`No message specified for ${command} command.`);
                }
                const message = args.join(' ');
                await this.sendKickChatMessage(`[Announcement] ${message}`, payload.accountType, undefined);
                return true;
            }
        }

        logger.warn(`Slash command ${command} is not implemented for Kick. Ignoring.`);
        return false;
    }
}
