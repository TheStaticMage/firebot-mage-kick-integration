import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../constants';

const triggers: TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:banned`, `${IntegrationConstants.INTEGRATION_ID}:timeout`];
triggers["manual"] = true;

export const kickModReason: ReplaceVariable = {
    definition: {
        handle: "kickModReason",
        description: "The reason given by the moderator for the action (ban).",
        triggers: triggers,
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.modReason || "";
    }
};
