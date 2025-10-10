import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";

export const hostViewerCount: ReplaceVariable = {
    definition: {
        handle: "hostViewerCount",
        description: "Outputs the number of viewers in the Kick host or the Twitch raid.",
        triggers: {
            "manual": true,
            "event": [
                "mage-kick-integration:raid",
                "mage-kick-integration:raid-sent-off",
                "twitch:raid",
                "twitch:raid-sent-off"
            ]
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger: Trigger) => {
        return trigger.metadata.eventData?.viewerCount || 0;
    }
};
