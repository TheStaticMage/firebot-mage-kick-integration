interface ChatMoveToSupportedChannelEventPayload {
    channel: {
        id: number;
        user_id: number;
        slug: string;
        is_banned: boolean;
        playback_url: string;
        name_updated_at: string | null;
        vod_enabled: boolean;
        subscription_enabled: boolean;
        is_affiliate: boolean;
        can_host: boolean;
        current_livestream: {
            id: number;
            slug: string;
            channel_id: number;
            created_at: boolean;
            session_title: string;
            is_live: boolean;
            risk_level_id: number | null;
            start_time: boolean;
            source: string | null;
            twitch_channel: string | null;
            duration: number;
            language: string;
            is_mature: boolean;
            viewer_count: number;
        };
    };
    slug: string;
    hosted: {
        id: number;
        username: string;
        slug: string;
        viewers_count: number;
        is_live: boolean;
        profile_pic: string;
        category: string;
        preview_thumbnail: {
            srcset: string;
            src: string;
        };
    };
}
