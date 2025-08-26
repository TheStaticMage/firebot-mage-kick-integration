import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';

export const kickGiftCountVariable: ReplaceVariable = {
    definition: {
        handle: "kickGiftCount",
        description: "The number of subs gifted. (Compatible with Kick and Twitch community subs gifted events.)",
        triggers: {
            "event": ["twitch:community-subs-gifted", `${IntegrationConstants.INTEGRATION_ID}:community-subs-gifted`],
            "manual": true
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.subCount ?? 0;
    }
};
