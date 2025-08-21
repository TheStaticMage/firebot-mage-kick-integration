import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const hostViewerCount: ReplaceVariable = {
    definition: {
        handle: "hostViewerCount",
        description: "Outputs the number of viewers in the Kick host or the Twitch raid.",
        triggers: {
            "manual": true,
            "event": [
                "mage-kick-integration:raid",
                "twitch:raid",
                "twitch:raid-sent-off"
            ]
        },
        categories: ["common"],
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger: Effects.Trigger) => {
        return trigger.metadata.eventData?.viewerCount || 0;
    }
};
