interface InboundStreamHostedEvent {
    message: {
        id: string;
        numberOfViewers: number;
        optionalMessage: string;
        createdAt: string;
    };
    user: {
        id: number;
        username: string;
        isSuperAdmin: boolean;
        verified?: {
            id: number;
            channel_id: number;
            created_at: string;
            updated_at: string;
        };
    };
}
