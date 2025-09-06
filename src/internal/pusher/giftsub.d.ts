interface PusherGiftSubEvent {
    channel: {
        user_id: number;
        // There's a lot more channel information in this data structure but
        // it's not really related to the gift sub itself.
    };
    usernames: string[];
    gifter_username: string;
}
