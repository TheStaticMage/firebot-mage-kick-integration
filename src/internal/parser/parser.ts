import { BasicKickUser, Channel, ChatMessage, KickFollower, KickUser, LivestreamStatusUpdated, Webhook } from "../../shared/types";

export interface InboundWebhook {
    kick_event_message_id: string;
    kick_event_subscription_id: string;
    kick_event_message_timestamp: string;
    kick_event_type: string;
    kick_event_version: string;
    raw_data: string; // Assuming rawData is a base64 encoded JSON string
}

export function parseWebhook(webhook: InboundWebhook): Webhook {
    if (!webhook.kick_event_message_id || !webhook.kick_event_subscription_id || !webhook.kick_event_message_timestamp ||
        !webhook.kick_event_type || !webhook.kick_event_version || !webhook.raw_data) {
        throw new Error("Invalid webhook data");
    }

    const result: Webhook = {
        eventMessageID: webhook.kick_event_message_id,
        eventSubscriptionID: webhook.kick_event_subscription_id,
        eventMessageTimestamp: webhook.kick_event_message_timestamp,
        eventType: webhook.kick_event_type,
        eventVersion: webhook.kick_event_version
    };

    switch (webhook.kick_event_type) {
        case "chat.message.sent": {
            result.payload = parseChatMessageEvent(webhook.raw_data);
            break;
        }
        case "channel.followed": {
            result.payload = parseFollowEvent(webhook.raw_data);
            break;
        }
        case "livestream.status.updated": {
            result.payload = parseLivestreamStatusUpdatedEvent(webhook.raw_data);
            break;
        }
        default: {
            throw new Error(`Unsupported event type: ${webhook.kick_event_type}`);
        }
    }

    return result;
}

function parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) {
        return undefined;
    }

    if (dateString === "0001-01-01T00:00:00Z") {
        return undefined;
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
}

export function parseKickUser(user: InboundKickUser): KickUser {
    const result: KickUser = {
        isAnonymous: user.is_anonymous || false,
        userId: user.user_id.toString(),
        username: user.username || "",
        displayName: user.username || "",
        isVerified: user.is_verified || false,
        profilePicture: user.profile_picture || "",
        channelSlug: user.channel_slug || ""
    };

    if (user.identity) {
        result.identity = {
            usernameColor: user.identity.username_color || "",
            badges: user.identity.badges ? user.identity.badges.map(badge => ({
                text: badge.text || "",
                type: badge.type || ""
            })) : []
        };
    }

    return result;
}

export function parseBasicKickUser(user: InboundBasicKickUser): BasicKickUser {
    const result: BasicKickUser = {
        name: user.name || "",
        profilePicture: user.profile_picture || "",
        userId: user.user_id || 0
    };

    if (user.email) {
        result.email = user.email;
    }

    return result;
}

export function parseChannel(rawData: any): Channel {
    if (!rawData.data || !Array.isArray(rawData.data) || rawData.data.length === 0) {
        throw new Error("Invalid channel data format");
    }

    const channelData: InboundChannel = rawData.data[0];
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

function parseChatMessageEvent(rawData: string): ChatMessage {
    const data: InboundChatMessage = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

    const badges: InboundBadge[] = [];
    if (data.sender.identity && data.sender.identity.badges) {
        for (const badge of data.sender.identity.badges) {
            const parsedBadge: InboundBadge = {
                text: badge.text,
                type: badge.type
            };
            badges.push(parsedBadge);
        }
    }

    const result: ChatMessage = {
        messageId: data.message_id,
        broadcaster: parseKickUser(data.broadcaster),
        sender: parseKickUser(data.sender),
        content: data.content,
        // 'emotes' seems to be outdated in documentation and coming through as null
        createdAt: parseDate(data.created_at)
    };

    return result;
}

function parseFollowEvent(rawData: string): KickFollower {
    const data: InboundFollowEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

    const result: KickFollower = {
        broadcaster: parseKickUser(data.broadcaster),
        follower: parseKickUser(data.follower)
    };

    return result;
}

function parseLivestreamStatusUpdatedEvent(rawData: string): LivestreamStatusUpdated {
    const data: InboundLivestreamStatusUpdatedEvent = JSON.parse(Buffer.from(rawData, 'base64').toString('utf-8'));

    const result: LivestreamStatusUpdated = {
        broadcaster: parseKickUser(data.broadcaster),
        isLive: data.is_live,
        title: data.title,
        startedAt: parseDate(data.started_at),
        endedAt: parseDate(data.ended_at)
    };

    return result;
}
