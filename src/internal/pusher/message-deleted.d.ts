interface MessageDeletedEvent {
    id: string;
    message: {
        id: string;
    };
    aiModerated: boolean;
    violatedRules: string[];
}
