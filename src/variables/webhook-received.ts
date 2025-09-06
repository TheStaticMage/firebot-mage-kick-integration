import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { ReplaceVariable } from '@crowbartools/firebot-custom-scripts-types/types/modules/replace-variable-manager';
import { IntegrationConstants } from "../constants";

export const webhookReceivedEventTypeVariable: ReplaceVariable = {
    definition: {
        handle: "webhookReceivedEventType",
        description: "Outputs the event type of the received webhook.",
        examples: [
            {
                usage: "webhookReceivedEventType",
                description: "The type of the received webhook event."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": [`${IntegrationConstants.INTEGRATION_ID}:webhook-received`]
        }
    },
    evaluator: (trigger: Effects.Trigger) => {
        return trigger.metadata.eventData?.webhookType || "";
    }
};

export const webhookReceivedEventVersionVariable: ReplaceVariable = {
    definition: {
        handle: "webhookReceivedEventVersion",
        description: "Outputs the event version of the received webhook.",
        examples: [
            {
                usage: "webhookReceivedEventVersion",
                description: "The version of the received webhook event."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["text"],
        triggers: {
            "manual": true,
            "event": [`${IntegrationConstants.INTEGRATION_ID}:webhook-received`]
        }
    },
    evaluator: (trigger: Effects.Trigger) => {
        return trigger.metadata?.eventData?.webhookVersion || "";
    }
};

export const webhookReceivedLatencyVariable: ReplaceVariable = {
    definition: {
        handle: "webhookReceivedLatency",
        description: "Outputs the latency of the received webhook event (in milliseconds).",
        examples: [
            {
                usage: "webhookReceivedLatency",
                description: "The latency of the received webhook event (in milliseconds)."
            }
        ],
        categories: ["common"],
        possibleDataOutput: ["number"],
        triggers: {
            "manual": true,
            "event": [`${IntegrationConstants.INTEGRATION_ID}:webhook-received`]
        }
    },
    evaluator: (trigger: Effects.Trigger) => {
        return trigger.metadata?.eventData?.latencyMs || 0;
    }
};
