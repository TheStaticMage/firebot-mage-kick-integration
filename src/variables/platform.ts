import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { getPlatformFromTrigger } from '../internal/platform-detection';

export const platformVariable: ReplaceVariable = {
    definition: {
        handle: "platform",
        aliases: ["platform"],
        description: "Returns the platform on which the event was triggered (twitch, kick, firebot, etc.)",
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Trigger) => getPlatformFromTrigger(trigger)
};
