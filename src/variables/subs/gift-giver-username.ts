import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';
import { kickifyUsername, unkickifyUsername } from '../../internal/util';
import { logger } from '../../main';
import { platformVariable } from '../platform';

export const kickGiftGiverUsernameVariable: ReplaceVariable = {
    definition: {
        handle: "kickGiftGiverUsername",
        description: "The name of the user who gifted a sub(s). (Compatible with Kick and Twitch subs gifted and community subs events.)",
        triggers: {
            "event": [
                "twitch:subs-gifted",
                `${IntegrationConstants.INTEGRATION_ID}:subs-gifted`,
                "twitch:community-subs-gifted",
                `${IntegrationConstants.INTEGRATION_ID}:community-subs-gifted`
            ],
            "manual": true
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        let gifterUsername: string = trigger.metadata.eventData?.gifterUsername as string;
        if (!gifterUsername) {
            logger.warn(`kickGiftGiverUsernameVariable: Unknown gifter username! ${JSON.stringify(trigger.metadata)}`);
            gifterUsername = "UnknownUser";
        }

        const platform = platformVariable.evaluator(trigger);
        switch (platform) {
            case "kick":
                return kickifyUsername(gifterUsername);
            case "twitch":
                return unkickifyUsername(gifterUsername);
            default:
                logger.warn(`kickGiftGiverUsernameVariable: Unknown platform! ${JSON.stringify(trigger.metadata)}`);
                return "UnknownUser";
        }
    }
};
