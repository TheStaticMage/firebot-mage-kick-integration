import { EventData, EventFilter, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { compareValue, ComparisonType } from "./common";

export const webhookReceivedEventTypeFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:webhook-received-event-type`,
    name: "Event Type",
    description: "Checks if the event type of the received webhook matches the provided value.",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "webhook-received" }
    ],
    comparisonTypes: ["is", "is not"],
    valueType: "preset",
    presetValues(): PresetValue[] {
        return [
            { value: "chat.message.sent", display: "chat.message.sent" },
            { value: "channel.followed", display: "channel.followed" },
            { value: "channel.subscription.renewal", display: "channel.subscription.renewal" },
            { value: "channel.subscription.gifts", display: "channel.subscription.gifts" },
            { value: "channel.subscription.new", display: "channel.subscription.new" },
            { value: "livestream.metadata.updated", display: "livestream.metadata.updated" },
            { value: "livestream.status.updated", display: "livestream.status.updated" },
            { value: "moderation.banned", display: "moderation.banned" }
        ];
    },
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const match = eventData.eventMeta?.webhookType === String(value);
        return (comparisonType === ComparisonType.IS as any) ? match : !match;
    }
};

export const webhookReceivedLatencyFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:webhook-received-latency`,
    name: "Latency (ms)",
    description: "Checks the latency of the received webhook (in milliseconds).",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "webhook-received" }
    ],
    comparisonTypes: [
        ComparisonType.LESS_THAN,
        ComparisonType.LESS_THAN_OR_EQUAL_TO,
        ComparisonType.GREATER_THAN,
        ComparisonType.GREATER_THAN_OR_EQUAL_TO
    ],
    valueType: "number",
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const latencyNumber = Number(eventData.eventMeta.latencyMs);
        const latency = isNaN(latencyNumber) ? 0 : latencyNumber;
        return compareValue("webhookReceivedLatencyFilter", comparisonType as ComparisonType, value, latency);
    }
};
