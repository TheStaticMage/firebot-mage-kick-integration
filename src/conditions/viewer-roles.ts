import { ConditionType } from "@crowbartools/firebot-custom-scripts-types/types/modules/condition-manager";
import { IntegrationConstants } from "../constants";
import { integration } from "../integration-singleton";
import { logger } from "../main";
import { detectPlatform } from '@thestaticmage/mage-platform-lib-client';

export const viewerRolesCondition: ConditionType<any, any, any> = {
    id: `${IntegrationConstants.INTEGRATION_ID}:viewerroles`,
    name: "Platform Aware Viewer Roles",
    description: "Condition based on a given viewer role (compatible with Kick and Twitch)",
    comparisonTypes: ["has role", "doesn't have role"],
    leftSideValueType: "text",
    leftSideTextPlaceholder: "Enter username",
    rightSideValueType: "preset",
    getRightSidePresetValues: (viewerRolesService: any) => {
        return [
            { value: "broadcaster", display: "Broadcaster [Platform Aware]" },
            { value: "bot", display: "Stream Bot [Platform Aware]" },
            { value: "mod", display: "Moderator [Platform Aware]" },
            { value: "vip", display: "VIP [Platform Aware]" },
            { value: "sub", display: "Subscriber [Platform Aware]" }
        ].concat(viewerRolesService.getCustomRoles()
            .map((r: { id: any; name: any; }) => ({
                value: r.id,
                display: r.name
            })));
    },
    valueIsStillValid: (condition, viewerRolesService: any) => {
        if (typeof condition.rightSideValue === "string" && condition.rightSideValue.length === 36) {
            return viewerRolesService.getCustomRoles()
                .some((r: { id: any; name: any; }) => r.id === condition.rightSideValue);
        }
        return true;
    },
    getRightSideValueDisplay: (condition, viewerRolesService: any) => {
        const v = [
            { value: "broadcaster", display: "Broadcaster [Platform Aware]" },
            { value: "bot", display: "Stream Bot [Platform Aware]" },
            { value: "mod", display: "Moderator [Platform Aware]" },
            { value: "vip", display: "VIP [Platform Aware]" },
            { value: "sub", display: "Subscriber [Platform Aware]" }
        ].concat(viewerRolesService.getCustomRoles()
            .map((r: { id: any; name: any; }) => ({
                value: r.id,
                display: r.name
            })));

        const preset = v.find(vv => vv.value === condition.rightSideValue);
        if (preset) {
            return String(preset.display);
        }
        return String(condition.rightSideValue);
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
            platform = detectPlatform(trigger);
        } catch (error) {
            logger.error(`viewerroles condition: Error evaluating platform: ${error}`);
            platform = "";
        }

        // Call the role manager to check if the user has the role
        const hasRole = await integration.kick.roleManager.userHasRole(platform, userNameOrId, String(rightSideValue));
        if (hasRole) {
            logger.debug(`viewerroles condition: Viewer ${userNameOrId} (${platform}) has role ${rightSideValue}`);
        } else {
            logger.debug(`viewerroles condition: Viewer ${userNameOrId} (${platform}) does NOT have role ${rightSideValue}`);
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
