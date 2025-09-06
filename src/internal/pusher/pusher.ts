import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { livestreamStatusUpdatedHandler } from "../../events/livestream-status-updated";
import { moderationBannedEventHandler } from "../../events/moderation-banned";
import { handleModerationUnbannedEvent } from "../../events/moderation-unbanned";
import { handleRaidSentOffEvent } from "../../events/raid-sent-off-event";
import { handleRewardRedeemedEvent } from "../../events/reward-redeemed-event";
import { handleStreamHostedEvent } from "../../events/stream-hosted-event";
import { handleChannelSubscriptionGiftsEvent } from "../../events/sub-events";
import { integration } from "../../integration";
import { logger } from "../../main";
import { KickUser } from "../../shared/types";
import { parseChatMessageEvent, parseChatMoveToSupportedChannelEvent, parseGiftSubEvent, parseRewardRedeemedEvent, parseStopStreamBroadcast, parseStreamerIsLiveEvent, parseStreamHostedEvent, parseViewerBannedOrTimedOutEvent, parseViewerUnbannedEvent } from "./pusher-parsers";

const Pusher = require('pusher-js');

export class KickPusher {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private pusher: typeof Pusher | null = null;
    private giftSubEventDelay = 10000; // Default 10 seconds

    /**
     * Creates a delay promise that can be easily mocked in tests
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

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
                case "App\\Events\\ChatMoveToSupportedChannelEvent":
                    await handleRaidSentOffEvent(parseChatMoveToSupportedChannelEvent(data));
                    break;
                case "App\\Events\\LuckyUsersWhoGotGiftSubscriptionsEvent": // Yup, it's actually named that
                    // Webhook has more information; give it a chance to arrive first
                    await this.delay(this.giftSubEventDelay).then(async () => {
                        try {
                            await handleChannelSubscriptionGiftsEvent(await parseGiftSubEvent(data));
                        } catch (error) {
                            logger.error(`Error handling delayed gift subscription event: ${error}`);
                        }
                    });
                    break;
                case "App\\Events\\StopStreamBroadcast":
                    await livestreamStatusUpdatedHandler.handleLivestreamStatusUpdatedEvent(parseStopStreamBroadcast());
                    break;
                case "App\\Events\\StreamerIsLiveEvent":
                    await livestreamStatusUpdatedHandler.handleLivestreamStatusUpdatedEvent(parseStreamerIsLiveEvent(data));
                    break;
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
                case 'App\\Events\\ChatMessageEvent': {
                    const broadcaster = this.getBroadcaster();
                    if (broadcaster) {
                        await handleChatMessageSentEvent(parseChatMessageEvent(data, broadcaster));
                    } else {
                        logger.warn("Skipping chat message event: broadcaster information not available");
                    }
                    break;
                }
                case 'App\\Events\\StreamHostedEvent':
                    await handleStreamHostedEvent(parseStreamHostedEvent(data));
                    break;
                case 'App\\Events\\UserBannedEvent':
                    await moderationBannedEventHandler.handleModerationBannedEvent(parseViewerBannedOrTimedOutEvent(data));
                    break;
                case 'App\\Events\\UserUnbannedEvent':
                    await handleModerationUnbannedEvent(parseViewerUnbannedEvent(data));
                    break;
                case 'RewardRedeemedEvent':
                    await handleRewardRedeemedEvent(parseRewardRedeemedEvent(data));
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

    async dispatchTestEvent(payload: InboundPayload): Promise<void> {
        try {
            const channelPrefix = payload.channel.split('.')[0];
            switch (channelPrefix) {
                case 'channel':
                    logger.debug(`Dispatching Pusher test event for channel: ${payload.channel}, event: ${payload.event}, data: ${JSON.stringify(payload.data)}`);
                    await this.dispatchChannelEvent(payload.event, payload.data);
                    return;
                case 'chatrooms':
                    logger.debug(`Dispatching Pusher test event for chatroom: ${payload.channel}, event: ${payload.event}, data: ${JSON.stringify(payload.data)}`);
                    await this.dispatchChatroomEvent(payload.event, payload.data);
                    return;
                default:
                    logger.error(`Unhandled Pusher test event: ${payload.event}, channel: ${payload.channel}, data: ${JSON.stringify(payload.data)}`);
            }
        } catch (error) {
            logger.error(`Error handling Pusher test event: ${payload.event}, error: ${error}`);
        }
    }

    private getBroadcaster(): KickUser | null {
        const broadcaster = integration.kick.broadcaster;
        if (!broadcaster) {
            return null;
        }

        return {
            userId: broadcaster.userId.toString(),
            username: broadcaster.name,
            displayName: broadcaster.name,
            profilePicture: broadcaster.profilePicture || '',
            isVerified: false, // Worth checking?
            channelSlug: broadcaster.name
        };
    }
}
