import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../constants';
import { logger } from "../main";
import { getEffectiveMetadata, isRateLimiterEvent } from '../util/rate-limiter-compat';

/**
 * Detects and returns the platform of a trigger event.
 *
 * Uses multiple heuristics to determine if an event originated from Kick or Twitch:
 * - Event source ID matching Kick integration ID → "kick"
 * - User IDs starting with "k" → "kick"
 * - Usernames ending with "@kick" → "kick"
 * - Other user IDs/usernames → "twitch"
 * - Event source ID (fallback) → returns the ID as-is
 *
 * Handles rate limiter events by unwrapping nested metadata.
 *
 * @param trigger - The trigger event to analyze
 * @returns Platform identifier: "kick", "twitch", or "unknown"
 */
export function getPlatformFromTrigger(trigger: Trigger): string {
    // Unwrap rate limiter metadata if present
    const effectiveMetadata = getEffectiveMetadata(trigger);

    // Manual trigger prefers the event source regardless of metadata
    if (trigger.type === "manual") {
        switch (effectiveMetadata.eventSource?.id) {
            case IntegrationConstants.INTEGRATION_ID:
                return debugPlatform("kick", "metadata.eventSource.id (manual)", trigger);
            case "twitch":
                return debugPlatform("twitch", "metadata.eventSource.id (manual)", trigger);
        }
    }

    // See if the platform is explicitly set in the metadata
    if (typeof effectiveMetadata.eventData?.platform === "string") {
        return debugPlatform(effectiveMetadata.eventData.platform, "metadata.eventData.platform", trigger);
    }

    // Note: We check original trigger.metadata.platform (not effectiveMetadata)
    // because rate limiter events don't set platform at top level
    if (typeof trigger.metadata.platform === "string") {
        return debugPlatform(trigger.metadata.platform, "metadata.platform", trigger);
    }

    // If the event source is the Kick integration
    if (effectiveMetadata.eventSource?.id === IntegrationConstants.INTEGRATION_ID) {
        return debugPlatform("kick", "metadata.eventSource.id", trigger);
    }

    // If there's a chat message, guess the platform from the user ID or username
    if (effectiveMetadata.chatMessage) {
        const userId = effectiveMetadata.chatMessage.userId;
        if (userId && userId.startsWith("k")) {
            return debugPlatform("kick", "metadata.chatMessage.userId", trigger);
        }

        const username = effectiveMetadata.chatMessage.username;
        if (username && username.endsWith("@kick")) {
            return debugPlatform("kick", "metadata.chatMessage.username", trigger);
        }

        if (userId || username) {
            return debugPlatform("twitch", "metadata.chatMessage.userId/username", trigger);
        }
    }

    // If there's user information in the event, guess the platform from the user ID or username
    if (effectiveMetadata.eventData) {
        const eventData = effectiveMetadata.eventData;

        if (typeof eventData.userId === "string" && eventData.userId.startsWith("k")) {
            return debugPlatform("kick", "metadata.eventData.userId", trigger);
        }

        if (typeof eventData.username === "string" && eventData.username.endsWith("@kick")) {
            return debugPlatform("kick", "metadata.eventData.username", trigger);
        }

        if (eventData.userId || eventData.username) {
            return debugPlatform("twitch", "metadata.eventData.userId/username", trigger);
        }
    }

    // Username in top level metadata
    if (typeof effectiveMetadata.username === 'string') {
        if (effectiveMetadata.username.endsWith('@kick')) {
            return debugPlatform("kick", "metadata.username", trigger);
        }
        if (effectiveMetadata.username !== '') {
            return debugPlatform("twitch", "metadata.username", trigger);
        }
    }

    // If the event source is reported, we'll return it.
    if (typeof effectiveMetadata.eventSource?.id === "string") {
        return debugPlatform(effectiveMetadata.eventSource.id, "metadata.eventSource.id", trigger);
    }

    // At this point we don't know
    return "unknown";
}

function debugPlatform(result: string, reference: string, trigger: Trigger): string {
    // Skip this in tests
    if (process.env.NODE_ENV === "test") {
        return result;
    }

    const effectiveMetadata = getEffectiveMetadata(trigger);
    const interestingPartsOfTrigger = {
        type: trigger.type,
        isRateLimitEvent: isRateLimiterEvent(trigger),
        metadata: {
            platform: trigger.metadata.platform,
            username: effectiveMetadata.username,
            eventSource: effectiveMetadata.eventSource,
            eventData: {
                platform: effectiveMetadata.eventData?.platform,
                userId: effectiveMetadata.eventData?.userId,
                username: effectiveMetadata.eventData?.username
            },
            chatMessage: {
                userId: effectiveMetadata.chatMessage?.userId,
                username: effectiveMetadata.chatMessage?.username
            }
        }
    };
    logger.debug(`getPlatformFromTrigger evaluated to "${result}" from "${reference}": trigger=${JSON.stringify(interestingPartsOfTrigger)}`);
    return result;
}
