import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';
import { logger } from "../main";

export const platformVariable: ReplaceVariable = {
    definition: {
        handle: "platform",
        aliases: ["platform"],
        description: "Returns the platform on which the event was triggered (twitch, kick, firebot, etc.)",
        categories: ["common"],
        possibleDataOutput: ["text"],
        triggers: {
            event: true,
            manual: true
        }
    },
    evaluator: (trigger) => {
        // Manual trigger returns "manual"
        if (trigger.type === "manual") {
            return debugPlatform("manual", "trigger.type", trigger);
        }

        // See if the platform is explicitly set in the metadata
        if (typeof trigger.metadata.eventData?.platform === "string") {
            return debugPlatform(trigger.metadata.eventData.platform, "metadata.eventData.platform", trigger);
        }

        if (typeof trigger.metadata.platform === "string") {
            return debugPlatform(trigger.metadata.platform, "metadata.platform", trigger);
        }

        // If the event source is the Kick integration
        if (trigger.metadata.eventSource?.id === IntegrationConstants.INTEGRATION_ID) {
            return debugPlatform("kick", "metadata.eventSource.id", trigger);
        }

        // If there's a chat message, guess the platform from the user ID or username
        if (trigger.metadata.chatMessage) {
            const chatMessage = trigger.metadata.chatMessage;
            if (chatMessage.userId && chatMessage.userId.startsWith("k")) {
                return debugPlatform("kick", "metadata.chatMessage.userId", trigger);
            }

            if (chatMessage.username && chatMessage.username.endsWith("@kick")) {
                return debugPlatform("kick", "metadata.chatMessage.username", trigger);
            }

            if (chatMessage.userId || chatMessage.username) {
                return debugPlatform("twitch", "metadata.chatMessage.userId/username", trigger);
            }
        }

        // If there's user information in the event, guess the platform from the user ID or username
        if (trigger.metadata.eventData) {
            const eventData = trigger.metadata.eventData;

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
        if (typeof trigger.metadata.username === 'string') {
            if (trigger.metadata.username.endsWith('@kick')) {
                return debugPlatform("kick", "metadata.username", trigger);
            }
            if (trigger.metadata.username !== '') {
                return debugPlatform("twitch", "metadata.username", trigger);
            }
        }

        // If the event source is reported, we'll return it.
        if (typeof trigger.metadata.eventSource?.id === "string") {
            return debugPlatform(trigger.metadata.eventSource.id, "metadata.eventSource.id", trigger);
        }

        // At this point we don't know
        return "unknown";
    }
};

function debugPlatform(result: string, reference: string, trigger: Effects.Trigger): string {
    // Skip this in tests
    if (process.env.NODE_ENV === "test") {
        return result;
    }

    const interestingPartsOfTrigger = {
        type: trigger.type,
        metadata: {
            platform: trigger.metadata.platform,
            username: trigger.metadata.username,
            eventSource: trigger.metadata.eventSource,
            eventData: {
                platform: trigger.metadata.eventData?.platform,
                userId: trigger.metadata.eventData?.userId,
                username: trigger.metadata.eventData?.username
            },
            chatMessage: {
                userId: trigger.metadata.chatMessage?.userId,
                username: trigger.metadata.chatMessage?.username
            }
        }
    };
    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] platformVariable evaluated to "${result}" from "${reference}": trigger=${JSON.stringify(interestingPartsOfTrigger)}`);
    return result;
}
