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
