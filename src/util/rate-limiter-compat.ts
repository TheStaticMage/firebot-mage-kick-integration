import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { logger } from "../main";

/**
 * Type definition for rate limiter's LimitExceededEventMetadata.
 * From firebot-rate-limiter/src/shared/types.ts
 */
export type LimitExceededEventMetadata = {
    triggerMetadata: Record<string, any>;
    triggerType: string;
    triggerUsername: string;
    bucketId: string;
    bucketKey: string;
    errorMessage?: string;
    rejectReason?: string;
    next: number;
    remaining: number;
    tokens: number;
    invocation: number;
    invocationLimit: boolean;
    invocationLimitValue: number;
    inquiry: boolean;
    username: string;
    metadataKey: string;
    stackDepth: number;
};

/**
 * Checks if trigger is from rate-limiter:limit-exceeded event.
 *
 * A rate limiter event has these characteristics:
 * - trigger.type === "event"
 * - trigger.metadata.eventSource.id === "rate-limiter"
 * - trigger.metadata.eventData.triggerMetadata exists and is an object
 */
export function isRateLimiterEvent(trigger: Trigger): boolean {
    return trigger.type === "event" &&
           trigger.metadata?.eventSource?.id === "rate-limiter" &&
           typeof trigger.metadata?.eventData?.triggerMetadata === "object";
}

/**
 * Gets the effective metadata for platform detection, unwrapping rate limiter
 * events if necessary.
 *
 * When rate-limiter:limit-exceeded event fires, the ORIGINAL event metadata
 * is nested inside the triggerMetadata field. This function unwraps it to
 * provide a normalized structure that matches normal event shapes.
 *
 * For normal events, metadata is passed through unchanged.
 */
export function getEffectiveMetadata(trigger: Trigger): {
    eventData: Record<string, any> | undefined;
    chatMessage: Record<string, any> | undefined;
    username: string;
    eventSource: { id: string; name: string } | undefined;
} {
    if (isRateLimiterEvent(trigger)) {
        const rateLimitData = trigger.metadata.eventData as LimitExceededEventMetadata;
        logger.debug(`Unwrapping rate limiter metadata for platform detection. Original triggerType: ${rateLimitData.triggerType}`);
        return {
            eventData: rateLimitData.triggerMetadata,
            chatMessage: (typeof rateLimitData.triggerMetadata.chatMessage === "object" ? rateLimitData.triggerMetadata.chatMessage : undefined) as Record<string, any> | undefined,
            username: rateLimitData.triggerUsername || "",
            eventSource: trigger.metadata.eventSource
        };
    }

    return {
        eventData: (typeof trigger.metadata?.eventData === "object" ? trigger.metadata.eventData : undefined) as Record<string, any> | undefined,
        chatMessage: (typeof trigger.metadata?.chatMessage === "object" ? trigger.metadata.chatMessage : undefined) as Record<string, any> | undefined,
        username: trigger.metadata?.username || "",
        eventSource: trigger.metadata?.eventSource
    };
}
