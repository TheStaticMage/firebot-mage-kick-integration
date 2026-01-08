import { integration } from "../integration-singleton";
import { firebot, logger } from "../main";
import { FirebotCustomReward, KickRewardManagementData } from "../shared/types";
import { reflectEvent } from "./reflector";

function unwrapFirebotReward(firebotRewardWrapper: any): FirebotCustomReward | undefined {
    if (!firebotRewardWrapper) {
        return undefined;
    }
    // Firebot wraps rewards with {id, twitchData, manageable}
    // We need the twitchData which matches FirebotCustomReward structure
    return firebotRewardWrapper.twitchData || firebotRewardWrapper;
}

function getRewardById(rewards: any[], id: string): FirebotCustomReward | undefined {
    const wrapper = rewards.find(r => r.id === id || r?.twitchData?.id === id);
    return unwrapFirebotReward(wrapper);
}

export class KickRewardsBackend {
    private cachedOutsideFirebotRewards: any[] | null = null;

    private buildInitialOverrides(
        reward: FirebotCustomReward,
        overrides?: { cost?: number; skipQueue?: boolean; enabled?: boolean; paused?: boolean; }
    ) {
        return {
            cost: overrides?.cost ?? reward.cost,
            skipQueue: overrides?.skipQueue ?? reward.shouldRedemptionsSkipRequestQueue ?? false,
            enabled: overrides?.enabled ?? reward.isEnabled ?? true,
            paused: overrides?.paused ?? reward.isPaused ?? false
        };
    }

