interface KickGiftedEventData {
    message: string;
    sender: {
        id: number;
        username: string;
        username_color: string;
    };
    gift: {
        gift_id: string;
        name: string;
        amount: number;
        type: string;
        tier: string;
        character_limit: number;
        pinned_time: number;
    };
}
