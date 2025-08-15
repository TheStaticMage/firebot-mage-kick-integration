import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';

const triggers: Effects.TriggersObject = {};
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
