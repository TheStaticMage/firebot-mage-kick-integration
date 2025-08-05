interface InboundKickBadge {
    text: string;
    type: string;
    count?: number;
}

interface InboundKickUser {
    is_anonymous?: boolean;
    user_id: number;
    username: string;
    is_verified: boolean;
    profile_picture: string;
    channel_slug: string;
    identity?: {
        username_color: string;
        badges: InboundKickBadge[];
    };
}

interface InboundBasicKickUser {
    email?: string;
    name: string;
    profile_picture: string;
    user_id: number;
}
