import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const kicksGiftIdVariable: ReplaceVariable = {
    definition: {
        handle: "kicksGiftId",
        description: "The gift ID of the kicks cheer.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        const giftId = trigger.metadata.eventData?.giftId ?? "";
        return giftId;
    }
};
