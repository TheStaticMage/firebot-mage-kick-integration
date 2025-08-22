import { EventData, EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { unkickifyUsername } from "../internal/util";
import { ComparisonType, compareValue } from "./common";

export const usernameFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:username`,
    name: "Username",
    description: "Checks if the username equals or matches the provided value. Comparisons are case-insensitive. This removes the '@kick' suffix.",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "chat-message" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "follow" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "viewer-arrived" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "banned" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "timeout" },
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "raid" }
    ],
    comparisonTypes: [
        ComparisonType.IS,
        ComparisonType.IS_NOT,
        ComparisonType.CONTAINS,
        ComparisonType.DOESNT_CONTAIN,
        ComparisonType.STARTS_WITH,
        ComparisonType.DOESNT_STARTS_WITH,
        ComparisonType.ENDS_WITH,
        ComparisonType.DOESNT_END_WITH,
        ComparisonType.MATCHES_REGEX_CS,
        ComparisonType.DOESNT_MATCH_REGEX_CS,
        ComparisonType.MATCHES_REGEX,
        ComparisonType.DOESNT_MATCH_REGEX
    ],
    valueType: "text",
    predicate: async (
        filterSettings,
        eventData: EventData
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const username = unkickifyUsername(typeof eventData.eventMeta.username === "string" ? eventData.eventMeta.username : "");
        return compareValue("usernameFilter", comparisonType as ComparisonType, unkickifyUsername(value), username);
    }
};
