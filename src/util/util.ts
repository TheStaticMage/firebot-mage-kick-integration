export function getNumberFromUnknown(input: unknown, defaultValue: string): string {
    if (typeof input === "number" && !isNaN(input)) {
        return input.toString();
    }
    if (typeof input === "string") {
        const parsed = parseInt(input, 10);
        if (!isNaN(parsed)) {
            return parsed.toString();
        }
    }
    return defaultValue;
}
