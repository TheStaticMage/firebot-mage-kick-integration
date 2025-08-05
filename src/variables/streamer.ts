import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { integration } from '../integration';

export const kickStreamerVariable: ReplaceVariable = {
    definition: {
        handle: "kickStreamer",
        usage: "kickStreamer",
        description: "Returns your Kick username",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: async () => {
        return integration.kick.broadcaster?.name || "";
    }
};
