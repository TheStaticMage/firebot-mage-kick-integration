import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { handleRewardRedeemedEvent } from "../../events/reward-redeemed-event";
import { integration } from "../../integration";
import { logger } from "../../main";
import { ChatMessage, KickUser, RewardRedeemedEvent } from "../../shared/types";
import { parseDate } from "../util";

const Pusher = require('pusher-js');

export class KickPusher {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private pusher: typeof Pusher | null = null;

    connect(pusherAppKey: string, chatroomId: string, channelId: string): void {
        if (!pusherAppKey) {
            logger.warn("Pusher cannot connect: App Key is missing.");
            this.pusher = null;
            throw new Error("Pusher App Key is required");
        }

        if (!channelId && !chatroomId) {
            logger.warn("Pusher will not connect: No subscriptions available (Channel ID and Chatroom ID are both missing).");
            this.pusher = null;
            throw new Error("Pusher Channel ID and Chatroom ID are required");
        }

        logger.debug(`Pusher connecting (app key: ${pusherAppKey}...`);

        Pusher.log = (message: any) => {
            if (integration.getSettings().logging.logWebsocketEvents) {
                logger.debug(`Pusher log: ${message}`);
            }
        };

        this.pusher = new Pusher(pusherAppKey, { cluster: 'us2' });

        this.pusher.connection.bind('error', (err: any) => {
            logger.error(`Pusher error: ${JSON.stringify(err)}`);
            this.disconnect();
        });

        if (chatroomId) {
            logger.debug(`Pusher subscribing to chatroom.${chatroomId}.v2`);
            const chatroomv2 = this.pusher.subscribe(`chatrooms.${chatroomId}.v2`);
            chatroomv2.bind_global(this.dispatchChatroomEvent.bind(this));

            logger.debug(`Pusher subscribing to chatrooms.${chatroomId}`);
            const chatrooms = this.pusher.subscribe(`chatrooms.${chatroomId}`);
            chatrooms.bind_global(this.dispatchChatroomEvent.bind(this));

            logger.debug(`Pusher subscribing to chatroom_${chatroomId}`);
            const chatroom = this.pusher.subscribe(`chatroom_${chatroomId}`);
            chatroom.bind_global(this.dispatchChatroomEvent.bind(this));
        }

        if (channelId) {
            logger.debug(`Pusher subscribing to channel.${channelId}`);
            const channel = this.pusher.subscribe(`channel.${channelId}`);
            channel.bind_global(this.dispatchChannelEvent.bind(this));

            logger.debug(`Pusher subscribing to channel_${channelId}`);
            const channelOld = this.pusher.subscribe(`channel_${channelId}`);
            channelOld.bind_global(this.dispatchChannelEvent.bind(this));
        }
    }

    disconnect(): void {
        if (this.pusher) {
            logger.debug("Pusher disconnecting...");
            this.pusher.disconnect();
            this.pusher = null;
            logger.info("Pusher disconnected.");
        }
    }

    private async dispatchChannelEvent(event: string, data: any): Promise<void> {
        try {
            switch (event) {
                case 'pusher:subscription_succeeded':
                    logger.info("Pusher subscribed successfully to channel events.");
                    break;
                default:
                    logger.debug(`Unhandled channel event: ${event}, data: ${JSON.stringify(data)}`);
                    throw new Error(`Unhandled event type: ${event}`);
            }
        } catch (error) {
            logger.error(`Error handling Pusher channel event: ${event}, error: ${error}`);
        }
    }

    private async dispatchChatroomEvent(event: string, data: any): Promise<void> {
        try {
            switch (event) {
                case 'App\\Events\\ChatMessageEvent':
                    await handleChatMessageSentEvent(this.parseChatMessageEvent(data));
                    break;
                case 'RewardRedeemedEvent':
                    await handleRewardRedeemedEvent(this.parseRewardRedeemedEvent(data));
                    break;
                case 'pusher:subscription_succeeded':
                    logger.info("Pusher subscribed successfully to chatroom events.");
                    break;
                default:
                    logger.debug(`Unhandled chatroom event: ${event}, data: ${JSON.stringify(data)}`);
                    throw new Error(`Unhandled event type: ${event}`);
            }
        } catch (error) {
            logger.error(`Error handling Pusher chatroom event: ${event}, error: ${error}`);
        }
    }

    private parseChatMessageEvent(data: any): ChatMessage {
        const d = data as ChatMessageEvent;
        return {
            messageId: d.id,
            broadcaster: this.getBroadcaster(),
            sender: {
                userId: d.sender.id.toString(),
                username: d.sender.username,
                displayName: d.sender.username,
                profilePicture: '', // Not provided in event
                isVerified: false, // Worth checking?
                channelSlug: d.sender.slug,
                identity: {
                    usernameColor: d.sender.identity.color,
                    badges: d.sender.identity.badges.map(b => ({
                        text: b.text,
                        type: b.type,
                        count: b.count
                    }))
                }
            },
            content: d.content,
            createdAt: parseDate(d.created_at)
        };
    }

    private parseRewardRedeemedEvent(data: any): RewardRedeemedEvent {
        const d = data as RewardRedeemedEventData;
        return {
            rewardTitle: d.reward_title,
            userId: d.user_id,
            channelId: d.channel_id,
            username: d.username,
            userInput: d.user_input,
            rewardBackgroundColor: d.reward_background_color
        };
    }

    private getBroadcaster(): KickUser {
        return {
            userId: integration.kick.broadcaster?.userId.toString() || '',
            username: integration.kick.broadcaster?.name || '',
            displayName: integration.kick.broadcaster?.name || '',
            profilePicture: integration.kick.broadcaster?.profilePicture || '',
            isVerified: false, // Worth checking?
            channelSlug: integration.kick.broadcaster?.name || ''
        };
    }
}
