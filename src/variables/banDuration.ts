import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from '../constants';

const triggers: Effects.TriggersObject = {};
triggers["event"] = [`${IntegrationConstants.INTEGRATION_ID}:banned`];
triggers["manual"] = true;

export const kickBanDuration: ReplaceVariable = {
    definition: {
        handle: "kickBanDuration",
        description: "The duration of the ban imposed on the user in seconds (-1 = permanent).",
        triggers: triggers,
        possibleDataOutput: ["number"]
    },
    evaluator: (trigger) => {
        const expiresAt = trigger.metadata.eventData?.expiresAt;
        if (!expiresAt || !(expiresAt instanceof Date)) {
            return -1; // Permanent ban
        }

        const now = new Date();
        const duration = expiresAt.getTime() - now.getTime();
        return Math.max(0, Math.floor(duration / 1000));
    }
};
