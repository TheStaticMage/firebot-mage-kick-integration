import { EventData, EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { ComparisonType, compareValue } from "./common";

export const hostViewerCountFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:host-viewer-count`,
    name: "Host Viewer Count",
    description: "Filter by how many viewers have been brought by the host.",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "raid" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "raid-sent-off" }
    ],
    comparisonTypes: [
        ComparisonType.IS,
        ComparisonType.IS_NOT,
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
        const viewerCountNumber = Number(eventData.eventMeta.viewerCount);
        const viewerCount = isNaN(viewerCountNumber) ? 0 : viewerCountNumber;
        return compareValue("hostViewerCountFilter", comparisonType as ComparisonType, value, viewerCount);
    }
};
