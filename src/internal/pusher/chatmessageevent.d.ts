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
    metadata?: {
        original_sender: InboundOriginalSender;
        original_message?: InboundOriginalMessage;
        message_ref: string;
    };
}

interface InboundBadge {
    text: string;
    type: string;
    count?: number;
}

interface InboundOriginalSender {
    id: number;
    username: string;
}

interface InboundOriginalMessage {
    id: string;
    content: string;
}
