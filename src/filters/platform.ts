import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { EventData, EventFilter, FilterEvent, PresetValue } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { platformVariable } from "../variables/platform";

// This can be useful if the user is forwarding Kick events to the corresponding
// Twitch handlers. Otherwise it's kind of silly...
//
// We're only including the Twitch events that we might forward to. The Kick
// version of the events only ever come from Kick anyway, so this filter would
// be pointless to add to the Kick events.

const events = [
    "banned",
    "chat-message",
    "follow",
    "stream-offline",
    "stream-online",
    "timeout",
    "viewer-arrived"
];

const applicableTwitchEvents: FilterEvent[] = events.map(eventId => ({
    eventSourceId: "twitch",
    eventId
}));

export const platformFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:platform`,
    name: "Platform",
    description: "Checks the platform of the event.",
    events: applicableTwitchEvents,
    comparisonTypes: ["is", "is not"],
    valueType: "preset",
    presetValues(): PresetValue[] {
        return [
            { value: "kick", display: "Kick" },
            { value: "twitch", display: "Twitch" }
        ];
    },
    getSelectedValueDisplay: (filterSettings) => {
        switch (filterSettings.value) {
            case "kick":
                return "Kick";
            case "twitch":
                return "Twitch";
            default:
                return `??? (${filterSettings.value})`;
        }
    },
    predicate: (
        filterSettings,
        eventData: EventData
    ): boolean => {
        const { comparisonType, value } = filterSettings;
        const trigger: Effects.Trigger = {
            type: "event",
            metadata: {
                eventSource: { id: eventData.eventSourceId, name: eventData.eventSourceId },
                eventData: eventData.eventMeta,
                username: "" // We don't know it in the filter
            }
        };
        const platform = platformVariable.evaluator(trigger);
        return (comparisonType === "is" && platform === value) ||
               (comparisonType === "is not" && platform !== value);
    }
};
