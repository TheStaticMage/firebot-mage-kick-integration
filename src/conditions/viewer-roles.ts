import { ConditionType } from "@crowbartools/firebot-custom-scripts-types/types/modules/condition-manager";
import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";
import { kickifyUserId, unkickifyUserId, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { platformVariable } from "../variables/platform";

export const viewerRolesCondition: ConditionType<any, any, any> = {
    id: `${IntegrationConstants.INTEGRATION_ID}:viewerroles`,
    name: "Platform Aware Viewer Roles",
    description: "Condition based on a given viewer role (compatible with Kick and Twitch)",
    comparisonTypes: ["has role", "doesn't have role"],
    leftSideValueType: "text",
    leftSideTextPlaceholder: "Enter username",
    rightSideValueType: "preset",
    getRightSidePresetValues: (viewerRolesService: any) => {
        return viewerRolesService.getAllRoles()
            .map((r: { id: any; name: any; }) => ({
                value: r.id,
                display: r.name
            }));
    },
    valueIsStillValid: (condition, viewerRolesService: any) => {
        const role = viewerRolesService.getAllRoles()
            .find((r: { id: string | number; }) => r.id === condition.rightSideValue);

        return role != null && role.name != null;
    },
    getRightSideValueDisplay: (condition, viewerRolesService: any) => {
        const role = viewerRolesService.getAllRoles()
            .find((r: { id: string | number; }) => r.id === condition.rightSideValue);
        if (role && role.name != null) {
            return `${role.name} [Platform Aware]`;
        }
        return `${String(condition.rightSideValue)} [Platform Aware]`;
    },
    predicate: async (conditionSettings, trigger) => {
        const { comparisonType, leftSideValue, rightSideValue } = conditionSettings;

        let userNameOrId = leftSideValue;
        if ((userNameOrId == null || userNameOrId === "")) {
            userNameOrId = trigger.metadata.username;
        }

        // Determine platform from trigger metadata if possible
        let platform = "";
        try {
            platform = platformVariable.evaluator(trigger);
        } catch (error) {
            logger.error(`viewerroles condition: Error evaluating platform variable: ${error}`);
            platform = "";
        }

        // Attempt to guess platform if not provided
        if (platform === "unknown" || platform === "") {
            if (typeof userNameOrId === "string" && isNaN(Number(unkickifyUserId(userNameOrId))) && unkickifyUsername(userNameOrId) !== userNameOrId) {
                platform = "kick";
            } else if (typeof userNameOrId === "string" && !isNaN(Number(unkickifyUserId(userNameOrId))) && unkickifyUserId(userNameOrId) !== userNameOrId) {
                platform = "kick";
            } else {
                platform = "twitch";
            }
        }

        logger.debug(`viewerroles condition: Checking viewer roles condition for: ${userNameOrId} for role ${rightSideValue} with comparison ${comparisonType} on platform ${platform}`);
        let userId = "";
        let viewer: FirebotViewer | undefined;

        try {
            if (platform === "kick") {
                if (typeof userNameOrId === "string" && isNaN(Number(unkickifyUserId(userNameOrId)))) {
                    logger.debug(`viewerroles condition: Looking up Kick viewer by username: ${userNameOrId}`);
                    viewer = await integration.kick.userManager.getViewerByUsername(userNameOrId);
                } else {
                    logger.debug(`viewerroles condition: Looking up Kick viewer by userId: ${userNameOrId}`);
                    viewer = await integration.kick.userManager.getViewerById(unkickifyUserId(userNameOrId));
                }
                if (viewer) {
                    userId = kickifyUserId(viewer._id);
                }
            } else {
                const { viewerDatabase } = firebot.modules;
                if (typeof userNameOrId === "string" && isNaN(Number(userNameOrId))) {
                    logger.debug(`viewerroles condition: Looking up Twitch viewer by username: ${userNameOrId}`);
                    viewer = await viewerDatabase.getViewerByUsername(userNameOrId);
                } else {
                    logger.debug(`viewerroles condition: Looking up Twitch viewer by userId: ${userNameOrId}`);
                    viewer = await viewerDatabase.getViewerById(unkickifyUserId(userNameOrId));
                }
                if (viewer) {
                    userId = viewer._id;
                }
            }
        } catch (error) {
            logger.error(`viewerroles condition: Error looking up viewer ${userNameOrId} on platform ${platform}: ${error}`);
            return false;
        }

        if (!viewer || !userId) {
            logger.warn(`viewerroles condition: No Twitch viewer found for: ${userNameOrId} on platform ${platform}`);
            return false;
        }

        let hasRole = false;

        if (typeof rightSideValue === "string" && rightSideValue.length === 36) { // Custom roles are UUIDs whereas built-in roles are simple strings
            try {
                const { customRolesManager } = firebot.modules;
                hasRole = customRolesManager.userIsInRole(userId, [], [rightSideValue]);
                logger.debug(`viewerroles condition: Checking custom role ${rightSideValue} for user ${userId} (${platform}), result=${hasRole}`);
            } catch (error) {
                logger.error(`viewerroles condition: Error checking custom role ${rightSideValue} for user ${userId} (${platform}): ${error}`);
                return false;
            }
        } else {
            hasRole = viewer?.twitchRoles.includes(String(rightSideValue));
            logger.debug(`viewerroles condition: Checking Twitch role ${rightSideValue} for user ${userId} (${platform}), roles: ${viewer?.twitchRoles.join(", ")}, result=${hasRole}`);
        }

        if (hasRole) {
            logger.debug(`viewerroles condition: Viewer ${userNameOrId} (${platform}) has role ${rightSideValue}`);
        } else {
            logger.debug(`viewerroles condition: Viewer ${userNameOrId} (${platform}) does NOT have role ${rightSideValue} (roles: ${viewer?.twitchRoles.join(", ")})`);
        }

        switch (comparisonType) {
            case "include":
            case "is in role":
            case "has role":
                return hasRole;
            case "doesn't include":
            case "isn't in role":
            case "doesn't have role":
                return !hasRole;
            default:
                logger.warn(`viewerroles condition: Unknown comparison type: ${comparisonType}`);
                return false;
        }
    }
};
