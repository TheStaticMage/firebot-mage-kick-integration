import { ChatMessage, KickUser, RewardRedeemedEvent, StreamHostedEvent } from "../../shared/types";
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
