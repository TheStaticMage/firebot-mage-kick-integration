import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../constants';

const triggers: TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:timeout`];
triggers["manual"] = true;

export const kickTimeoutDurationVariable: ReplaceVariable = {
    definition: {
        handle: "kickTimeoutDuration",
        description: "The duration of the timeout imposed on the user in seconds.",
        triggers: triggers,
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        return trigger.metadata.eventData?.timeoutDuration || 0;
    }
};
