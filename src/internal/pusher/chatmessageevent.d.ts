interface ChatMessageEvent {
    id: string;
    chatroom_id: number;
    content: string;
    type: string;
    created_at: string;
    sender: {
        id: number;
        username: string;
        slug: string;
        identity: {
            color: string;
            badges: InboundBadge[];
        };
    };
    metadata: {
        message_ref: string;
    };
}

interface InboundBadge {
    text: string;
    type: string;
    count?: number;
}
