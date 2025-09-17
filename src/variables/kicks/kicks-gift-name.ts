import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const kicksGiftNameVariable: ReplaceVariable = {
    definition: {
        handle: "kicksGiftName",
        description: "The gift name of the kicks cheer.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        const giftName = trigger.metadata.eventData?.giftName ?? "";
        return giftName;
    }
};
