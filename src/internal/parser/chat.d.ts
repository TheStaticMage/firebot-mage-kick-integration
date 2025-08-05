interface InboundBadge {
    text: string;
    type: string;
}

interface InboundChatMessage {
    message_id: string;
    broadcaster: InboundKickUser;
    sender: InboundKickUser;
    content: string;
    emotes?: null; // Seems to be outdated in documentation and coming through as null
    created_at: string;
}
