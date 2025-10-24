import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { handleFollowerEvent } from "../../events/follower";
import { kicksHandler } from "../../events/kicks";
import { handleLivestreamMetadataUpdatedEvent } from "../../events/livestream-metadata-updated";
import { livestreamStatusUpdatedHandler } from "../../events/livestream-status-updated";
import { moderationBannedEventHandler } from "../../events/moderation-banned";
import { handleChannelSubscriptionEvent, handleChannelSubscriptionGiftsEvent } from "../../events/sub-events";
import { handleWebhookReceivedEvent } from "../../events/webhook-received";
import { integration } from "../../integration";
import { logger } from "../../main";
import { parseDate } from "../util";
import {
    parseChannelSubscriptionGiftsEvent,
    parseChannelSubscriptionNewEvent,
    parseChannelSubscriptionRenewalEvent,
    parseChatMessageEvent,
    parseFollowEvent,
    parseKicksGiftedEvent,
    parseLivestreamMetadataUpdatedEvent,
    parseLivestreamStatusUpdatedEvent,
    parseModerationBannedEvent,
    parsePusherTestWebhook
} from "./webhook-parsers";
import NodeCache from 'node-cache';

export class WebhookHandler {
    private eventIdCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
    private payloadCache = new NodeCache({ stdTTL: 5, checkperiod: 60 });

    public async handleWebhook(webhook: InboundWebhook): Promise<void> {
        if (integration.getSettings().logging.logWebhooks) {
            logger.debug(`Received webhook: ${JSON.stringify(webhook)}`);
        }

        if (!webhook.kick_event_message_id || !webhook.kick_event_subscription_id || !webhook.kick_event_message_timestamp ||
        !webhook.kick_event_type || !webhook.kick_event_version || !webhook.raw_data) {
            throw new Error("Invalid webhook data");
        }

        // Duplicate webhook detection based on Kick's message ID. These should
        // always be safely discarded.
        if (this.eventIdCache.has(webhook.kick_event_message_id)) {
            logger.warn(`Duplicate webhook detected (id: ${webhook.kick_event_message_id}, type: ${webhook.kick_event_type}, version: ${webhook.kick_event_version}), ignoring.`);
            return;
        }
        this.eventIdCache.set(webhook.kick_event_message_id, true);

        // When Kick subscriptions get messed up, it can send the same payload
        // multiple times under different subscription IDs and message IDs. So here
        // we hash the payload (raw_data) and then check it against a cache so that
        // we can reject duplicate payloads.
        if (!webhook.is_test_event) {
            const crypto = await import('crypto');
            const payloadHash = crypto.createHash('sha256').update(webhook.raw_data).digest('hex');

            if (this.payloadCache.has(payloadHash)) {
                logger.warn(`Duplicate webhook payload detected (id: ${webhook.kick_event_message_id}, type: ${webhook.kick_event_type}, version: ${webhook.kick_event_version}, hash: ${payloadHash}), ignoring.`);
                return;
            }
            this.payloadCache.set(payloadHash, true);
        }

        // For performance checks and other debugging on webhooks
        const webhookReceivedEvent = {
            kickEventType: webhook.kick_event_type,
            kickEventVersion: webhook.kick_event_version,
            isTestEvent: webhook.is_test_event || false,
            timestamp: parseDate(webhook.kick_event_message_timestamp) || null
        };
        handleWebhookReceivedEvent(webhookReceivedEvent);

        // This is NOT intended to be for security, since you are implicitly
        // trusting the proxy owner and they could just send you fake data. Rather,
        // it's meant to protect you against innocent mistakes (e.g. developer
        // accidentally sending test webhooks with the wrong key).
        if (webhook.is_test_event && !integration.getSettings().advanced.allowTestWebhooks) {
            logger.warn(`Received test webhook but test webhooks are disabled: ${JSON.stringify(webhook)}`);
            return;
        }

        // This is not a real event from Kick, but is rather used for testing.
        if (webhook.is_test_event && webhook.kick_event_type === "pusher.test") {
            const payload = parsePusherTestWebhook(webhook.raw_data);
            await integration.pusher.dispatchTestEvent(payload);
            return;
        }

        // Handle real webhooks
        switch (webhook.kick_event_type) {
            case "chat.message.sent": {
                const event = parseChatMessageEvent(webhook.raw_data);
                handleChatMessageSentEvent(event);
                break;
            }
            case "channel.followed": {
                const event = parseFollowEvent(webhook.raw_data);
                handleFollowerEvent(event);
                break;
            }
            case "channel.subscription.renewal": {
                const event = parseChannelSubscriptionRenewalEvent(webhook.raw_data);
                handleChannelSubscriptionEvent(event);
                break;
            }
            case "channel.subscription.gifts": {
                const event = parseChannelSubscriptionGiftsEvent(webhook.raw_data);
                await handleChannelSubscriptionGiftsEvent(event);
                break;
            }
            case "channel.subscription.new": {
                const event = parseChannelSubscriptionNewEvent(webhook.raw_data);
                handleChannelSubscriptionEvent(event);
                break;
            }
            case "livestream.metadata.updated": {
                const event = parseLivestreamMetadataUpdatedEvent(webhook.raw_data);
                handleLivestreamMetadataUpdatedEvent(event);
                break;
            }
            case "livestream.status.updated": {
                const event = parseLivestreamStatusUpdatedEvent(webhook.raw_data);
                livestreamStatusUpdatedHandler.handleLivestreamStatusUpdatedEvent(event);
                break;
            }
            case "moderation.banned": {
                const event = parseModerationBannedEvent(webhook.raw_data);
                moderationBannedEventHandler.handleModerationBannedEvent(event);
                break;
            }
            case "kicks.gifted": {
                const event = parseKicksGiftedEvent(webhook.raw_data);
                await kicksHandler.handleKicksGiftedEvent(event);
                break;
            }
            default: {
                throw new Error(`Unsupported event type: ${webhook.kick_event_type}`);
            }
        }
    }
}

export const webhookHandler = new WebhookHandler();
