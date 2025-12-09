import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { getEffectiveMetadata } from './rate-limiter-compat';

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

export function getPropertyFromChatMessage(trigger: Trigger, property: string): string {
    const effectiveMetadata = getEffectiveMetadata(trigger);

    if (effectiveMetadata.chatMessage && typeof effectiveMetadata.chatMessage === "object" && property in effectiveMetadata.chatMessage) {
        return effectiveMetadata.chatMessage[property];
    }
    if (effectiveMetadata.eventData && typeof effectiveMetadata.eventData === "object" && "chatMessage" in effectiveMetadata.eventData && effectiveMetadata.eventData.chatMessage && typeof effectiveMetadata.eventData.chatMessage === "object" && property in effectiveMetadata.eventData.chatMessage) {
        return effectiveMetadata.eventData.chatMessage[property];
    }
    return "";
}
