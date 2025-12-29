import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../../constants';

export const kickIsAnonymousVariable: ReplaceVariable = {
    definition: {
        handle: "kickIsAnonymous",
        description: "[DEPRECATED] Whether or not the gift sub(s) were given anonymously. (Compatible with gift subs and community subs events on Twitch and Kick.)",
        triggers: {
            "event": ["twitch:subs-gifted", "twitch:community-subs-gifted", `${IntegrationConstants.INTEGRATION_ID}:subs-gifted`, `${IntegrationConstants.INTEGRATION_ID}:community-subs-gifted`],
            "manual": true
        },
        categories: ["common"],
        possibleDataOutput: ["bool"]
    },
    evaluator: async (trigger) => {
        return trigger.metadata?.eventData?.isAnonymous === true;
    }
};