    registerHandlers(): void {
        const { frontendCommunicator } = firebot.modules;

        // We listen to this Firebot event so we know when a channel reward is updated by an effect
        frontendCommunicator.onAsync("kick:channel-reward-updated", async (data: any) => {
            const firebotReward = unwrapFirebotReward(data);
            const firebotRewardId = data?.id || firebotReward?.id;

            if (!firebotReward || !firebotRewardId) {
                logger.debug("Skipping channel reward update event. Reward data is missing.");
                return;
            }

            const state = integration.getKickRewardsState();
            const managementData = state.getManagementData(firebotRewardId);

            if (!managementData?.managedOnKick || !managementData.kickRewardId) {
                return;
            }

            const currentEnabled = managementData.overrides?.enabled;
            const currentPaused = managementData.overrides?.paused;
            const nextEnabled = typeof firebotReward.isEnabled === "boolean"
                ? firebotReward.isEnabled
                : currentEnabled;
            const nextPaused = typeof firebotReward.isPaused === "boolean"
                ? firebotReward.isPaused
                : currentPaused;

            if (
                typeof currentEnabled === "boolean" &&
                typeof currentPaused === "boolean" &&
                nextEnabled === currentEnabled &&
                nextPaused === currentPaused
            ) {
                logger.debug(`Skipping Kick reward update for ${managementData.kickRewardId}. Enabled and paused state unchanged.`);
                return;
            }

            const overrides = {
                ...(managementData.overrides || {})
            };

            if (typeof firebotReward.isEnabled === "boolean") {
                overrides.enabled = firebotReward.isEnabled;
            }

            if (typeof firebotReward.isPaused === "boolean") {
                overrides.paused = firebotReward.isPaused;
            }

            const updateSuccess = await integration.kick.rewardsManager.updateReward(
                managementData.kickRewardId,
                firebotReward,
                overrides
            );

            if (!updateSuccess) {
                logger.error(`Failed to sync Kick reward ${managementData.kickRewardId} from Firebot update.`);
                return;
            }

            managementData.overrides = overrides;
            state.setManagementData(firebotRewardId, managementData);
            this.invalidateCache();
            this.sendStateUpdate();
            frontendCommunicator.send("kick:channel-rewards-refresh", { firebotRewardId });
        });

        frontendCommunicator.on("kick:get-reward-management-state", () => {
            return integration.getKickRewardsState().getAllManagementData();
        });

        frontendCommunicator.onAsync("kick:get-all-kick-rewards", async () => {
            try {
                const kickRewards = await integration.kick.rewardsManager.getAllRewards();
                if (!kickRewards) {
                    return this.cachedOutsideFirebotRewards || [];
                }

                const managementState = integration.getKickRewardsState().getAllManagementData();
                const managedKickRewardIds = new Set(
                    Object.values(managementState)
                        .filter(data => data.managedOnKick && data.kickRewardId)
                        .map(data => data.kickRewardId)
                );

                const allRewardsData = kickRewards.map(reward => ({
                    id: reward.id,
                    title: reward.title,
                    cost: reward.cost,
                    isManaged: managedKickRewardIds.has(reward.id),
                    isEnabled: reward.is_enabled ?? true,
                    isPaused: reward.is_paused ?? false
                }));

                // Cache outside Firebot rewards (those not managed by us) for future calls
                const outsideFirebotRewards = allRewardsData.filter(r => !r.isManaged);
                this.cachedOutsideFirebotRewards = outsideFirebotRewards;

                return allRewardsData;
            } catch (error: any) {
                logger.error(`Error getting all Kick rewards: ${error.message}`);
                return this.cachedOutsideFirebotRewards || [];
            }
        });

        frontendCommunicator.onAsync("kick:manage-reward", async (data: {
            firebotRewardId: string,
            overrides?: { cost?: number; skipQueue?: boolean; enabled?: boolean; }
        }) => {
            try {
                const state = integration.getKickRewardsState();

                const getTotalKickRewards = async () => {
                    const rewards = await integration.kick.rewardsManager.getAllRewards();
                    return rewards?.length || 0;
                };

                if (!(await state.canManageMore(getTotalKickRewards))) {
                    throw new Error("Maximum of 15 Kick rewards reached. Cannot manage more rewards.");
                }

                const allRewards = await reflectEvent<FirebotCustomReward[]>(
                    "get-channel-rewards",
                    {},
                    false
                );

                const firebotReward = getRewardById(allRewards || [], data.firebotRewardId);
                if (!firebotReward) {
                    throw new Error(`Firebot reward with ID ${data.firebotRewardId} not found.`);
                }

                const initialOverrides = this.buildInitialOverrides(firebotReward, data.overrides);
                const kickReward = await integration.kick.rewardsManager.createReward(firebotReward, initialOverrides);

                if (!kickReward) {
                    throw new Error("Failed to create reward on Kick API.");
                }

                const managementData: KickRewardManagementData = {
                    managedOnKick: true,
                    kickRewardId: kickReward.id,
                    firebotRewardTitle: firebotReward.title,
                    overrides: initialOverrides
                };

                state.setManagementData(data.firebotRewardId, managementData);
                this.invalidateCache();
                this.sendStateUpdate();

            } catch (error: any) {
                logger.error(`Error managing reward: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });

        frontendCommunicator.onAsync("kick:unmanage-reward", async (data: { firebotRewardId: string }) => {
            try {
                const state = integration.getKickRewardsState();
                const managementData = state.getManagementData(data.firebotRewardId);

                if (!managementData || !managementData.kickRewardId) {
                    // Already not managed or missing ID, just clear state
                    state.removeManagementData(data.firebotRewardId);
                    this.invalidateCache();
                    this.sendStateUpdate();
                    return;
                }

                const success = await integration.kick.rewardsManager.deleteReward(managementData.kickRewardId);

                if (!success) {
                    // Maybe it was already deleted on Kick?
                    logger.warn(`Failed to delete reward ${managementData.kickRewardId} on Kick. Removing from management state anyway.`);
                }

                state.removeManagementData(data.firebotRewardId);
                this.invalidateCache();
                this.sendStateUpdate();

            } catch (error: any) {
                logger.error(`Error unmanaging reward: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });

        frontendCommunicator.onAsync("kick:refresh-kick-rewards", async () => {
            try {
                const rewards = await integration.kick.rewardsManager.getAllRewards();
                return rewards || [];
            } catch (error: any) {
                logger.error(`Error refreshing Kick rewards: ${error.message}`);
                return [];
            }
        });

        frontendCommunicator.onAsync("kick:update-reward-overrides", async (data: {
            firebotRewardId: string,
            overrides: { cost?: number; skipQueue?: boolean; enabled?: boolean; paused?: boolean; }
        }) => {
            try {
                const state = integration.getKickRewardsState();
                const managementData = state.getManagementData(data.firebotRewardId);

                if (!managementData || !managementData.kickRewardId) {
                    throw new Error("Reward is not managed on Kick.");
                }

                const allRewards = await reflectEvent<FirebotCustomReward[]>(
                    "get-channel-rewards",
                    {},
                    false
                );

                const firebotReward = getRewardById(allRewards || [], data.firebotRewardId);
                if (!firebotReward) {
                    throw new Error(`Firebot reward with ID ${data.firebotRewardId} not found.`);
                }

                const overrides = this.buildInitialOverrides(firebotReward, data.overrides);
                const rewardUpdate = {
                    ...firebotReward,
                    isPaused: overrides.paused ?? firebotReward.isPaused
                };
                const success = await integration.kick.rewardsManager.updateReward(managementData.kickRewardId, rewardUpdate, overrides);

                if (!success) {
                    throw new Error("Failed to update reward on Kick API.");
                }

                // Update state with new overrides
                managementData.overrides = overrides;
                state.setManagementData(data.firebotRewardId, managementData);
                this.invalidateCache();
                this.sendStateUpdate();

            } catch (error: any) {
                logger.error(`Error updating reward overrides: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });

        frontendCommunicator.onAsync("kick:resync-reward", async (data: { firebotRewardId: string }) => {
            try {
                const state = integration.getKickRewardsState();
                const managementData = state.getManagementData(data.firebotRewardId);

                if (!managementData || !managementData.kickRewardId) {
                    throw new Error("Reward is not managed on Kick.");
                }

                const allRewards = await reflectEvent<FirebotCustomReward[]>(
                    "get-channel-rewards",
                    {},
                    false
                );

                const firebotReward = getRewardById(allRewards || [], data.firebotRewardId);
                if (!firebotReward) {
                    throw new Error(`Firebot reward with ID ${data.firebotRewardId} not found.`);
                }

                // Delete the existing reward (ignore errors)
                await integration.kick.rewardsManager.deleteReward(managementData.kickRewardId).catch((error: any) => {
                    logger.debug(`Error deleting reward during re-sync (ignoring): ${error.message}`);
                });

                // Re-create the reward
                const kickReward = await integration.kick.rewardsManager.createReward(firebotReward, managementData.overrides);

                if (!kickReward) {
                    throw new Error("Failed to re-create reward on Kick API.");
                }

                managementData.kickRewardId = kickReward.id;
                managementData.firebotRewardTitle = firebotReward.title;
                state.setManagementData(data.firebotRewardId, managementData);

                this.invalidateCache();
                this.sendStateUpdate();

            } catch (error: any) {
                logger.error(`Error re-syncing reward: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });

        frontendCommunicator.onAsync("kick:sync-all-rewards", async () => {
            try {
                const state = integration.getKickRewardsState();
                const managementState = state.getAllManagementData();

                const allRewards = await reflectEvent<FirebotCustomReward[]>(
                    "get-channel-rewards",
                    {},
                    false
                );

                const firebotRewardsMap = new Map<string, FirebotCustomReward>();
                if (allRewards) {
                    allRewards.forEach((wrapper: any) => {
                        const unwrapped = unwrapFirebotReward(wrapper);
                        const wrapId = wrapper.id || unwrapped?.id;
                        if (unwrapped && wrapId) {
                            firebotRewardsMap.set(wrapId, unwrapped);
                        }
                    });
                }

                const kickRewards = await integration.kick.rewardsManager.getAllRewards();
                const kickRewardsMap = new Map(kickRewards?.map(r => [r.id, r]) || []);

                let unchangedCount = 0;
                let updatedCount = 0;
                let failedCount = 0;

                for (const [firebotRewardId, data] of Object.entries(managementState)) {
                    if (!data.managedOnKick || !data.kickRewardId) {
                        continue;
                    }

                    const firebotReward = firebotRewardsMap.get(firebotRewardId);
                    if (!firebotReward) {
                        logger.warn(`Managed Firebot reward ${firebotRewardId} not found locally. Skipping.`);
                        failedCount++;
                        continue;
                    }

                    const kickReward = kickRewardsMap.get(data.kickRewardId);
                    const syncOverrides = {
                        ...(data.overrides || {}),
                        enabled: typeof firebotReward.isEnabled === "boolean"
                            ? firebotReward.isEnabled
                            : data.overrides?.enabled,
                        paused: typeof firebotReward.isPaused === "boolean"
                            ? firebotReward.isPaused
                            : data.overrides?.paused
                    };
                    const overridesChanged = (
                        data.overrides?.enabled !== syncOverrides.enabled ||
                        data.overrides?.paused !== syncOverrides.paused
                    );
                    if (!kickReward) {
                        logger.debug(`Kick reward ${data.kickRewardId} not found, will recreate.`);
                    } else if (this.rewardNeedsSync(firebotReward, syncOverrides, kickReward)) {
                        logger.debug(`Kick reward ${data.kickRewardId} has changes, will update.`);
                        this.logRewardChanges(firebotReward, syncOverrides, kickReward);
                    } else {
                        logger.debug(`Kick reward ${data.kickRewardId} is already in sync, skipping.`);
                        if (data.firebotRewardTitle !== firebotReward.title || overridesChanged) {
                            data.firebotRewardTitle = firebotReward.title;
                            data.overrides = syncOverrides;
                            state.setManagementData(firebotRewardId, data);
                        }
                        unchangedCount++;
                        continue;
                    }

                    if (!kickReward) {
                        // Delete the existing reward (ignore errors)
                        await integration.kick.rewardsManager.deleteReward(data.kickRewardId).catch((error: any) => {
                            logger.debug(`Error deleting reward during sync-all (ignoring): ${error.message}`);
                        });

                        // Re-create the reward
                        const newKickReward = await integration.kick.rewardsManager.createReward(firebotReward, syncOverrides);

                        if (newKickReward) {
                            data.kickRewardId = newKickReward.id;
                            data.firebotRewardTitle = firebotReward.title;
                            data.overrides = syncOverrides;
                            state.setManagementData(firebotRewardId, data);
                            updatedCount++;

                            if (firebotReward.isPaused === true) {
                                const pauseUpdateSuccess = await integration.kick.rewardsManager.updateReward(
                                    newKickReward.id,
                                    firebotReward,
                                    syncOverrides
                                );
                                if (!pauseUpdateSuccess) {
                                    logger.error(`Failed to sync paused state for Kick reward ${newKickReward.id}.`);
                                }
                            }
                        } else {
                            failedCount++;
                        }
                        continue;
                    }

                    const updateSuccess = await integration.kick.rewardsManager.updateReward(
                        data.kickRewardId,
                        firebotReward,
                        syncOverrides
                    );

                    if (updateSuccess) {
                        data.firebotRewardTitle = firebotReward.title;
                        data.overrides = syncOverrides;
                        state.setManagementData(firebotRewardId, data);
                        updatedCount++;
                    } else {
                        failedCount++;
                    }
                }

                this.invalidateCache();
                this.sendStateUpdate();
                return { unchanged: unchangedCount, updated: updatedCount, failed: failedCount };

            } catch (error: any) {
                logger.error(`Error syncing all rewards: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });

        frontendCommunicator.onAsync("kick:reconcile-rewards", async () => {
            try {
                const state = integration.getKickRewardsState();
                const managementState = state.getAllManagementData();

                let updatedCount = 0;

                // Get all current Kick rewards to verify existence
                const kickRewards = await integration.kick.rewardsManager.getAllRewards();
                const kickRewardIds = new Set(kickRewards?.map(r => r.id) || []);

                // Fetch all Firebot rewards once
                const firebotRewardWrappers = await reflectEvent<any[]>("get-channel-rewards", {}, false);
                const firebotRewardsMap = new Map<string, FirebotCustomReward>();
                if (firebotRewardWrappers) {
                    firebotRewardWrappers.forEach((wrapper) => {
                        const unwrapped = unwrapFirebotReward(wrapper);
                        if (unwrapped?.id) {
                            firebotRewardsMap.set(wrapper.id, unwrapped);
                        }
                    });
                }

                for (const [firebotRewardId, data] of Object.entries(managementState)) {
                    if (!data.managedOnKick || !data.kickRewardId) {
                        continue;
                    }

                    const firebotReward = firebotRewardsMap.get(firebotRewardId);
                    if (!firebotReward) {
                        // Firebot reward deleted? Should we delete from Kick?
                        // For now just log warn
                        logger.warn(`Managed Firebot reward ${firebotRewardId} not found locally.`);
                        continue;
                    }

                    if (!kickRewardIds.has(data.kickRewardId)) {
                        logger.warn(`Managed Kick reward ${data.kickRewardId} not found on Kick. Re-creating...`);

                        // Re-create
                        const newKickReward = await integration.kick.rewardsManager.createReward(firebotReward, data.overrides);
                        if (newKickReward) {
                            data.kickRewardId = newKickReward.id;
                            data.firebotRewardTitle = firebotReward.title;
                            state.setManagementData(firebotRewardId, data);
                            updatedCount++;
                        }
                    } else {
                        // Exists on Kick, ensure settings are up to date
                        const success = await integration.kick.rewardsManager.updateReward(data.kickRewardId, firebotReward, data.overrides);
                        if (success) {
                            if (data.firebotRewardTitle !== firebotReward.title) {
                                data.firebotRewardTitle = firebotReward.title;
                                state.setManagementData(firebotRewardId, data);
                            }
                            updatedCount++;
                        }
                    }
                }

                this.invalidateCache();
                this.sendStateUpdate();
                return { updated: updatedCount };

            } catch (error: any) {
                logger.error(`Error reconciling rewards: ${error.message}`);
                frontendCommunicator.send("kick:reward-management-error", {
                    message: error.message,
                    status: error.status,
                    details: error.message
                });
                throw error;
            }
        });
    }

    private rewardNeedsSync(
        firebotReward: FirebotCustomReward,
        overrides: { cost?: number; skipQueue?: boolean; enabled?: boolean; paused?: boolean; },
        kickReward: any
    ): boolean {
        const expectedCost = overrides.cost ?? firebotReward.cost;
        const expectedSkipQueue = overrides.skipQueue ?? firebotReward.shouldRedemptionsSkipRequestQueue ?? false;
        const expectedEnabled = overrides.enabled ?? firebotReward.isEnabled ?? true;
        const expectedPaused = overrides.paused ?? firebotReward.isPaused ?? false;
        const expectedDescription = firebotReward.prompt || "";

        return (
            kickReward.title !== firebotReward.title ||
            kickReward.cost !== expectedCost ||
            kickReward.description !== expectedDescription ||
            kickReward.background_color !== firebotReward.backgroundColor ||
            kickReward.is_enabled !== expectedEnabled ||
            kickReward.is_paused !== expectedPaused ||
            kickReward.is_user_input_required !== firebotReward.isUserInputRequired ||
            kickReward.should_redemptions_skip_request_queue !== expectedSkipQueue
        );
    }

    private logRewardChanges(
        firebotReward: FirebotCustomReward,
        overrides: { cost?: number; skipQueue?: boolean; enabled?: boolean; paused?: boolean; },
        kickReward: any
    ): void {
        const expectedCost = overrides.cost ?? firebotReward.cost;
        const expectedSkipQueue = overrides.skipQueue ?? firebotReward.shouldRedemptionsSkipRequestQueue ?? false;
        const expectedEnabled = overrides.enabled ?? firebotReward.isEnabled ?? true;
        const expectedPaused = overrides.paused ?? firebotReward.isPaused ?? false;
        const expectedDescription = firebotReward.prompt || "";

        const changes: string[] = [];

        if (kickReward.title !== firebotReward.title) {
            changes.push(`title: "${kickReward.title}" -> "${firebotReward.title}"`);
        }
        if (kickReward.cost !== expectedCost) {
            changes.push(`cost: ${kickReward.cost} -> ${expectedCost}`);
        }
        if (kickReward.description !== expectedDescription) {
            changes.push(`description: "${kickReward.description}" -> "${expectedDescription}"`);
        }
        if (kickReward.background_color !== firebotReward.backgroundColor) {
            changes.push(`background_color: "${kickReward.background_color}" -> "${firebotReward.backgroundColor}"`);
        }
        if (kickReward.is_enabled !== expectedEnabled) {
            changes.push(`is_enabled: ${kickReward.is_enabled} -> ${expectedEnabled}`);
        }
        if (kickReward.is_paused !== expectedPaused) {
            changes.push(`is_paused: ${kickReward.is_paused} -> ${expectedPaused}`);
        }
        if (kickReward.is_user_input_required !== firebotReward.isUserInputRequired) {
            changes.push(`is_user_input_required: ${kickReward.is_user_input_required} -> ${firebotReward.isUserInputRequired}`);
        }
        if (kickReward.should_redemptions_skip_request_queue !== expectedSkipQueue) {
            changes.push(`should_redemptions_skip_request_queue: ${kickReward.should_redemptions_skip_request_queue} -> ${expectedSkipQueue}`);
        }

        if (changes.length > 0) {
            logger.debug(`Reward "${firebotReward.title}" changes: ${changes.join(", ")}`);
        }
    }

    private invalidateCache() {
        // Don't clear outside Firebot rewards cache, only force re-evaluation of managed status
        // The next call to kick:get-all-kick-rewards will recalculate isManaged for all rewards
    }

    private sendStateUpdate() {
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("kick:reward-management-state-updated", integration.getKickRewardsState().getAllManagementData());
    }
}

export const kickRewardsBackend = new KickRewardsBackend();
