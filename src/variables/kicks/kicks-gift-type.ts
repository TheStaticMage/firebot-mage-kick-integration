import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const kicksGiftTypeVariable: ReplaceVariable = {
    definition: {
        handle: "kicksGiftType",
        description: "The gift type of the kicks cheer.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        const giftType = trigger.metadata.eventData?.giftType ?? "";
        return giftType;
    }
};
