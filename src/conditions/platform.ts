import { ConditionType, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/condition-manager";
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from "../constants";
import { platformVariable } from "../variables/platform";

const triggers: TriggersObject = {
    "channel_reward": true,
    "command": true,
    "event": true,
    "preset": true,
    "manual": true
};

export const platformCondition: ConditionType<any, any, any> = {
    id: `${IntegrationConstants.INTEGRATION_ID}:platform`,
    name: "Platform",
    description: "Condition based on the platform in the trigger metadata",
    triggers: triggers,
    comparisonTypes: ["is", "isNot"],
    leftSideValueType: "none",
    rightSideValueType: "preset",
    getRightSidePresetValues(): PresetValue[] {
        return [
            { value: "kick", display: "Kick" },
            { value: "twitch", display: "Twitch" },
            { value: "any", display: "Either Kick or Twitch" }
        ];
    },
    predicate: (conditionSettings, trigger) => {
        const { comparisonType, rightSideValue } = conditionSettings;
        const platform = platformVariable.evaluator(trigger);
        const match = checkMatch(platform, rightSideValue);
        switch (comparisonType) {
            case "is":
                return match;
            case "isNot":
                return !match;
            default:
                return false;
        }
    }
};

function checkMatch(platform: string, rightSideValue: string | number): boolean {
    if (platform === "unknown") {
        return false;
    }
    if (rightSideValue === "any") {
        return platform === "kick" || platform === "twitch";
    }
    return platform === rightSideValue;
}
