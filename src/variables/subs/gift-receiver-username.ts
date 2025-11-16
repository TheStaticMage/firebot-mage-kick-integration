import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';
import { kickifyUsername, unkickifyUsername } from '../../internal/util';
import { logger } from '../../main';
import { detectPlatform } from '@thestaticmage/mage-platform-lib-client';

export const kickGiftReceiverUsernameVariable: ReplaceVariable = {
    definition: {
        handle: "kickGiftReceiverUsername",
        description: "The name of the user who received a gifted sub. (Compatible with Kick and Twitch subs gifted events.)",
        triggers: {
            "event": ["twitch:subs-gifted", `${IntegrationConstants.INTEGRATION_ID}:subs-gifted`],
            "manual": true
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        let gifteeUsername: string = trigger.metadata.eventData?.gifteeUsername as string;
        if (!gifteeUsername) {
            logger.warn(`kickGiftReceiverUsernameVariable: Unknown giftee username! ${JSON.stringify(trigger.metadata)}`);
            gifteeUsername = "UnknownUser";
        }

        const platform = detectPlatform(trigger);
        switch (platform) {
            case "kick":
                return kickifyUsername(gifteeUsername);
            case "twitch":
                return unkickifyUsername(gifteeUsername);
            default:
                logger.warn(`kickGiftReceiverUsernameVariable: Unknown platform! ${JSON.stringify(trigger.metadata)}`);
                return gifteeUsername;
        }
    }
};
