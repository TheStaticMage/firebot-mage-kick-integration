import type { ChannelReward, ChannelRewardCreateRequest, ChannelRewardUpdateRequest } from "kick-api-types/rest/v1/rewards";
import { logger } from "../main";
import type { FirebotCustomReward } from "../shared/types";
import type { Kick } from "./kick";

/**
 * RewardsManager handles CRUD operations for Kick channel rewards.
 * Maps between Firebot's CustomReward format and Kick API format.
 *
 * Note: Kick API does not provide a way to filter by manageable rewards.
 * A reward is considered manageable if this app can update or delete it.
 * Only the app that created a reward can modify or delete it.
 */
export class RewardsManager {
    private kick: Kick;
    private isGetAllRewardsPending = false;
    private lastGetAllRewardsRequestedAt: number | null = null;
    private lastGetAllRewardsResult: ChannelReward[] | null = null;
    private lastGetAllRewardsResultAt: number | null = null;
    private pendingGetAllRewards: Promise<ChannelReward[] | null> | null = null;

    constructor(kick: Kick) {
        this.kick = kick;
    }

    /**
     * Get all rewards created by this app.
     * Since Kick API doesn't provide a filter, this returns all rewards
     * and the caller should check management state to determine which are managed.
     */
    async getAllRewards(): Promise<ChannelReward[] | null> {
        const now = Date.now();
        const hasRecentResult = this.lastGetAllRewardsResultAt !== null &&
            now - this.lastGetAllRewardsResultAt < 1000;

        if (this.isGetAllRewardsPending) {
            if (hasRecentResult) {
                logger.debug("Get all rewards is pending, returning last known result.");
                return this.lastGetAllRewardsResult;
            }
            if (this.pendingGetAllRewards) {
                logger.debug("Get all rewards is pending, returning pending promise.");
                return this.pendingGetAllRewards;
            }
        }

        if (
            this.lastGetAllRewardsRequestedAt !== null &&
            now - this.lastGetAllRewardsRequestedAt < 1000 &&
            hasRecentResult
        ) {
            logger.debug("Returning cached get all rewards result.");
            return this.lastGetAllRewardsResult;
        }

        this.isGetAllRewardsPending = true;
        this.lastGetAllRewardsRequestedAt = now;

        const pendingRequest = (async () => {
            let result: ChannelReward[] | null = null;
            try {
                const response = await this.kick.httpCallWithTimeout(
                    `/public/v1/channels/rewards`,
                    "GET"
                );

                if (!response || !response.data || !Array.isArray(response.data)) {
                    logger.debug(`Failed to retrieve rewards from Kick API. ${JSON.stringify(response)}`);
                    result = null;
                } else {
                    logger.debug(`Retrieved ${response.data.length} total rewards from Kick API`);
                    result = response.data;
                }
            } catch (error) {
                logger.error(`Error retrieving rewards: ${error}`);
                result = null;
            } finally {
                this.lastGetAllRewardsResult = result;
                this.lastGetAllRewardsResultAt = Date.now();
            }

            return result;
        })();

        this.pendingGetAllRewards = pendingRequest;

        try {
            return await pendingRequest;
        } finally {
            this.isGetAllRewardsPending = false;
            this.pendingGetAllRewards = null;
        }
    }

    /**
     * Create a new reward on Kick from a Firebot CustomReward.
     */
    async createReward(reward: FirebotCustomReward, overrides?: {
        cost?: number;
        skipQueue?: boolean;
        enabled?: boolean;
    }): Promise<ChannelReward | null> {
        try {
            const createRequest = this.mapCustomRewardToCreateRequest(reward, overrides);

            logger.debug(`Creating reward on Kick: ${JSON.stringify(createRequest)}`);

            const response = await this.kick.httpCallWithTimeout(
                `/public/v1/channels/rewards`,
                "POST",
                JSON.stringify(createRequest)
            );

            if (!response || !response.data) {
                logger.error(`Failed to create reward on Kick. Response: ${JSON.stringify(response)}`);
                return null;
            }

            logger.debug(`Successfully created reward on Kick: ${response.data.id}`);
            return response.data;
        } catch (error) {
            logger.error(`Error creating reward on Kick: ${error}`);
            return null;
        }
    }

    /**
     * Update an existing reward on Kick.
     * Only rewards created by this app can be updated.
     */
    async updateReward(rewardId: string, reward: FirebotCustomReward, overrides?: {
        cost?: number;
        skipQueue?: boolean;
        enabled?: boolean;
        paused?: boolean;
    }): Promise<boolean> {
        try {
            const updateRequest = this.mapCustomRewardToUpdateRequest(reward, overrides);

            logger.debug(`Updating reward on Kick (${rewardId}): ${JSON.stringify(updateRequest)}`);

            await this.kick.httpCallWithTimeout(
                `/public/v1/channels/rewards/${rewardId}`,
                "PATCH",
                JSON.stringify(updateRequest)
            );

            logger.debug(`Successfully updated reward on Kick: ${rewardId}`);
            return true;
        } catch (error) {
            logger.error(`Error updating reward on Kick (${rewardId}): ${error}`);
            return false;
        }
    }

    /**
     * Delete a reward from Kick.
     * Only rewards created by this app can be deleted.
     */
    async deleteReward(rewardId: string): Promise<boolean> {
        try {
            logger.debug(`Deleting reward from Kick: ${rewardId}`);

            await this.kick.httpCallWithTimeout(
                `/public/v1/channels/rewards/${rewardId}`,
                "DELETE"
            );

            logger.debug(`Successfully deleted reward from Kick: ${rewardId}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting reward from Kick (${rewardId}): ${error}`);
            return false;
        }
    }

    /**
     * Map Firebot's CustomReward to Kick's ChannelRewardCreateRequest format.
     */
    private mapCustomRewardToCreateRequest(
        reward: FirebotCustomReward,
        overrides?: {
            cost?: number;
            skipQueue?: boolean;
            enabled?: boolean;
        }
    ): ChannelRewardCreateRequest {
        return {
            title: reward.title,
            cost: overrides?.cost ?? reward.cost,
            description: reward.prompt || "",
            // eslint-disable-next-line camelcase
            background_color: reward.backgroundColor,
            // eslint-disable-next-line camelcase
            is_enabled: overrides?.enabled ?? reward.isEnabled,
            // eslint-disable-next-line camelcase
            is_user_input_required: reward.isUserInputRequired,
            // eslint-disable-next-line camelcase
            should_redemptions_skip_request_queue: overrides?.skipQueue ?? reward.shouldRedemptionsSkipRequestQueue
        };
    }

    /**
     * Map Firebot's CustomReward to Kick's ChannelRewardUpdateRequest format.
     */
    private mapCustomRewardToUpdateRequest(
        reward: FirebotCustomReward,
        overrides?: {
            cost?: number;
            skipQueue?: boolean;
            enabled?: boolean;
            paused?: boolean;
        }
    ): ChannelRewardUpdateRequest {
        return {
            title: reward.title,
            cost: overrides?.cost ?? reward.cost,
            description: reward.prompt || "",
            // eslint-disable-next-line camelcase
            background_color: reward.backgroundColor,
            // eslint-disable-next-line camelcase
            is_enabled: overrides?.enabled ?? reward.isEnabled,
            // eslint-disable-next-line camelcase
            is_user_input_required: reward.isUserInputRequired,
            // eslint-disable-next-line camelcase
            should_redemptions_skip_request_queue: overrides?.skipQueue ?? reward.shouldRedemptionsSkipRequestQueue,
            // eslint-disable-next-line camelcase
            is_paused: overrides?.paused ?? reward.isPaused
        };
    }
}
