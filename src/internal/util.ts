export function kickifyUserId(userId: string | number): string {
    return String(userId).startsWith("k") ? String(userId) : `k${userId}`;
}

export function unkickifyUserId(userId: string | number): string {
    return String(userId).startsWith("k") ? String(userId).substring(1) : String(userId);
}

export function kickifyUsername(username: string): string {
    return username.endsWith("@kick") ? username : `${username}@kick`;
}

export function unkickifyUsername(username: string): string {
    return username.endsWith("@kick") ? username.substring(0, username.length - 5) : username;
}

export function parseDate(dateString: string | undefined): Date | undefined {
    if (!dateString) {
        return undefined;
    }

    if (dateString === "0001-01-01T00:00:00Z") {
        return undefined;
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
}
