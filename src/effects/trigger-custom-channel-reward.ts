import { Firebot } from "@crowbartools/firebot-custom-scripts-types";
import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { RestrictionData } from "@crowbartools/firebot-custom-scripts-types/types/modules/command-manager";
import { IntegrationConstants } from "../constants";
import { firebot } from "../main";
import { kickifyUserId, kickifyUsername } from "../internal/util";
import { JsonDB } from "node-json-db";
import { logger } from "../main";
declare const SCRIPTS_DIR: string; // Hack to get profile directory

type triggerCustomChannelRewardParams = {
    channelRewardId: string;
    selectionMode: 'select' | 'title';
}

interface ImageSet {
    url1x: string;
    url2x: string;
    url4x: string;
}

interface CustomReward {
    broadcasterId: string;
    broadcasterLogin: string;
    broadcasterName: string;
    id: string;
    title: string;
    prompt: string;
    cost: number;
    image?: ImageSet;
    defaultImage: ImageSet;
    backgroundColor: string;
    isEnabled: boolean;
    isUserInputRequired: boolean;
    maxPerStreamSetting: {
        isEnabled: boolean;
        maxPerStream: number;
    };
    maxPerUserPerStreamSetting: {
        isEnabled: boolean;
        maxPerUserPerStream: number;
    };
    globalCooldownSetting: {
        isEnabled: boolean;
        globalCooldownSeconds: number;
    };
    isPaused: boolean;
    isInStock: boolean;
    shouldRedemptionsSkipRequestQueue: boolean;
    redemptionsRedeemedCurrentStream?: number;
    cooldownExpiresAt?: Date;
}

type SavedChannelReward = {
    id: string,
    twitchData: CustomReward,
    manageable: boolean,
    effects?: Effects.EffectList,
    effectsFulfilled?: Effects.EffectList,
    effectsCanceled?: Effects.EffectList,
    restrictionData?: RestrictionData,
    autoApproveRedemptions?: boolean,
};

type RewardRedemptionMetadata = {
    username: string,
    userId: string,
    userDisplayName: string,
    messageText: string,
    redemptionId: string,
    rewardId: string,
    rewardImage: string,
    rewardName: string,
    rewardCost: number,
};

