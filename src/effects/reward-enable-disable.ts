import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { integration } from "../integration";
import { logger } from "../main";
import { reflectEvent } from "../internal/reflector";

type rewardEnableDisableParams = {
    rewardId: string;
    action: "enable" | "disable";
    rewardName?: string;
}

type ManagedRewardOption = {
    id: string;
    name: string;
};

export const rewardEnableDisableEffect: Firebot.EffectType<rewardEnableDisableParams> = {
    definition: {
        id: "mage-kick-integration:reward-enable-disable",
        name: "Kick Reward Enable/Disable",
        description: "Enable or disable a managed Kick channel reward.",
        icon: "fas fa-gift",
        categories: ["integrations"],
        dependencies: []
    },
    optionsTemplate: `
    <eos-container header="Reward">
        <firebot-searchable-select
            ng-model="effect.rewardId"
            items="managedRewardOptions"
            placeholder="Select a managed reward"
            no-choice-text="No managed Kick rewards found"
        />
    </eos-container>

    <eos-container header="Action" pad-top="true">
        <firebot-radios
            options="actionOptions"
            model="effect.action"
            inline="true">
        </firebot-radios>
    </eos-container>
    `,
    optionsController: ($scope: any, backendCommunicator: any) => {
        $scope.managedRewardOptions = [] as ManagedRewardOption[];
        $scope.actionOptions = {
            enable: "Enable",
            disable: "Disable"
        };

        $scope.effect.action ??= "enable";

        const loadRewards = () => {
            const state = backendCommunicator.fireEventSync("kick:get-reward-management-state", {});
            if (state) {
                $scope.managedRewardOptions = Object.entries(state)
                    .filter(([, val]) => (val as any).managedOnKick)
                    .map(([id, val]) => ({
                        id,
                        name: (val as any).firebotRewardTitle || "Unknown Reward"
                    }));
            } else {
                $scope.managedRewardOptions = [];
            }
        };

        const setRewardName = () => {
            if (!$scope.effect.rewardId) {
                $scope.effect.rewardName = undefined;
                return;
            }
            const match = ($scope.managedRewardOptions as ManagedRewardOption[])
                .find((reward: ManagedRewardOption) => reward.id === $scope.effect.rewardId);
            $scope.effect.rewardName = match?.name || undefined;
        };

        $scope.$watch("effect.rewardId", () => {
            setRewardName();
        });

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
        return errors;
    },
    getDefaultLabel: (effect) => {
        if (!effect.rewardId || !effect.action) {
            return "";
        }

        const rewardName = effect.rewardName || effect.rewardId;

        return `${effect.action === "enable" ? "Enable" : "Disable"} ${rewardName}`;
    },
    onTriggerEvent: async ({ effect }) => {
        const state = integration.getKickRewardsState();
        const managementData = state.getManagementData(effect.rewardId);

        if (!managementData || !managementData.managedOnKick || !managementData.kickRewardId) {
            logger.error(`Cannot ${effect.action} reward ${effect.rewardId}: It is not managed in Kick.`);
            return false;
        }

        // Fetch Firebot reward to get current base values
        logger.debug(`Fetching Firebot reward data for reward ID: ${effect.rewardId}`);
        const allRewards = await reflectEvent<any[]>("get-channel-rewards", {});
        const firebotReward = allRewards?.find((r: any) => r.id === effect.rewardId);
        logger.debug(`Received Firebot reward data: ${JSON.stringify(firebotReward)}`);

        if (!firebotReward) {
            logger.error(`Cannot ${effect.action} reward ${effect.rewardId}: Firebot reward not found.`);
            return false;
        }

        const isEnabled = effect.action === "enable";

        // Update overrides in state
        const overrides = managementData.overrides || {};
        overrides.enabled = isEnabled;

        // Perform update on Kick
        const success = await integration.kick.rewardsManager.updateReward(
            managementData.kickRewardId,
            firebotReward,
            overrides
        );

        if (success) {
            managementData.overrides = overrides;
            state.setManagementData(effect.rewardId, managementData);
            return true;
        }
        return false;

    }
};
