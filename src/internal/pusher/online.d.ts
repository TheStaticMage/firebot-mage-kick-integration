interface StreamerIsLiveEvent {
    livestream: {
        id: number;
        channel_id: number;
        session_title: string;
        source: string | null;
        created_at: string;
    };
}
