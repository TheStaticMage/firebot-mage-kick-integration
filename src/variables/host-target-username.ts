import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';

export const hostTargetUsername: ReplaceVariable = {
    definition: {
        handle: "hostTargetUsername",
        description: "Outputs the username of the person you are hosting (or raiding).",
        triggers: {
            "manual": true,
            "event": [
                "mage-kick-integration:raid-sent-off",
                "twitch:raid-sent-off"
            ]
        },
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger: Effects.Trigger) => {
        return trigger.metadata.eventData?.raidTargetUsername ?? "";
    }
};
