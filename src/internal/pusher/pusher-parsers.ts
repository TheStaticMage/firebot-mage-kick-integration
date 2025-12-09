import { ChatMessage, KickUser, ModerationBannedEvent, ModerationUnbannedEvent, RaidSentOffEvent, StreamHostedEvent } from "../../shared/types";
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

export function parseMessageDeletedEvent(data: any): MessageDeletedEvent {
    const raw = typeof data === "string" ? JSON.parse(data) : data;
    const messageId = raw?.message?.id;
    if (typeof messageId !== "string" || messageId === "") {
        throw new Error("Invalid MessageDeletedEvent payload: missing message.id");
    }

    return {
        id: typeof raw?.id === "string" ? raw.id : String(raw?.id ?? ""),
        message: { id: messageId },
        aiModerated: Boolean(raw?.aiModerated),
        violatedRules: Array.isArray(raw?.violatedRules) ? raw.violatedRules : []
    };
}
