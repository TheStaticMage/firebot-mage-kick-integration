import { ChannelFollowEvent, ChatMessageEvent, Channel as KickApiChannel, ModerationBannedEvent as KickApiModerationBannedEvent, LivestreamMetadataUpdatedEvent, LivestreamStatusUpdatedEvent, NewSubscriptionEvent, SubscriptionGiftEvent, SubscriptionRenewalEvent, User, WebhookUser, WebhookUserWithIdentity } from "kick-api-types/v1";
import { BasicKickUser, Channel, ChannelGiftSubscription, ChannelSubscription, ChatMessage, KickFollower, KickUser, KickUserWithIdentity, LivestreamMetadataUpdated, LivestreamStatusUpdated, ModerationBannedEvent, ModerationBannedMetadata } from "../../shared/types";
import { parseDate } from "../util";

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

export function parseFollowEvent(rawData: string): KickFollower {
    const data: ChannelFollowEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        broadcaster: parseKickUser(data.broadcaster),
        follower: parseKickUser(data.follower)
    };
}

export function parseLivestreamMetadataUpdatedEvent(rawData: string): LivestreamMetadataUpdated {
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

export function parseLivestreamStatusUpdatedEvent(rawData: string): LivestreamStatusUpdated {
    const data: LivestreamStatusUpdatedEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        broadcaster: parseKickUser(data.broadcaster),
        isLive: data.is_live,
        title: data.title,
        startedAt: parseDate(data.started_at),
        endedAt: parseDate(data.ended_at ?? undefined)
    };
}

export function parseModerationBannedEvent(rawData: string): ModerationBannedEvent {
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

export function parseChannelSubscriptionNewEvent(rawData: string): ChannelSubscription {
    const data: NewSubscriptionEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

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
    const data: SubscriptionRenewalEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

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
    const data: SubscriptionGiftEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

    return {
        broadcaster: parseKickUser(data.broadcaster),
        gifter: parseKickUser(data.gifter),
        giftees: data.giftees.map(parseKickUser),
        createdAt: parseDate(data.created_at) || new Date(),
        expiresAt: parseDate(data.expires_at) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    };
}

export function parsePusherTestWebhook(rawData: string): InboundPayload {
    const data: InboundPayload = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));
    return {
        event: data.event,
        channel: data.channel,
        data: data.data
    };
}
