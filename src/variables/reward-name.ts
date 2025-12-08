import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

const triggers: TriggersObject = {
    // eslint-disable-next-line camelcase -- Firebot trigger id is snake_case
    channel_reward: true,
    manual: true,
    preset: true
};

export const kickRewardNameVariable: ReplaceVariable = {
    definition: {
        handle: "kickRewardName",
        description: "The name of the reward",
        categories: ["common"],
        possibleDataOutput: ["text"],
        triggers
    },
    evaluator: async (trigger) => {
        return trigger.metadata.rewardName ?? "";
    }
};
