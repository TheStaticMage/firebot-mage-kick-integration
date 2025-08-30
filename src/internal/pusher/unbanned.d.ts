interface ViewerUnbannedEventData {
    id: string;
    user: {
        id: number;
        username: string;
        slug: string;
    };
    unbanned_by: {
        id: number;
        username: string;
        slug: string;
    };
    permanent: boolean;
}
