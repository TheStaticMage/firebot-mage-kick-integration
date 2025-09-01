interface ViewerBannedEventData {
    id: string;
    user: {
        id: number;
        username: string;
        slug: string;
    };
    banned_by: {
        id: number;
        username: string;
        slug: string;
    };
    permanent: boolean;
    duration?: number; // Set for timeout events, unset for permanent bans
    expires_at?: string; // Set for timeout events, unset for permanent bans
}
