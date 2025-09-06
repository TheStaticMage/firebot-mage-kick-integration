import { integration } from "../../integration";
import { logger } from "../../main";
import { ChannelGiftSubscription, ChatMessage, KickUser, LivestreamStatusUpdated, ModerationBannedEvent, ModerationUnbannedEvent, RaidSentOffEvent, RewardRedeemedEvent, StreamHostedEvent } from "../../shared/types";
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

export async function parseGiftSubEvent(data: any): Promise<ChannelGiftSubscription> {
    const d = data as PusherGiftSubEvent;
    // This event only sends the usernames, not the user IDs, of the recipient.
    // If we have not previously seen the user, we won't be able to look them up
    // here.
    const b = integration.kick.broadcaster;

    const gifter = await integration.kick.userManager.getViewerByUsername(d.gifter_username);
    let gifterUser: KickUser | undefined = undefined;
    if (gifter) {
        gifterUser = {
            userId: gifter._id,
            username: gifter.username,
            displayName: gifter.displayName || gifter.username,
            profilePicture: gifter.profilePicUrl || '',
            isVerified: false, // Not set in event
            channelSlug: '' // Not set in event
        };
    } else {
        logger.error(`Pusher gift sub event: could not find gifter username ${d.gifter_username} in viewer database.`);
        gifterUser = {
            userId: '',
            username: 'anonymous',
            displayName: 'Anonymous',
            profilePicture: '',
            isVerified: false,
            channelSlug: ''
        };
    }

    const giftees: KickUser[] = [];
    for (const username of d.usernames) {
        const giftee = await integration.kick.userManager.getViewerByUsername(username);
        if (giftee) {
            giftees.push({
                userId: giftee._id,
                username: giftee.username,
                displayName: giftee.displayName || giftee.username,
                profilePicture: giftee.profilePicUrl || '',
                isVerified: false, // Not set in event
                channelSlug: '' // Not set in event
            });
        } else {
            logger.error(`Pusher gift sub event: could not find giftee username ${username} in viewer database.`);
            giftees.push({
                userId: '',
                username: username,
                displayName: username,
                profilePicture: '',
                isVerified: false,
                channelSlug: ''
            });
        }
    }

    return {
        broadcaster: {
            userId: String(b?.userId) || '',
            username: b?.name || '',
            displayName: b?.name || '',
            profilePicture: b?.profilePicture || '',
            isVerified: false, // Not set in event
            channelSlug: '' // Not set in event
        },
        gifter: gifterUser,
        giftees: giftees,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // Assume 30 days from now
    };
}
