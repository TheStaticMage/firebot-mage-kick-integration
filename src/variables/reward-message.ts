import { ReplaceVariable } from "@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager";
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

const triggers: TriggersObject = {
    // eslint-disable-next-line camelcase -- Firebot trigger id is snake_case
    channel_reward: true,
    manual: true
};

export const kickRewardMessageVariable: ReplaceVariable = {
    definition: {
        handle: "kickRewardMessage",
        description: "The reward message text.",
        categories: ["common"],
        possibleDataOutput: ["text"],
        triggers
    },
    evaluator: async (trigger) => {
        return trigger.metadata.messageText ?? "";
    }
};
