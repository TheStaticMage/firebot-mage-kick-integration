import { IntegrationConstants } from "../../constants";
import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { integration } from "../../integration";
import { logger } from "../../main";
import { ChatMessage, KickUser } from "../../shared/types";
import { parseDate } from "../util";

const Pusher = require('pusher-js');

export class KickPusher {
    // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
    private pusher: typeof Pusher | null = null;

    connect(pusherAppKey: string, chatroomId: string): void {
        if (!pusherAppKey || !chatroomId) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Pusher cannot connect: App Key or Chatroom ID is missing.`);
            this.pusher = null;
            return;
        }

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Pusher connecting (app key: ${pusherAppKey}, chatroom ID: ${chatroomId})...`);

        Pusher.log = (message: any) => {
            if (integration.getSettings().advanced.logWebsocketEvents) {
                logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Pusher log: ${message}`);
            }
        };

        this.pusher = new Pusher(pusherAppKey, { cluster: 'us2' });

        this.pusher.connection.bind('error', (err: any) => {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Pusher error: ${JSON.stringify(err)}`);
            this.disconnect();
        });

        const channel = this.pusher.subscribe(`chatrooms.${chatroomId}.v2`);
        channel.bind_global(async (event: string, data: any) => {
            try {
                await this.dispatchEvent(event, data);
            } catch (error) {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Pusher event dispatch error: event=${event}, error=${error}`);
            }
        });
    }

    disconnect(): void {
        if (this.pusher) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Pusher disconnecting...`);
            this.pusher.disconnect();
            this.pusher = null;
            logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Pusher disconnected.`);
        }
    }

    private async dispatchEvent(event: string, data: any): Promise<void> {
        switch (event) {
            case 'App\\Events\\ChatMessageEvent':
                await handleChatMessageSentEvent(this.parseChatMessageEvent(data));
                break;
            case 'pusher:subscription_succeeded':
                logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Pusher subscribed successfully.`);
                break;
            default:
                throw new Error(`Unhandled event type: ${event}`);
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
