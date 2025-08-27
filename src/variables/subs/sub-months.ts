import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';

export const kickSubMonthsVariable: ReplaceVariable = {
    definition: {
        handle: "kickSubMonths",
        description: "The total number of months the user has been subscribed since the beginning of time. (Compatible with Kick and Twitch sub events.)",
        triggers: {
            event: ["twitch:sub", `${IntegrationConstants.INTEGRATION_ID}:sub`],
            manual: true
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.totalMonths ?? 1;
    }
};
