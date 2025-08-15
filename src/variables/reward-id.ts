import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';
import * as crypto from 'crypto';

const triggers: Effects.TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:channel-reward-redemption`];
triggers["manual"] = true;
triggers["preset"] = true;

export const kickRewardIdVariable : ReplaceVariable = {
    definition: {
        handle: "kickRewardId",
        description: "The ID of the reward. Since Kick does not provide reward IDs, this is a hashed value of the reward title.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        if (trigger.metadata.eventData?.rewardId) {
            return trigger.metadata.eventData.rewardId;
        }

        // If no reward ID is provided, we generate a hash based on the reward title.
        if (typeof trigger.metadata.eventData?.rewardTitle === 'string' && trigger.metadata.eventData.rewardTitle.length > 0) {
            return crypto.createHash('sha256').update(trigger.metadata.eventData.rewardTitle, 'utf8').digest('hex');
        }

        // If no reward title is available, return an empty string.
        return "";
    }
};
