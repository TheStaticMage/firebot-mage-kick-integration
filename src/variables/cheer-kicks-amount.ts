import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const cheerKicksAmountVariable: ReplaceVariable = {
    definition: {
        handle: "cheerKicksAmount",
        aliases: ["kickGameId"],
        description: "The amount of kicks (like bits) in the cheer.",
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: async (trigger) => {
        const kicks = trigger.metadata.eventData?.kicks ?? 0;
        return kicks;
    }
};
