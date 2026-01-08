import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { reflectEvent } from "../internal/reflector";
import { logger } from "../main";

type StringUpdatable = { update: boolean; newValue: string };
type BooleanUpdatable = { update: boolean; newValue: boolean | string };

type rewardManagementParams = {
    rewardId: string;
    action: "manage" | "unmanage";
    rewardName?: string;
    rewardSettings: {
        cost: StringUpdatable;
        skipQueue: BooleanUpdatable;
    };
}

export const rewardManageEffect: Firebot.EffectType<rewardManagementParams> = {
    definition: {
        id: "mage-kick-integration:reward-manage",
        name: "Manage Kick Reward",
        description: "Manage or unmanage a Firebot reward in Kick.",
        icon: "fas fa-sync",
        categories: ["integrations"],
        dependencies: []
    },
    optionsTemplate: `
    <eos-container header="Reward">
        <firebot-searchable-select
            ng-model="effect.rewardId"
            items="rewardOptions"
            placeholder="Select a reward"
            no-choice-text="No Firebot rewards found"
        />
    </eos-container>

    <eos-container header="Action" pad-top="true">
        <firebot-radios
            options="actionOptions"
            model="effect.action"
            inline="true">
        </firebot-radios>
    </eos-container>

    <eos-container ng-show="showRewardSettings()" header="Reward Settings" pad-top="true">

        <firebot-checkbox
            label="Update Cost"
            model="effect.rewardSettings.cost.update"
            aria-label="Update cost"
        />
        <div ng-show="effect.rewardSettings.cost.update" style="margin-bottom: 15px;">
            <firebot-input model="effect.rewardSettings.cost.newValue" placeholder-text="Enter new cost" />
        </div>

        <firebot-checkbox
            label="Update Skip Queue"
            model="effect.rewardSettings.skipQueue.update"
            aria-label="Update skip queue"
        />
        <div ng-show="effect.rewardSettings.skipQueue.update" style="margin-bottom: 15px;">
            <firebot-select
                selected="effect.rewardSettings.skipQueue.newValue"
                options="skipQueueOptions"
            />
        </div>

    </eos-container>
    `,
    optionsController: ($scope: any, backendCommunicator: any) => {
        $scope.rewardOptions = [] as { id: string; name: string }[];
        $scope.actionOptions = {
            manage: "Manage (Create/Update on Kick)",
            unmanage: "Unmanage (Remove from Kick)"
        };

        $scope.enabledOptions = {
            true: "Enabled",
            false: "Disabled"
        };

        $scope.skipQueueOptions = {
            true: "Skip request queue",
            false: "Do not skip request queue"
        };

        $scope.effect.action ??= "manage";

        const loadRewards = () => {
            const rewards = backendCommunicator.fireEventSync("get-channel-rewards", {});
            if (Array.isArray(rewards)) {
                $scope.rewardOptions = rewards
                    .filter((r: any) => r.manageable)
                    .map((r: any) => ({
                        id: r.id,
                        name: r.twitchData?.title || "Unknown Reward"
                    }));
            } else {
                $scope.rewardOptions = [];
            }
        };

        const setRewardName = () => {
            if (!$scope.effect.rewardId) {
                $scope.effect.rewardName = undefined;
                return;
            }
            const match = ($scope.rewardOptions as { id: string; name: string }[])
                .find(reward => reward.id === $scope.effect.rewardId);
            $scope.effect.rewardName = match?.name || undefined;
        };

        $scope.$watch("effect.rewardId", () => {
            setRewardName();
        });

        $scope.showRewardSettings = () => (
            $scope.effect.action === "manage" &&
            $scope.effect.rewardId != null &&
            $scope.effect.rewardId !== ""
        );

        if ($scope.effect.rewardSettings == null) {
            $scope.effect.rewardSettings = {
                cost: {
                    update: false,
                    newValue: "1"
                },
                enabled: {
                    update: false,
                    newValue: true
                },
                skipQueue: {
                    update: false,
                    newValue: false
                }
            };
        }

        loadRewards();
        setRewardName();
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (!effect.rewardId) {
            errors.push("You must select a reward.");
        }
        if (!effect.action) {
            errors.push("You must select an action.");
        }
        if (effect.action === "manage" &&
            !effect.rewardSettings.cost.update &&
            !effect.rewardSettings.skipQueue.update
        ) {
            errors.push("Please select at least one property to update.");
        }
        if (effect.rewardSettings.cost.update &&
            (effect.rewardSettings.cost.newValue == null ||
            effect.rewardSettings.cost.newValue === "")
        ) {
            errors.push("Please provide a new cost for the reward.");
        }
        return errors;
    },
    getDefaultLabel: (effect) => {
        if (!effect.rewardId || !effect.action) {
            return "";
        }

        if (effect.action === "unmanage") {
            const rewardName = effect.rewardName || effect.rewardId;
            return `Unmanage ${rewardName}`;
        }

        if (!effect.rewardSettings?.cost.update &&
            !effect.rewardSettings?.skipQueue.update) {
            return "";
        }

        const rewardName = effect.rewardName || effect.rewardId;
        let action = "";

        if (effect.rewardSettings.cost.update) {
            action = `Set Cost to ${effect.rewardSettings.cost.newValue} for`;
        } else if (effect.rewardSettings.skipQueue.update) {
            action = effect.rewardSettings.skipQueue.newValue ? "Enable Skip Queue for" : "Disable Skip Queue for";
        }

        return `${action} ${rewardName}`;
    },
    onTriggerEvent: async ({ effect }) => {
        const state = integration.getKickRewardsState();

        if (effect.action === "unmanage") {
            const managementData = state.getManagementData(effect.rewardId);
            if (!managementData || !managementData.managedOnKick || !managementData.kickRewardId) {
                // Already unmanaged, considered success?
                return true;
            }

            const success = await integration.kick.rewardsManager.deleteReward(managementData.kickRewardId);
            if (success) {
                state.removeManagementData(effect.rewardId);
                return true;
            }
            return false;
        }
        // Manage reward on Kick
        const getTotalKickRewards = async () => {
            const rewards = await integration.kick.rewardsManager.getAllRewards();
            return rewards?.length || 0;
        };

        if (!(await state.canManageMore(getTotalKickRewards))) {
            // Check if already managed, if so, update is fine
            const existing = state.getManagementData(effect.rewardId);
            if (!existing || !existing.managedOnKick) {
                logger.error("Cannot manage reward: Kick limit of 15 rewards reached.");
                return false;
            }
        }

        const allRewards = await reflectEvent<any[]>("get-channel-rewards", {});
        const firebotReward = allRewards?.find((r: any) => r.id === effect.rewardId);
        if (!firebotReward) {
            logger.error(`Cannot manage reward ${effect.rewardId}: Firebot reward not found.`);
            return false;
        }

        if (!effect.rewardSettings.cost.update &&
            !effect.rewardSettings.skipQueue.update) {
            logger.error("Manage Kick Reward: No updates selected. Skipping effect.");
            return false;
        }

        if (effect.rewardSettings.cost.update &&
            (effect.rewardSettings.cost.newValue == null ||
            isNaN(parseInt(effect.rewardSettings.cost.newValue)) ||
            parseInt(effect.rewardSettings.cost.newValue) < 1)) {
            logger.error("Manage Kick Reward: Invalid Cost.");
            return false;
        }

        const overrides: any = {
            cost: effect.rewardSettings.cost.update ?
                parseInt(effect.rewardSettings.cost.newValue) :
                firebotReward.cost,
            skipQueue: effect.rewardSettings.skipQueue.update ?
                (effect.rewardSettings.skipQueue.newValue === true || effect.rewardSettings.skipQueue.newValue === "true") :
                firebotReward.shouldRedemptionsSkipRequestQueue ?? false
        };

        // Check if already managed on Kick
        const existing = state.getManagementData(effect.rewardId);

        if (existing && existing.managedOnKick && existing.kickRewardId) {
            // Update
            const success = await integration.kick.rewardsManager.updateReward(existing.kickRewardId, firebotReward, overrides);
            if (success) {
                existing.overrides = overrides;
                existing.firebotRewardTitle = firebotReward.title;
                state.setManagementData(effect.rewardId, existing);
                return true;
            }
        } else {
            // Create
            const newReward = await integration.kick.rewardsManager.createReward(firebotReward, overrides);
            if (newReward) {
                const managementData = {
                    managedOnKick: true,
                    kickRewardId: newReward.id,
                    firebotRewardTitle: firebotReward.title,
                    overrides: overrides
                };
                state.setManagementData(effect.rewardId, managementData);
                return true;
            }
        }
        return false;

    }
};
