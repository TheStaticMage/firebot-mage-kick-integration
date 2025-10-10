import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../constants';

const triggers: TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:channel-reward-redemption`];
triggers["manual"] = true;

export const kickRewardMessageVariable : ReplaceVariable = {
    definition: {
        handle: "kickRewardMessage",
        description: "The reward message text.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        return (trigger.metadata.eventData ? trigger.metadata.eventData.rewardMessage || trigger.metadata.messageText : "") || "";
    }
};
