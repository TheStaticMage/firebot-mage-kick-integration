import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { detectPlatform } from '@thestaticmage/mage-platform-lib-client';
import { IntegrationConstants } from '../../constants';
import { logger } from '../../main';

export const kickSubTypeVariable: ReplaceVariable = {
    definition: {
        handle: "kickSubType",
        description: "[DEPRECATED] The type of subscription (for Twitch: Tier 1, Tier 2, Tier 3, Prime; for Kick, hard-coded since Kick does not report sub types.)",
        triggers: {
            event: ["twitch:sub", "twitch:prime-sub-upgraded", `${IntegrationConstants.INTEGRATION_ID}:sub`]
        },
        categories: ["common"],
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        const platform = detectPlatform(trigger);
        switch (platform) {
            case "kick":
                return trigger.metadata.eventData?.subPlan || "kickDefault";
            case "twitch":
                switch (trigger.metadata.eventData?.subPlan) {
                    case "Prime":
                        return "Prime";
                    case "1000":
                        return "Tier 1";
                    case "2000":
                        return "Tier 2";
                    case "3000":
                        return "Tier 3";
                }
                logger.warn(`kickSubTypeVariable: Unknown Twitch sub plan! ${JSON.stringify(trigger.metadata)}`);
                return "";
        }
        logger.warn(`kickSubTypeVariable: Unknown platform! ${JSON.stringify(trigger.metadata)}`);
        return "";
    }
};
