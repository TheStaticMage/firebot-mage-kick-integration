import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';

export const kickSubStreakVariable: ReplaceVariable = {
    definition: {
        handle: "kickSubStreak",
        description: "Number of consecutive months a user has been subscribed to your channel (Twitch) and total number of months subscribed (Kick).",
        triggers: {
            event: ["twitch:sub", `${IntegrationConstants.INTEGRATION_ID}:sub`],
            manual: true
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.streak ?? 1;
    }
};
