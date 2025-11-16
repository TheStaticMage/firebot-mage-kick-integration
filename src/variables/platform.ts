import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { detectPlatform } from '@thestaticmage/mage-platform-lib-client';
import { logger } from "../main";
import { getPropertyFromChatMessage } from '../util/util';

export const platformVariable: ReplaceVariable = {
    definition: {
        handle: "platform",
        aliases: ["platform"],
        description: "Returns the platform on which the event was triggered (twitch, kick, firebot, etc.)",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        const result = detectPlatform(trigger);
        debugPlatform(result, "detectPlatform", trigger);
        return result;
    }
};

function debugPlatform(result: string, reference: string, trigger: Trigger): string {
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
                userId: getPropertyFromChatMessage(trigger, 'userId'),
                username: getPropertyFromChatMessage(trigger, 'username')
            }
        }
    };
    logger.debug(`platformVariable evaluated to "${result}" from "${reference}": trigger=${JSON.stringify(interestingPartsOfTrigger)}`);
    return result;
}
