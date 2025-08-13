interface InboundLivestreamStatusUpdatedEvent {
    broadcaster: InboundKickUser;
    is_live: boolean;
    title: string;
    started_at?: string; // Only present if the stream has started
    ended_at?: string; // Only present if the stream has ended
}
