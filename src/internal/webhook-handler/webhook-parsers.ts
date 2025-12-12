import { IntegrationConstants } from "../../constants";
import {
    ChannelFollowEvent,
    ChatMessageEvent,
    EventBadge,
    EventUser,
    EventUserWithIdentity,
    Channel as KickApiChannel,
    KicksGiftedEvent as KickApiKicksGiftedEvent,
    KicksGiftedEventUser,
    ModerationBannedEvent as KickApiModerationBannedEvent,
    LivestreamMetadataUpdatedEvent,
    LivestreamStatusUpdatedEvent,
    NewSubscriptionEvent,
    SubscriptionGiftEvent,
    SubscriptionRenewalEvent,
    User,
    ChannelRewardRedemptionEvent
} from "kick-api-types/v1";

import {
    BasicKickUser,
    Channel,
    ChannelGiftSubscription,
    ChannelSubscription,
    ChatMessage,
    KickFollower,
    KickUser,
    KickUserWithIdentity,
    KicksGiftedEvent,
    LivestreamMetadataUpdated,
    LivestreamStatusUpdated,
    ModerationBannedEvent,
    ModerationBannedMetadata
} from "../../shared/types";

import { parseDate } from "../util";

// Helper function to parse raw data that may be either base64-encoded or plain JSON
function parseRawData(rawData: string): any {
    try {
        // First, try to parse as plain JSON (for test events or direct JSON)
        return JSON.parse(rawData);
    } catch {
        // If that fails, assume it's base64-encoded and decode it
        try {
            return JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
        } catch (error) {
            throw new Error(`Failed to parse raw data as JSON or base64-encoded JSON: ${error}`);
        }
    }
}

export function parseKickUser(user: EventUser): KickUser {
    return {
        isAnonymous: user.is_anonymous || false,
        userId: (user.user_id ?? 0).toString(),
        username: user.username || "",
        displayName: user.username || "",
        isVerified: user.is_verified || false,
        profilePicture: user.profile_picture || IntegrationConstants.DEFAULT_PROFILE_IMAGE,
        channelSlug: user.channel_slug || ""
    };
}

// Parser for kicks.gifted events where Kick's API doesn't provide is_anonymous
export function parseKicksGiftedUser(user: KicksGiftedEventUser): KickUser {
    return {
        isAnonymous: false, // Default to false since kicks.gifted API doesn't provide this field
        userId: (user.user_id ?? 0).toString(),
        username: user.username || "",
        displayName: user.username || "",
        isVerified: user.is_verified || false,
        profilePicture: user.profile_picture || IntegrationConstants.DEFAULT_PROFILE_IMAGE,
        channelSlug: user.channel_slug || ""
    };
}

export function parseKickUserWithIdentity(user: EventUserWithIdentity): KickUserWithIdentity {
    const base = parseKickUser(user);
    return {
        ...base,
        identity: {
            usernameColor: user.identity.username_color || "",
            badges: user.identity.badges ? user.identity.badges.map((badge: EventBadge) => ({
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
        profilePicture: user.profile_picture || IntegrationConstants.DEFAULT_PROFILE_IMAGE,
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
    const data: ChatMessageEvent = parseRawData(rawData);
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

export function parseFollowEvent(rawData: string): KickFollower {
    const data: ChannelFollowEvent = parseRawData(rawData);
    return {
        broadcaster: parseKickUser(data.broadcaster),
        follower: parseKickUser(data.follower)
    };
}

export function parseLivestreamMetadataUpdatedEvent(rawData: string): LivestreamMetadataUpdated {
    const data: LivestreamMetadataUpdatedEvent = parseRawData(rawData);
    return {
        broadcaster: parseKickUser(data.broadcaster),
        metadata: {
            title: data.metadata.title || "",
            language: data.metadata.language || "",
            hasMatureContent: data.metadata.has_mature_content || false,
            category: {
                id: data.metadata.category?.id || 0,
                name: data.metadata.category?.name || "",
                thumbnail: data.metadata.category?.thumbnail || ""
            }
        }
    };
}

export function parseLivestreamStatusUpdatedEvent(rawData: string): LivestreamStatusUpdated {
    const data: LivestreamStatusUpdatedEvent = parseRawData(rawData);
    return {
        broadcaster: parseKickUser(data.broadcaster),
        isLive: data.is_live,
        title: data.title,
        startedAt: parseDate(data.started_at),
        endedAt: parseDate(data.ended_at ?? undefined)
    };
}

export function parseModerationBannedEvent(rawData: string): ModerationBannedEvent {
    const data: KickApiModerationBannedEvent = parseRawData(rawData);

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

export function parseChannelSubscriptionNewEvent(rawData: string): ChannelSubscription {
    const data: NewSubscriptionEvent = parseRawData(rawData);

    return {
        broadcaster: parseKickUser(data.broadcaster),
        subscriber: parseKickUser(data.subscriber),
        duration: data.duration || 1,
        isResub: false,
        createdAt: parseDate(data.created_at) || new Date(),
        expiresAt: parseDate(data.expires_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
}

export function parseChannelSubscriptionRenewalEvent(rawData: string): ChannelSubscription {
    const data: SubscriptionRenewalEvent = parseRawData(rawData);

    return {
        broadcaster: parseKickUser(data.broadcaster),
        subscriber: parseKickUser(data.subscriber),
        duration: data.duration,
        isResub: true,
        createdAt: parseDate(data.created_at) || new Date(),
        expiresAt: parseDate(data.expires_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
}

export function parseChannelSubscriptionGiftsEvent(rawData: string): ChannelGiftSubscription {
    const data: SubscriptionGiftEvent = parseRawData(rawData);

    return {
        broadcaster: parseKickUser(data.broadcaster),
        gifter: parseKickUser(data.gifter),
        giftees: data.giftees.map(parseKickUser),
        createdAt: parseDate(data.created_at) || new Date(),
        expiresAt: parseDate(data.expires_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
}

export function parsePusherTestWebhook(rawData: string): InboundPayload {
    const data = parseRawData(rawData);

    // Test webhooks contain the message data in the 'payload' field
    // Extract the message and construct a Pusher-like event
    if (data.payload && typeof data.payload === 'object') {
        // This is a test chat message
        return {
            event: 'message.add',
            channel: `chatrooms.${data.payload.broadcaster?.channel_slug || 'unknown'}`,
            data: data.payload
        };
    }

    // Fallback for other test event types
    return {
        event: data.event || 'unknown',
        channel: data.channel || 'unknown',
        data: data.data || data.payload || {}
    };
}

export function parseKicksGiftedEvent(rawData: string): KicksGiftedEvent {
    const data: KickApiKicksGiftedEvent = parseRawData(rawData);

    return {
        gifter: parseKicksGiftedUser(data.sender),
        kicks: data.gift.amount,
        giftId: "", // Not provided in webhook payload, keeping empty for compatibility
        giftName: data.gift.name,
        giftType: data.gift.type,
        giftTier: data.gift.tier,
        characterLimit: 0, // Not provided in webhook payload, keeping 0 for compatibility
        pinnedTime: 0, // Not provided in webhook payload, keeping 0 for compatibility
        message: data.gift.message
    };
}

export function parseRewardRedemptionWebhook(rawData: string): ChannelRewardRedemptionEvent {
    return parseRawData(rawData);
}
