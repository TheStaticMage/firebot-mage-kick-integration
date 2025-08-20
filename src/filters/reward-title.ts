import { EventFilter } from "@crowbartools/firebot-custom-scripts-types/types/modules/event-filter-manager";
import { IntegrationConstants } from "../constants";
import { logger } from "../main";

enum ComparisonType {
    IS = "is",
    IS_NOT = "is not",
    CONTAINS = "contains",
    DOESNT_CONTAIN = "doesn't contain",
    DOESNT_STARTS_WITH = "doesn't start with",
    STARTS_WITH = "starts with",
    DOESNT_END_WITH = "doesn't end with",
    ENDS_WITH = "ends with",
    MATCHES_REGEX_CS = "matches regex (case-sensitive)",
    DOESNT_MATCH_REGEX_CS = "doesn't match regex (case-sensitive)",
    MATCHES_REGEX = "matches regex",
    DOESNT_MATCH_REGEX = "doesn't match regex"
}

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
        return compareValue(comparisonType as ComparisonType, value, rewardName);
    }
};

function compareValue(
    comparisonType: ComparisonType,
    expectedValue: unknown,
    actualValue: unknown
): boolean {
    logger.debug(`Comparing values: type=${comparisonType}, expected='${expectedValue}', actual='${actualValue}'`);
    switch (comparisonType) {
        case ComparisonType.IS:
            return actualValue === expectedValue;
        case ComparisonType.IS_NOT:
            return actualValue !== expectedValue;
        case ComparisonType.CONTAINS:
            return actualValue?.toString().includes(expectedValue?.toString() ?? "") || false;
        case ComparisonType.DOESNT_CONTAIN:
            return !actualValue?.toString().includes(expectedValue?.toString() ?? "");
        case ComparisonType.STARTS_WITH:
            return actualValue?.toString().startsWith(expectedValue?.toString() ?? "") || false;
        case ComparisonType.DOESNT_STARTS_WITH:
            return !actualValue?.toString().startsWith(expectedValue?.toString() ?? "");
        case ComparisonType.ENDS_WITH:
            return actualValue?.toString().endsWith(expectedValue?.toString() ?? "") || false;
        case ComparisonType.DOESNT_END_WITH:
            return !actualValue?.toString().endsWith(expectedValue?.toString() ?? "");
        case ComparisonType.MATCHES_REGEX: {
            const regex = new RegExp(expectedValue?.toString() ?? "", "gi");
            return regex.test(actualValue?.toString() ?? "");
        }
        case ComparisonType.DOESNT_MATCH_REGEX: {
            const regex = new RegExp(expectedValue?.toString() ?? "", "gi");
            return !regex.test(actualValue?.toString() ?? "");
        }
        case ComparisonType.MATCHES_REGEX_CS: {
            const regex = new RegExp(expectedValue?.toString() ?? "", "g");
            return regex.test(actualValue?.toString() ?? "");
        }
        case ComparisonType.DOESNT_MATCH_REGEX_CS: {
            const regex = new RegExp(expectedValue?.toString() ?? "", "g");
            return !regex.test(actualValue?.toString() ?? "");
        }
        default:
            return false;
    }
}
