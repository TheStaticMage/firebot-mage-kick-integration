export interface KickBadge {
    text: string;
    type: string;
    count?: number;
}

export interface KickRepliesTo {
    messageId: string;
    content: string;
    sender: KickUser;
}

export interface ChatMessage {
    messageId: string;
    repliesTo?: KickRepliesTo | undefined;
    broadcaster: KickUser;
    sender: KickUserWithIdentity;
    content: string;
    createdAt: Date | undefined;
}

export interface KickFollower {
    broadcaster: KickUser;
    follower: KickUser;
}

export interface KickIdentity {
    usernameColor: string;
    badges: KickBadge[];
}

export interface KickUser {
    isAnonymous?: boolean;
    userId: string;
    username: string;
    displayName: string;
    isVerified: boolean;
    profilePicture: string;
    channelSlug: string;
}

export interface KickUserWithIdentity extends KickUser {
    identity: KickIdentity;
}

export interface BasicKickUser {
    email?: string;
    name: string;
    profilePicture: string;
    userId: number;
}

export interface LivestreamMetadataUpdated {
    broadcaster: KickUser;
    metadata: {
        title: string;
        language: string;
        hasMatureContent: boolean;
        category: {
            id: number;
            name: string;
            thumbnail: string;
        };
    };
}

export interface LivestreamStatusUpdated {
    broadcaster: KickUser;
    isLive: boolean;
    title: string;
    startedAt?: Date;
    endedAt?: Date;
}

export interface Channel {
    bannerPicture: string;
    broadcasterUserId: number;
    category: {
        id: number;
        name: string;
        thumbnail: string;
    };
    channelDescription: string;
    slug: string;
    stream: {
        isLive: boolean;
        isMature: boolean;
        key: string;
        language: string;
        startTime?: Date;
        thumbnail: string;
        url: string;
        viewerCount: number;
    };
    streamTitle: string;
}

export interface CategoryInfo {
    id: number;
    name: string;
    thumbnail: string;
}

export interface ModerationBannedMetadata {
    reason: string;
    createdAt: Date;
    expiresAt?: Date; // null for permanent bans
}

export interface ModerationBannedEvent {
    broadcaster: KickUser;
    moderator: KickUser;
    bannedUser: KickUser;
    metadata: ModerationBannedMetadata;
}

export interface RewardRedeemedEvent {
    rewardTitle: string;
    userId: number;
    channelId: number;
    username: string;
    userInput: string;
    rewardBackgroundColor: string;
}

export interface StreamHostedEvent {
    user: KickUser;
    numberOfViewers: number;
    optionalMessage: string;
    createdAt: Date | undefined;
}

export interface ChannelSubscription {
    broadcaster: KickUser,
    subscriber: KickUser,
    duration: number,
    isResub: boolean
    createdAt: Date,
    expiresAt?: Date
}

export interface ChannelGiftSubscription {
    broadcaster: KickUser,
    gifter: KickUser,
    giftees: KickUser[],
    createdAt: Date,
    expiresAt?: Date
}

export interface KickGifter {
    userId: string,
    gifts: KickGiftSub[],
    totalSubs: number,
}

export interface KickGiftSub {
    userId: string,
    sub: KickSubscription
}

export interface KickSubscription {
    createdAt: Date,
    expiresAt: Date
}

export interface RaidSentOffEvent {
    targetUser: KickUser
    targetSlug: string
    numberOfViewers: number;
}
