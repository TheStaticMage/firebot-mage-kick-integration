interface KickGiftedEventData {
    message: string;
    sender: {
        id: number;
        username: string;
        username_color: string;
    };
    gift: {
        amount: number;
    };
}
