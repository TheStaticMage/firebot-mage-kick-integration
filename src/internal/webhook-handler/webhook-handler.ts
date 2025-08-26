import { ChannelFollowEvent, ChatMessageEvent, Channel as KickApiChannel, ModerationBannedEvent as KickApiModerationBannedEvent, LivestreamMetadataUpdatedEvent, LivestreamStatusUpdatedEvent, User, WebhookUser, WebhookUserWithIdentity } from "kick-api-types/v1";
import { handleChatMessageSentEvent } from "../../events/chat-message-sent";
import { handleFollowerEvent } from "../../events/follower";
import { handleLivestreamMetadataUpdatedEvent } from "../../events/livestream-metadata-updated";
import { handleLivestreamStatusUpdatedEvent } from "../../events/livestream-status-updated";
import { handleModerationBannedEvent } from "../../events/moderation-banned";
import { integration } from "../../integration";
import { logger } from "../../main";
import { BasicKickUser, Channel, ChatMessage, KickFollower, KickUser, KickUserWithIdentity, LivestreamMetadataUpdated, LivestreamStatusUpdated, ModerationBannedEvent, ModerationBannedMetadata } from "../../shared/types";
import { parseDate } from "../util";

export async function handleWebhook(webhook: InboundWebhook): Promise<void> {
    if (integration.getSettings().logging.logWebhooks) {
        logger.debug(`Received webhook: ${JSON.stringify(webhook)}`);
    }

    if (!webhook.kick_event_message_id || !webhook.kick_event_subscription_id || !webhook.kick_event_message_timestamp ||
        !webhook.kick_event_type || !webhook.kick_event_version || !webhook.raw_data) {
        throw new Error("Invalid webhook data");
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

export function parseKickUser(user: WebhookUser): KickUser {
    return {
        isAnonymous: user.is_anonymous || false,
        userId: (user.user_id ?? 0).toString(),
        username: user.username || "",
        displayName: user.username || "",
        isVerified: user.is_verified || false,
        profilePicture: user.profile_picture || "",
        channelSlug: user.channel_slug || ""
    };
}

export function parseKickUserWithIdentity(user: WebhookUserWithIdentity): KickUserWithIdentity {
    const base = parseKickUser(user);
    return {
        ...base,
        identity: {
            usernameColor: user.identity.username_color || "",
            badges: user.identity.badges ? user.identity.badges.map(badge => ({
                text: badge.text || "",
                type: badge.type || "",
                count: badge.count || 0
            })) : []
        }
    };
}

export function parseBasicKickUser(user: User): BasicKickUser {
    const result: BasicKickUser = {
        name: user.name || "",
        profilePicture: user.profile_picture || "",
        userId: user.user_id || 0,
        email: user.email || ""
    };
    return result;
}

export function parseChannel(rawData: any): Channel {
    if (!rawData.data || !Array.isArray(rawData.data) || rawData.data.length === 0) {
        throw new Error("Invalid channel data format");
    }

    const channelData: KickApiChannel = rawData.data[0];
    const result: Channel = {
        bannerPicture: channelData.banner_picture || "",
        broadcasterUserId: channelData.broadcaster_user_id || 0,
        category: {
            id: channelData.category.id || 0,
            name: channelData.category.name || "",
            thumbnail: channelData.category.thumbnail || ""
        },
        channelDescription: channelData.channel_description || "",
        slug: channelData.slug || "",
        stream: {
            isLive: channelData.stream.is_live || false,
            isMature: channelData.stream.is_mature || false,
            key: channelData.stream.key || "",
            language: channelData.stream.language || "",
            startTime: parseDate(channelData.stream.start_time),
            thumbnail: channelData.stream.thumbnail || "",
            url: channelData.stream.url || "",
            viewerCount: channelData.stream.viewer_count || 0
        },
        streamTitle: channelData.stream_title || ""
    };

    return result;
}

export function parseChatMessageEvent(rawData: string): ChatMessage {
    const data: ChatMessageEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        messageId: data.message_id,
        repliesTo: data.replies_to ? {
            messageId: data.replies_to.message_id,
            content: data.replies_to.content,
            sender: parseKickUser(data.replies_to.sender)
        } : undefined,
        broadcaster: parseKickUser(data.broadcaster),
        sender: parseKickUserWithIdentity(data.sender),
        content: data.content,
        // 'emotes' seems to be outdated in documentation and coming through as null
        createdAt: parseDate(data.created_at)
    };
}

function parseFollowEvent(rawData: string): KickFollower {
    const data: ChannelFollowEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        broadcaster: parseKickUser(data.broadcaster),
        follower: parseKickUser(data.follower)
    };
}

function parseLivestreamMetadataUpdatedEvent(rawData: string): LivestreamMetadataUpdated {
    const data: LivestreamMetadataUpdatedEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        broadcaster: parseKickUser(data.broadcaster),
        metadata: {
            title: data.metadata.title || "",
            language: data.metadata.language || "",
            hasMatureContent: data.metadata.has_mature_content || false,
            category: {
                // category and Category are due to https://github.com/KickEngineering/KickDevDocs/issues/238
                id: data.metadata.category?.id || data.metadata.Category?.id || 0,
                name: data.metadata.category?.name || data.metadata.Category?.name || "",
                thumbnail: data.metadata.category?.thumbnail || data.metadata.Category?.thumbnail || ""
            }
        }
    };
}

function parseLivestreamStatusUpdatedEvent(rawData: string): LivestreamStatusUpdated {
    const data: LivestreamStatusUpdatedEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        broadcaster: parseKickUser(data.broadcaster),
        isLive: data.is_live,
        title: data.title,
        startedAt: parseDate(data.started_at),
        endedAt: parseDate(data.ended_at ?? undefined)
    };
}

function parseModerationBannedEvent(rawData: string): ModerationBannedEvent {
    const data: KickApiModerationBannedEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

    const metadata: ModerationBannedMetadata = {
        reason: data.metadata.reason,
        createdAt: parseDate(data.metadata.created_at) || new Date(),
        expiresAt: parseDate(data.metadata.expires_at)
    };

    return {
        broadcaster: parseKickUser(data.broadcaster),
        moderator: parseKickUser(data.moderator),
        bannedUser: parseKickUser(data.banned_user),
        metadata: metadata
    };
}
