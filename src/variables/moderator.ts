import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { TriggersObject } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { IntegrationConstants } from '../constants';

const triggers: TriggersObject = {};
triggers["event"] = [
    `${IntegrationConstants.INTEGRATION_ID}:banned`,
    `${IntegrationConstants.INTEGRATION_ID}:timeout`,
    `${IntegrationConstants.INTEGRATION_ID}:unbanned`,
    "twitch:banned",
    "twitch:unbanned",
    "twitch:timeout",
    "twitch:chat-mode-changed",
    "twitch:shoutout-sent"
];
triggers["manual"] = true;

export const kickModeratorVariable: ReplaceVariable = {
    definition: {
        handle: "kickModerator",
        description: "The display name of the moderator that performed the action (ban, unban, timeout). Works for both Kick and Twitch events.",
        triggers: triggers,
        possibleDataOutput: ["text"]
    },
    evaluator: (trigger) => {
        const eventData = trigger.metadata.eventData;
        if (!eventData) {
            return "";
        }

        if (typeof eventData.moderatorUsername === "string" && eventData.moderatorUsername.length > 0) {
            return eventData.moderatorUsername;
        }

        if (typeof eventData.moderator === "string" && eventData.moderator.length > 0) {
            return eventData.moderator;
        }

        return "";
    }
};
