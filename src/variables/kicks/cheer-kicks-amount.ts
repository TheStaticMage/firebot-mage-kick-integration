import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const cheerKicksAmountVariable: ReplaceVariable = {
    definition: {
        handle: "cheerKicksAmount",
        description: "The amount of kicks (like bits) in the cheer.",
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: async (trigger) => {
        const kicks = trigger.metadata.eventData?.amount ?? trigger.metadata.eventData?.bits ?? 0;
        return kicks;
    }
};
