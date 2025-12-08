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
import { rewardRedemptionHandler } from "./reward-redemption-handler";
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
    parsePusherTestWebhook,
    parseRewardRedemptionWebhook
} from "./webhook-parsers";
import { InboundWebhook } from './webhook';
import NodeCache from 'node-cache';

export class WebhookHandler {
    private eventIdCache = new NodeCache({ stdTTL: 86400, checkperiod: 3600 });
    private payloadCache = new NodeCache({ stdTTL: 5, checkperiod: 60 });

    public async handleWebhook(webhook: InboundWebhook): Promise<void> {
        if (integration.getSettings().logging.logWebhooks) {
            logger.debug(`Received webhook: ${JSON.stringify(webhook)}`);
        }

        if (!webhook.kickEventMessageId || !webhook.kickEventSubscriptionId || !webhook.kickEventMessageTimestamp ||
        !webhook.kickEventType || !webhook.kickEventVersion || !webhook.rawData) {
            throw new Error("Invalid webhook data");
        }

        // Duplicate webhook detection based on Kick's message ID. These should
        // always be safely discarded.
        if (this.eventIdCache.has(webhook.kickEventMessageId)) {
            logger.warn(`Duplicate webhook detected (id: ${webhook.kickEventMessageId}, type: ${webhook.kickEventType}, version: ${webhook.kickEventVersion}), ignoring.`);
            return;
        }
        this.eventIdCache.set(webhook.kickEventMessageId, true);

        // When Kick subscriptions get messed up, it can send the same payload
        // multiple times under different subscription IDs and message IDs. So here
        // we hash the payload (rawData) and then check it against a cache so that
        // we can reject duplicate payloads.
        if (!webhook.isTestEvent) {
            const crypto = await import('crypto');
            const payloadHash = crypto.createHash('sha256').update(webhook.rawData).digest('hex');

            if (this.payloadCache.has(payloadHash)) {
                logger.warn(`Duplicate webhook payload detected (id: ${webhook.kickEventMessageId}, type: ${webhook.kickEventType}, version: ${webhook.kickEventVersion}, hash: ${payloadHash}), ignoring.`);
                return;
            }
            this.payloadCache.set(payloadHash, true);
        }

        // For performance checks and other debugging on webhooks
        const webhookReceivedEvent = {
            kickEventType: webhook.kickEventType,
            kickEventVersion: webhook.kickEventVersion,
            isTestEvent: webhook.isTestEvent ?? false,
            timestamp: parseDate(webhook.kickEventMessageTimestamp) || null
        };
        handleWebhookReceivedEvent(webhookReceivedEvent);

        // This is NOT intended to be for security, since you are implicitly
        // trusting the proxy owner and they could just send you fake data. Rather,
        // it's meant to protect you against innocent mistakes (e.g. developer
        // accidentally sending test webhooks with the wrong key).
        if (webhook.isTestEvent && !integration.getSettings().advanced.allowTestWebhooks) {
            logger.warn(`Received test webhook but test webhooks are disabled: ${JSON.stringify(webhook)}`);
            return;
        }

        // This is not a real event from Kick, but is rather used for testing.
        if (webhook.isTestEvent && webhook.kickEventType === "pusher.test") {
            const payload = parsePusherTestWebhook(webhook.rawData);
            await integration.pusher.dispatchTestEvent(payload);
            return;
        }

        // Handle real webhooks
        switch (webhook.kickEventType) {
            case "chat.message.sent": {
                const event = parseChatMessageEvent(webhook.rawData);
                handleChatMessageSentEvent(event);
                break;
            }
            case "channel.followed": {
                const event = parseFollowEvent(webhook.rawData);
                handleFollowerEvent(event);
                break;
            }
            case "channel.subscription.renewal": {
                const event = parseChannelSubscriptionRenewalEvent(webhook.rawData);
                handleChannelSubscriptionEvent(event);
                break;
            }
            case "channel.subscription.gifts": {
                const event = parseChannelSubscriptionGiftsEvent(webhook.rawData);
                await handleChannelSubscriptionGiftsEvent(event);
                break;
            }
            case "channel.subscription.new": {
                const event = parseChannelSubscriptionNewEvent(webhook.rawData);
                handleChannelSubscriptionEvent(event);
                break;
            }
            case "livestream.metadata.updated": {
                const event = parseLivestreamMetadataUpdatedEvent(webhook.rawData);
                handleLivestreamMetadataUpdatedEvent(event);
                break;
            }
            case "livestream.status.updated": {
                const event = parseLivestreamStatusUpdatedEvent(webhook.rawData);
                livestreamStatusUpdatedHandler.handleLivestreamStatusUpdatedEvent(event);
                break;
            }
            case "moderation.banned": {
                const event = parseModerationBannedEvent(webhook.rawData);
                moderationBannedEventHandler.handleModerationBannedEvent(event);
                break;
            }
            case "kicks.gifted": {
                const event = parseKicksGiftedEvent(webhook.rawData);
                await kicksHandler.handleKicksGiftedEvent(event);
                break;
            }
            case "channel.reward.redemption.updated": {
                const event = parseRewardRedemptionWebhook(webhook.rawData);
                await rewardRedemptionHandler.handleRewardRedemptionEvent(event);
                break;
            }
            default: {
                throw new Error(`Unsupported event type: ${webhook.kickEventType}`);
            }
        }
    }
}

export const webhookHandler = new WebhookHandler();
