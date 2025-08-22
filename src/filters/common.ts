import { logger } from "../main";

export enum ComparisonType {
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
    DOESNT_MATCH_REGEX = "doesn't match regex",
    LESS_THAN = "less than",
    LESS_THAN_OR_EQUAL_TO = "less than or equal to",
    GREATER_THAN = "greater than",
    GREATER_THAN_OR_EQUAL_TO = "greater than or equal to"
}

export function compareValue(
    filterName: string,
    comparisonType: ComparisonType,
    expectedValue: string | number | boolean | RegExp,
    actualValue: string | number | boolean
): boolean {
    logger.debug(`${filterName}: Comparing values: type=${comparisonType}, expected='${expectedValue}', actual='${actualValue}'`);
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
        case ComparisonType.LESS_THAN: {
            const expectedNum = Number(expectedValue);
            const actualNum = Number(actualValue);
            return actualNum < expectedNum;
        }
        case ComparisonType.LESS_THAN_OR_EQUAL_TO: {
            const expectedNum = Number(expectedValue);
            const actualNum = Number(actualValue);
            return actualNum <= expectedNum;
        }
        case ComparisonType.GREATER_THAN: {
            const expectedNum = Number(expectedValue);
            const actualNum = Number(actualValue);
            return actualNum > expectedNum;
        }
        case ComparisonType.GREATER_THAN_OR_EQUAL_TO: {
            const expectedNum = Number(expectedValue);
            const actualNum = Number(actualValue);
            return actualNum >= expectedNum;
        }
        default:
            return false;
    }
}
