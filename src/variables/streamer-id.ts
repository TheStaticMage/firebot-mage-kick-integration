import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';

export const kickStreamerIdVariable: ReplaceVariable = {
    definition: {
        handle: "kickStreamerId",
        usage: "kickStreamerId",
        description: "Returns your Kick user ID",
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: async () => {
        return integration.kick.broadcaster?.userId || 0;
    }
};
