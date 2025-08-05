interface InboundChannel {
    banner_picture: string;
    broadcaster_user_id: number;
    category: {
        id: number;
        name: string;
        thumbnail: string;
    };
    channel_description: string;
    slug: string;
    stream: {
        is_live: boolean;
        is_mature: boolean;
        key: string;
        language: string;
        start_time: string;
        thumbnail: string;
        url: string;
        viewer_count: number;
    };
    stream_title: string;
}
