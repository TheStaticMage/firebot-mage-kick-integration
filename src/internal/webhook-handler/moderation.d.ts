interface InboundModerationBannedEvent {
    broadcaster: InboundKickUser;
    moderator: InboundKickUser;
    banned_user: InboundKickUser;
    metadata: {
        reason: string;
        created_at: string;
        expires_at?: string; // null for permanent bans
    };
}
