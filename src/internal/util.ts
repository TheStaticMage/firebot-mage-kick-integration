export function kickifyUserId(userId: string | number | undefined): string {
    if (userId === undefined || userId === null) {
        return "";
    }
    return String(userId).startsWith("k") ? String(userId) : `k${userId}`;
}

export function unkickifyUserId(userId: string | number | undefined): string {
    if (userId === undefined || userId === null) {
        return "";
    }
    return String(userId).startsWith("k") ? String(userId).substring(1) : String(userId);
}

export function kickifyUsername(username: string | undefined): string {
    if (!username) {
        return "";
    }
    let result = username.endsWith("@kick") ? username : `${username}@kick`;
    if (result.startsWith("@")) {
        result = result.substring(1);
    }
    return result;
}

export function unkickifyUsername(username: string | undefined): string {
    if (!username) {
        return "";
    }
    let result = username.endsWith("@kick") ? username.substring(0, username.length - 5) : username;
    if (result.startsWith("@")) {
        result = result.substring(1);
    }
    return result;
}

export function parseDate(dateString: string | undefined | null): Date | undefined {
    if (!dateString || dateString === null || dateString === undefined) {
        return undefined;
    }

    if (dateString === "0001-01-01T00:00:00Z") {
        return undefined;
    }

    const date = new Date(dateString);
    return isNaN(date.getTime()) ? undefined : date;
}

export function userIdToCleanString(userId: string | number = ""): string {
    if (typeof userId === "number") {
        return userId > 0 ? userId.toString() : "";
    }
    const unkickifiedUserId = unkickifyUserId(userId);
    if (unkickifiedUserId.trim() !== "") {
        if (!/^\d+$/.test(unkickifiedUserId)) {
            throw new Error("userId string must be numeric.");
        }
        return unkickifiedUserId;
    }
    return "";
}

export function userIdToCleanNumber(userId: string | number = ""): number {
    const cleanedId = userIdToCleanString(userId);
    if (cleanedId === "") {
        return 0;
    }

    const numericValue = Number(cleanedId);

    // Check for integer overflow - numbers larger than MAX_SAFE_INTEGER lose precision
    if (numericValue > Number.MAX_SAFE_INTEGER) {
        throw new Error(`userId number ${cleanedId} exceeds maximum safe integer value (${Number.MAX_SAFE_INTEGER})`);
    }

    return numericValue;
}
