import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";

export const viewerRolesFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:viewerroles`,
    name: "Viewer's Roles",
    description: "Filter to a given viewer role",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "viewer-arrived" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "chat-message" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "chat-message-deleted" }
    ],
    comparisonTypes: ["include", "doesn't include"],
    valueType: "preset",
    presetValues: () => {
        return [
            { value: "broadcaster", display: "Broadcaster" },
            { value: "mod", display: "Moderator" },
            { value: "vip", display: "VIP" },
            { value: "founder", display: "Founder" },
            { value: "sub", display: "Subscriber" },
            { value: "og", display: "OG" }
        ];
    },
    valueIsStillValid: (filterSettings) => {
        return filterSettings != null && filterSettings.value != null && ["broadcaster", "mod", "vip", "founder", "sub", "og"].includes(filterSettings.value);
    },
    getSelectedValueDisplay: (filterSettings) => {
        return [ // These are the "Twitch roles" to align with what's stored in the database
            { value: "broadcaster", display: "Broadcaster" },
            { value: "mod", display: "Moderator" },
            { value: "vip", display: "VIP" },
            { value: "founder", display: "Founder" },
            { value: "sub", display: "Subscriber" },
            { value: "og", display: "OG" }
        ].find(v => v.value === filterSettings.value)?.display || filterSettings.value;
    },
    predicate: async (filterSettings, eventData) => {
        const { comparisonType, value } = filterSettings;
        const { eventMeta } = eventData;

        const username = eventMeta.username as string;
        const userId = eventMeta.userId as string;

        if (!username && !userId) {
            return false;
        }

        const viewer = await integration.kick.userManager.getViewerById(userId);

        if (!viewer) {
            return false;
        }

        const hasRole = viewer.twitchRoles.includes(value);

        switch (comparisonType) {
            case "include":
                return hasRole;
            case "doesn't include":
                return !hasRole;
            default:
                return false;
        }
    }
};
