import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";

enum ComparisonType {
    IS = "is",
    IS_NOT = "is not",
    LESS_THAN = "less than",
    LESS_THAN_OR_EQUAL_TO = "less than or equal to",
    GREATER_THAN = "greater than",
    GREATER_THAN_OR_EQUAL_TO = "greater than or equal to"
}

export const hostViewerCountFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:host-viewer-count`,
    name: "Host Viewer Count",
    description: "Filter by how many viewers have been brought by the host.",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "raid" }
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
        eventData: {
            eventMeta: {
                viewerCount?: number;
            }
        }
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const viewerCount = eventData.eventMeta.viewerCount || 0;
        return compareValue(comparisonType as ComparisonType, value, viewerCount);
    }
};

function compareValue(
    comparisonType: ComparisonType,
    expectedValue: unknown,
    actualValue: unknown
): boolean {
    logger.debug(`Comparing values: type=${comparisonType}, expected='${expectedValue}', actual='${actualValue}'`);
    const expectedNum = Number(expectedValue);
    const actualNum = Number(actualValue);

    switch (comparisonType) {
        case ComparisonType.IS:
            return actualNum === expectedNum;
        case ComparisonType.IS_NOT:
            return actualNum !== expectedNum;
        case ComparisonType.LESS_THAN:
            return actualNum < expectedNum;
        case ComparisonType.LESS_THAN_OR_EQUAL_TO:
            return actualNum <= expectedNum;
        case ComparisonType.GREATER_THAN:
            return actualNum > expectedNum;
        case ComparisonType.GREATER_THAN_OR_EQUAL_TO:
            return actualNum >= expectedNum;
        default:
            return false;
    }
}
