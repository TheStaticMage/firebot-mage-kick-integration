export function kickifyUserId(userId: string): string {
    return userId.startsWith("k") ? userId : `k${userId}`;
}

export function unkickifyUserId(userId: string): string {
    return userId.startsWith("k") ? userId.substring(1) : userId;
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
