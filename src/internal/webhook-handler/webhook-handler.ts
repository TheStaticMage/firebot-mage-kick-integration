import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { handleFollowerEvent } from "../../events/follower";
import { handleLivestreamMetadataUpdatedEvent } from "../../events/livestream-metadata-updated";
import { handleLivestreamStatusUpdatedEvent } from "../../events/livestream-status-updated";
import { handleModerationBannedEvent } from "../../events/moderation-banned";
import { handleChannelSubscriptionEvent, handleChannelSubscriptionGiftsEvent } from "../../events/sub-events";
import { integration } from "../../integration";
import { logger } from "../../main";
import { parseChannelSubscriptionGiftsEvent, parseChannelSubscriptionNewEvent, parseChannelSubscriptionRenewalEvent, parseChatMessageEvent, parseFollowEvent, parseLivestreamMetadataUpdatedEvent, parseLivestreamStatusUpdatedEvent, parseModerationBannedEvent } from "./webhook-parsers";

export async function handleWebhook(webhook: InboundWebhook): Promise<void> {
    if (integration.getSettings().logging.logWebhooks) {
        logger.debug(`Received webhook: ${JSON.stringify(webhook)}`);
    }

    if (!webhook.kick_event_message_id || !webhook.kick_event_subscription_id || !webhook.kick_event_message_timestamp ||
        !webhook.kick_event_type || !webhook.kick_event_version || !webhook.raw_data) {
        throw new Error("Invalid webhook data");
    }

    // This is NOT intended to be for security, since you are implicitly
    // trusting the proxy owner and they could just send you fake data. Rather,
    // it's meant to protect you against innocent mistakes (e.g. developer
    // accidentally sending test webhooks with the wrong key).
    if (webhook.is_test_event && !integration.getSettings().advanced.allowTestWebhooks) {
        logger.warn(`Received test webhook but test webhooks are disabled: ${JSON.stringify(webhook)}`);
        return;
    }

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
            handleChannelSubscriptionGiftsEvent(event);
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
            handleLivestreamStatusUpdatedEvent(event);
            break;
        }
        case "moderation.banned": {
            const event = parseModerationBannedEvent(webhook.raw_data);
            handleModerationBannedEvent(event);
            break;
        }
        default: {
            throw new Error(`Unsupported event type: ${webhook.kick_event_type}`);
        }
    }
}
