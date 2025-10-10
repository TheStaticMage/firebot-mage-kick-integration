import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

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
    if (trigger.metadata.chatMessage && typeof trigger.metadata.chatMessage === "object" && property in trigger.metadata.chatMessage) {
        return (trigger.metadata.chatMessage as Record<string, any>)[property];
    }
    if (trigger.metadata.eventData && typeof trigger.metadata.eventData === "object" && "chatMessage" in trigger.metadata.eventData && trigger.metadata.eventData.chatMessage && typeof trigger.metadata.eventData.chatMessage === "object" && property in trigger.metadata.eventData.chatMessage) {
        return (trigger.metadata.eventData.chatMessage as Record<string, any>)[property];
    }
    return "";
}
