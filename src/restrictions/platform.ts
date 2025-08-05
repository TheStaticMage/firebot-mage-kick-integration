import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { IntegrationConstants } from "../constants";
import { ChatManager } from "../internal/chat-manager";

export const platformRestriction = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:trigger-platform`,
        name: "Platform",
        description: "Restricts the command based on the platform triggering the event.",
        triggers: []
    },
    optionsTemplate: `
        <div id="platformComparison" class="modal-subheader" style="padding: 0 0 4px 0">
            Comparison
        </div>
        <div>
            <select class="fb-select" ng-model="restriction.comparison">
                <option label="Is" value="is">Is</option>
                <option label="Is Not" value="isNot">Is Not</option>
            </select>
        </div>
        <div id="platformPlatform" class="modal-subheader" style="padding: 0 0 4px 0">
            Platform
        </div>
        <div>
            <select class="fb-select" ng-model="restriction.platform">
                <option label="Any" value="any">Any</option>
                <option label="Kick" value="kick">Kick</option>
                <option label="Twitch" value="twitch">Twitch</option>
                <option label="Unknown" value="unknown">Unknown</option>
            </select>
        </div>
    `,
    optionsController: ($scope: any) => {
        if (!$scope.restriction) {
            $scope.restriction = {
                comparison: "is",
                platform: "any"
            };
        }
        if (!$scope.restriction.comparison) {
            $scope.restriction.comparison = "is";
        }
        if (!$scope.restriction.platform) {
            $scope.restriction.platform = "any";
        }
    },
    optionsValueDisplay: (restriction: any) => {
        const comparison = restriction.comparison;
        const platform = restriction.platform;

        if (comparison == null || platform == null) {
            return "";
        }

        let platformDisplay: string;
        switch (platform) {
            case "twitch":
                platformDisplay = "Twitch";
                break;
            case "kick":
                platformDisplay = "Kick";
                break;
            case "unknown":
                platformDisplay = "Unknown";
                break;
            default:
                platformDisplay = "Kick or Twitch";
                break;
        }
        return `Platform ${comparison === "is" ? "is" : "is not"} ${platformDisplay}`;
    },
    predicate: (triggerData: Effects.Trigger, { comparison, platform }: { comparison: string, platform: string }): Promise<boolean> => {
        return new Promise((resolve, reject) => {
            const currentPlatform = ChatManager.getPlatformFromTrigger(triggerData);
            if (comparison === "is" && currentPlatform === platform) {
                resolve(true);
            }
            if (comparison === "is" && currentPlatform !== "" && platform === "any") {
                resolve(true);
            }
            if (comparison === "is" && currentPlatform === "" && platform === "unknown") {
                resolve(true);
            }
            if (comparison === "isNot" && currentPlatform !== "" && platform === "unknown") {
                resolve(true);
            }
            if (comparison === "isNot" && currentPlatform === "" && platform === "any") {
                resolve(true);
            }
            if (comparison === "isNot" && currentPlatform !== platform) {
                resolve(true);
            }

            reject(new Error(`Platform restriction failed: currentPlatform=${currentPlatform}, comparison=${comparison}, platform=${platform}`));
        });
    }
};
