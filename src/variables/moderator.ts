import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';

const triggers: Effects.TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:banned`, `${IntegrationConstants.INTEGRATION_ID}:timeout`];
triggers["manual"] = true;

export const kickModerator: ReplaceVariable = {
    definition: {
        handle: "kickModerator",
        description: "The username of the moderator that performed the action (ban).",
        triggers: triggers,
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.moderatorDisplayName || "";
    }
};
