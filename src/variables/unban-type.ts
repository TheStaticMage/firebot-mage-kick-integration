import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';

const triggers: Effects.TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:unbanned`
];
triggers["manual"] = true;

export const kickUnbanTypeVariable: ReplaceVariable = {
    definition: {
        handle: "kickUnbanType",
        description: "Resolves to 'timeout' or 'permanent' depending on whether the user was previously banned or timed out.",
        triggers: triggers,
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        const eventData = trigger.metadata.eventData;
        return eventData ? (eventData.banType === "timeout" ? "timeout" : "permanent") : "";
    }
};
