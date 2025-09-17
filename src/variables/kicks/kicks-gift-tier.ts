import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const kicksGiftTierVariable: ReplaceVariable = {
    definition: {
        handle: "kicksGiftTier",
        description: "The gift tier of the kicks cheer.",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async (trigger) => {
        const giftTier = trigger.metadata.eventData?.giftTier ?? "";
        return giftTier;
    }
};