export const triggerCustomChannelRewardEffect: Firebot.EffectType<triggerCustomChannelRewardParams> = {
    definition: {
        id: `${IntegrationConstants.INTEGRATION_ID}:trigger-custom-channel-reward`,
        name: "Trigger Custom Channel Reward Handler",
        description: "Trigger the effects of a custom channel reward as if the user had redeemed it on Twitch. (Caution: No cooldowns are enforced!)",
        icon: "fad fa-comment-lines",
        categories: ["common"]
    },
    optionsTemplate: `
        <eos-container>
            <p class="muted">This will trigger the effects of a custom channel reward as if the user had redeemed it on Twitch. No cooldowns are enforced, so use with caution!</p>
        </eos-container>
        <eos-container header="Channel Reward" pad-top="true">
            <firebot-radios options="targetOptions" model="effect.selectionMode" />

            <firebot-searchable-select
                ng-model="effect.channelRewardId"
                items="manageableRewards"
                placeholder="Select or search for a channel reward..."
                ng-if="effect.selectionMode === 'select'"
            />
        </eos-container>
    `,
    optionsController: ($scope, channelRewardsService: any) => {
        if (!$scope.effect) {
            $scope.effect = {
                channelRewardId: "",
                selectionMode: 'select'
            };
        }

        if ($scope.effect.selectionMode === undefined) {
            $scope.effect.selectionMode = 'select';
        }

        $scope.targetOptions = {
            title: "Match Reward Title",
            select: "Select a channel reward"
        };

        $scope.manageableRewards = channelRewardsService
            .channelRewards.filter((r: SavedChannelReward) => r.manageable)
            .map((r: SavedChannelReward) => ({ id: r.twitchData.id, name: r.twitchData.title }));
    },
    optionsValidator: (effect) => {
        const errors = [];
        if (effect.selectionMode === 'select') {
            if (!effect.channelRewardId || effect.channelRewardId === "") {
                errors.push("Channel Reward ID is required when using 'Select' mode.");
            }
        } else if (effect.selectionMode !== 'title') {
            errors.push("Invalid selection mode. Must be 'select' or 'title'.");
        }
        return errors;
    },
    onTriggerEvent: async ({ effect, trigger }) => {
        const { effectRunner, JsonDb, path, restrictionManager } = firebot.modules;

        // This is terrible and I'm sorry. Firebot doesn't expose the channel
        // reward manager to scripts.
        const jsonDb = JsonDb as JsonDB;
        if (!jsonDb) {
            throw new Error("JsonDB module is not available.");
        }

        const customRewardsDbPath = path.join(SCRIPTS_DIR, '..', 'channel-rewards.json');
        let channelRewardsData: Record<string, SavedChannelReward> = {};
        try {
            const db = new JsonDB(customRewardsDbPath, false, false);
            db.load();
            channelRewardsData = db.getData("/") || {};
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error loading JsonDB at ${customRewardsDbPath}. Cannot trigger custom channel reward effects.`, error);
            return false;
        }

        const rewards = Object.values(channelRewardsData);
        let channelReward: SavedChannelReward | undefined;
        const rewardTitle = typeof trigger.metadata.eventData?.rewardName === "string" ? trigger.metadata.eventData.rewardName : "";

        if (effect.selectionMode === 'select') {
            channelReward = rewards.find((r: SavedChannelReward) => r.id === effect.channelRewardId);
        } else if (effect.selectionMode === 'title') {
            channelReward = rewards.find((r: SavedChannelReward) => r.twitchData.title.toLowerCase() === rewardTitle.toLowerCase());
        }

        if (!channelReward) {
            logger.error(`Channel reward with ID ${effect.channelRewardId} or title ${rewardTitle} not found.`);
            return false;
        }

        if (!channelReward.effects) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Channel reward ${channelReward.twitchData.title} has no effects to trigger.`);
            return true;
        }

        const metadata: RewardRedemptionMetadata = {
            username: kickifyUsername(trigger.metadata.username),
            userId: kickifyUserId(
                typeof trigger.metadata.eventData?.userId === "string" || typeof trigger.metadata.eventData?.userId === "number"
                    ? trigger.metadata.eventData.userId
                    : ""
            ),
            userDisplayName: typeof trigger.metadata.eventData?.userDisplayName === "string"
                ? trigger.metadata.eventData.userDisplayName
                : trigger.metadata.username,
            messageText: typeof trigger.metadata.eventData?.messageText === "string"
                ? trigger.metadata.eventData.messageText
                : "",
            redemptionId: typeof trigger.metadata.eventData?.redemptionId === "string"
                ? trigger.metadata.eventData.redemptionId
                : crypto.randomUUID(), // Generate a unique ID if not provided
            rewardId: channelReward.id,
            rewardImage: channelReward.twitchData.image?.url1x || channelReward.twitchData.defaultImage.url1x,
            rewardName: channelReward.twitchData.title,
            rewardCost: channelReward.twitchData.cost || 0
        };

        const restrictionData = channelReward.restrictionData;
        if (restrictionData) {
            try {
                await restrictionManager.runRestrictionPredicates(trigger, restrictionData, false);
                logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Restrictions passed for user ${metadata.username} (${metadata.userId}) on reward ${channelReward.twitchData.title}`);
            } catch (restrictionReason) {
                let reason;
                if (Array.isArray(restrictionReason)) {
                    reason = restrictionReason.join(", ");
                } else {
                    reason = restrictionReason;
                }
                logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Restrictions failed for user ${metadata.username} (${metadata.userId}) on reward ${channelReward.twitchData.title}: ${reason}`);
                return false;
            }
        }

        const processEffectsRequest = {
            trigger: {
                type: trigger.type,
                metadata: metadata
            },
            effects: channelReward.effects || []
        };

        try {
            await effectRunner.processEffects(processEffectsRequest);
        } catch (reason) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error when running effects for ${metadata.redemptionId}: ${reason}`);
            return false;
        }

        // If we reach here, it means the effects were successfully triggered.
        logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Successfully triggered effects for channel reward ${channelReward.twitchData.title} (ID: ${channelReward.id}) for user ${metadata.username} (${metadata.userId})`);
        return true;
    }
};
