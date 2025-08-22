import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { ComparisonType, compareValue } from "./common";

export const rewardTitleFilter: EventFilter = {
    id: `${IntegrationConstants.INTEGRATION_ID}:reward-title`,
    name: "Reward Title",
    description: "Checks if the reward title equals or matches the provided value. Comparisons are case-insensitive.",
    events: [
        { eventSourceId: IntegrationConstants.INTEGRATION_ID, eventId: "channel-reward-redemption" }
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
        eventData: {
            eventMeta: {
                rewardName?: string;
            }
        }
    ): Promise<boolean> => {
        const { comparisonType, value } = filterSettings;
        const rewardName = eventData.eventMeta.rewardName || "";
        return compareValue("rewardTitleFilter", comparisonType as ComparisonType, value, rewardName);
    }
};
