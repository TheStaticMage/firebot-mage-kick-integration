import { integration } from "../../integration";
import { ChatMessage, KickUser, LivestreamStatusUpdated, ModerationBannedEvent, ModerationUnbannedEvent, RaidSentOffEvent, RewardRedeemedEvent, StreamHostedEvent } from "../../shared/types";
import { parseDate } from "../util";

export function parseChatMessageEvent(data: any, broadcaster: KickUser): ChatMessage {
    const d = data as ChatMessageEvent;
    return {
        messageId: d.id,
        broadcaster: broadcaster,
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
        createdAt: parseDate(d.created_at),
        repliesTo: d.metadata && d.metadata.original_message && d.metadata.original_sender ? {
            messageId: d.metadata.original_message.id,
            content: d.metadata.original_message.content,
            sender: {
                userId: d.metadata.original_sender.id.toString(),
                username: d.metadata.original_sender.username,
                displayName: d.metadata.original_sender.username,
                profilePicture: '', // Not provided in event
                isVerified: false, // Worth checking?
                channelSlug: '' // Not provided in event, maybe should calculate from username?
            }
        } : undefined
    };
}

export function parseRewardRedeemedEvent(data: any): RewardRedeemedEvent {
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

export function parseStreamHostedEvent(data: any): StreamHostedEvent {
    const d = data as InboundStreamHostedEvent;
    return {
        user: {
            userId: d.user.id.toString(),
            username: d.user.username,
            displayName: d.user.username,
            profilePicture: '', // Not provided in event
            isVerified: d.user.verified ? true : false,
            channelSlug: '' // Not provided in event
        },
        numberOfViewers: d.message.numberOfViewers,
        optionalMessage: d.message.optionalMessage,
        createdAt: parseDate(d.message.createdAt)
    };
}

export function parseChatMoveToSupportedChannelEvent(data: any): RaidSentOffEvent {
    const d = data as ChatMoveToSupportedChannelEventPayload;
    return {
        targetUser: {
            userId: d.hosted.id.toString(),
            username: d.hosted.username,
            displayName: d.hosted.username,
            profilePicture: d.hosted.profile_pic,
            isVerified: false, // Not provided in event
            channelSlug: d.hosted.slug
        },
        targetSlug: d.slug,
        numberOfViewers: d.hosted.viewers_count
    };
}

export function parseViewerUnbannedEvent(data: any): ModerationUnbannedEvent {
    const d = data as ViewerUnbannedEventData;
    return {
        user: {
            userId: String(d.user.id),
            username: d.user.username,
            displayName: d.user.username,
            profilePicture: '', // Not provided in event
            isVerified: false, // Not provided in event
            channelSlug: '' // Not provided in event
        },
        moderator: {
            userId: String(d.unbanned_by.id),
            username: d.unbanned_by.username,
            displayName: d.unbanned_by.username,
            profilePicture: '', // Not provided in event
            isVerified: false, // Not provided in event
            channelSlug: '' // Not provided in event
        },
        banType: d.permanent ? "permanent" : "timeout"
    };
}

export function parseViewerBannedOrTimedOutEvent(data: any): ModerationBannedEvent {
    const d = data as ViewerBannedEventData;
    return {
        bannedUser: {
            userId: String(d.user.id),
            username: d.user.username,
            displayName: d.user.username,
            profilePicture: '', // Not provided in event
            isVerified: false, // Not provided in event
            channelSlug: d.user.slug
        },
        moderator: {
            userId: String(d.banned_by.id),
            username: d.banned_by.username,
            displayName: d.banned_by.username,
            profilePicture: '', // Not provided in event
            isVerified: false, // Not provided in event
            channelSlug: d.banned_by.slug
        },
        metadata: {
            reason: 'No reason provided', // Not provided in event
            createdAt: new Date(),
            expiresAt: parseDate(d.expires_at) || undefined
        }
    };
}

export function parseStreamerIsLiveEvent(data: any): LivestreamStatusUpdated {
    const d = data as StreamerIsLiveEvent;
    const b = integration.kick.broadcaster;
    return {
        isLive: true,
        broadcaster: {
            userId: b?.userId ? String(b.userId) : "",
            username: b?.name || "",
            displayName: b?.name || '',
            profilePicture: b?.profilePicture || '',
            isVerified: false, // Not set in event
            channelSlug: '' // Not set in event
        },
        title: d.livestream.session_title,
        startedAt: parseDate(d.livestream.created_at) || undefined,
        endedAt: undefined
    };
}

export function parseStopStreamBroadcast(): LivestreamStatusUpdated {
    const b = integration.kick.broadcaster;
    return {
        isLive: false,
        broadcaster: {
            userId: b?.userId ? String(b.userId) : "",
            username: b?.name || "",
            displayName: b?.name || "",
            profilePicture: b?.profilePicture || "",
            isVerified: false, // Not set in event
            channelSlug: "" // Not set in event
        },
        title: '',
        startedAt: undefined, // Not set in event
        endedAt: new Date()
    };
}
