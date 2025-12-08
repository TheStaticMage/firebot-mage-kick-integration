import { ChannelRewardRedemptionEvent } from "kick-api-types/v1";
import { Effects } from "@crowbartools/firebot-custom-scripts-types/types/effects";
import { RestrictionData } from "@crowbartools/firebot-custom-scripts-types/types/modules/command-manager";
import type { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { JsonDB } from "node-json-db";
import { integration } from "../../integration-singleton";
import { firebot, logger } from "../../main";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../util";

declare const SCRIPTS_DIR: string;

type RewardRedemptionMetadata = Trigger["metadata"] & {
    username: string;
    userId: string;
    userDisplayName: string;
    messageText: string;
    args: string[];
    redemptionId: string;
    rewardId: string;
    rewardImage: string;
    rewardName: string;
    rewardDescription: string;
    rewardCost: number;
    platform: string;
};

interface SavedChannelReward {
    id: string;
    twitchData: {
        id: string;
        title: string;
        cost: number;
        image?: { url1x: string };
        defaultImage: { url1x: string };
        isEnabled?: boolean;
        isPaused?: boolean;
    };
    manageable: boolean;
    effects?: Effects.EffectList;
    restrictionData?: RestrictionData;
}

export class RewardRedemptionHandler {
    public async handleRewardRedemptionEvent(event: ChannelRewardRedemptionEvent): Promise<void> {
        const { effectRunner, frontendCommunicator, JsonDb, path, restrictionManager } = firebot.modules;
        const kickRewardId = event.reward.id;

        const managementState = integration.getKickRewardsState().getAllManagementData();
        const firebotRewardEntry = Object.entries(managementState).find(
            ([, data]) => data.kickRewardId === kickRewardId
        );

        if (!firebotRewardEntry) {
            logger.debug(`Reward redemption webhook received for unknown/unmanaged reward ID: ${kickRewardId}. Ignoring.`);
            return;
        }

        const [firebotRewardId, managementData] = firebotRewardEntry;

        if (managementData.overrides?.enabled === false) {
            logger.debug(`Reward redemption webhook received for disabled reward: ${event.reward.title}. Ignoring.`);
            return;
        }

        logger.debug(`Handling reward redemption for synced reward: ${event.reward.title} (Firebot ID: ${firebotRewardId})`);

        frontendCommunicator.send("twitch:chat:rewardredemption", {
            id: event.id,
            queued: false,
            messageText: event.user_input || "",
            user: {
                id: kickifyUserId(event.redeemer.user_id),
                username: kickifyUsername(event.redeemer.username),
                displayName: unkickifyUsername(event.redeemer.username)
            },
            reward: {
                id: firebotRewardId,
                name: event.reward.title,
                cost: event.reward.cost,
                imageUrl: ""
            }
        });

        // Firebot does not expose the custom reward manager; JsonDB is the only way to read effects/restrictions.
        const JsonDbConstructor = JsonDb as typeof JsonDB;
        if (!JsonDbConstructor) {
            logger.error("JsonDB module is not available. Cannot trigger channel reward effects.");
            return;
        }

        const customRewardsDbPath = path.join(SCRIPTS_DIR, "..", "channel-rewards.json");
        let channelRewardsData: Record<string, SavedChannelReward> = {};
        try {
            const db = new JsonDbConstructor(customRewardsDbPath, false, false);
            db.load();
            channelRewardsData = db.getData("/") || {};
        } catch (error) {
            logger.error(`Error loading JsonDB at ${customRewardsDbPath}. Cannot trigger channel reward effects: ${error}`);
            return;
        }

        const channelReward = channelRewardsData[firebotRewardId];
        if (!channelReward) {
            logger.error(`Channel reward with Firebot ID ${firebotRewardId} not found in database.`);
            return;
        }

        // Check if reward is disabled in Firebot
        if (channelReward.twitchData.isEnabled === false) {
            logger.warn(
                `Reward redemption ignored for "${event.reward.title}" - ` +
                `Firebot channel reward is disabled. Enable it in Firebot's Channel Rewards Manager.`
            );
            return;
        }

        // Check if reward is paused in Firebot
        if (channelReward.twitchData.isPaused === true) {
            logger.warn(
                `Reward redemption ignored for "${event.reward.title}" - ` +
                `Firebot channel reward is paused. Unpause it in Firebot's Channel Rewards Manager.`
            );
            return;
        }

        if (!channelReward.effects) {
            logger.warn(`Channel reward ${channelReward.twitchData.title} has no effects to trigger.`);
            return;
        }

        const metadata: RewardRedemptionMetadata = {
            username: kickifyUsername(event.redeemer.username),
            userId: kickifyUserId(event.redeemer.user_id),
            userDisplayName: unkickifyUsername(event.redeemer.username),
            messageText: event.user_input || "",
            args: (event.user_input || "").split(" "),
            redemptionId: event.id,
            rewardId: firebotRewardId,
            rewardImage: channelReward.twitchData.image?.url1x || channelReward.twitchData.defaultImage.url1x,
            rewardName: channelReward.twitchData.title,
            rewardDescription: event.reward.description || "",
            rewardCost: channelReward.twitchData.cost || 0,
            platform: "kick"
        };

        const trigger: Trigger = {
            type: "channel_reward",
            metadata
        };

        if (channelReward.restrictionData) {
            try {
                await restrictionManager.runRestrictionPredicates(trigger, channelReward.restrictionData, false);
                logger.debug(`Restrictions passed for user ${metadata.username} (${metadata.userId}) on reward ${channelReward.twitchData.title}`);
            } catch (restrictionReason) {
                const reason = Array.isArray(restrictionReason) ? restrictionReason.join(", ") : restrictionReason;
                logger.warn(`Restrictions failed for user ${metadata.username} (${metadata.userId}) on reward ${channelReward.twitchData.title}: ${reason}`);
                return;
            }
        }

        const processEffectsRequest = {
            trigger,
            effects: channelReward.effects
        };

        setTimeout(async () => {
            try {
                await effectRunner.processEffects(processEffectsRequest);
                logger.info(`Successfully triggered effects for channel reward ${channelReward.twitchData.title} (ID: ${channelReward.id}) for user ${metadata.username} (${metadata.userId})`);
            } catch (reason) {
                logger.error(`Error when running effects for ${metadata.redemptionId}: ${reason}`);
            }
        }, 100);
    }
}

export const rewardRedemptionHandler = new RewardRedemptionHandler();
