import { AngularJsFactory } from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";

export const kickBackendService: AngularJsFactory = {
    name: "kickBackendService",
    function: (backendCommunicator: any) => {
        return {
            // Connection methods
            getConnections: () => {
                backendCommunicator.fireEvent("kick:get-connections", {});
            },

            getWebhookData: () => {
                return backendCommunicator.fireEventSync("kick:get-webhook-data", {});
            },

            registerWebhook: () => {
                return backendCommunicator.fireEventAsync("kick:register-webhook", {});
            },

            resetWebhookSubscriptions: () => {
                return backendCommunicator.fireEventAsync("kick:reset-webhook-subscriptions", {});
            },

            authorizeStreamer: () => {
                return backendCommunicator.fireEventSync("kick:authorize-streamer", {});
            },

            deauthorizeStreamer: () => {
                backendCommunicator.fireEvent("kick:deauthorize-streamer", {});
            },

            authorizeBot: () => {
                return backendCommunicator.fireEventSync("kick:authorize-bot", {});
            },

            deauthorizeBot: () => {
                backendCommunicator.fireEvent("kick:deauthorize-bot", {});
            },

            // Reward methods
            getRewardManagementState: () => {
                return backendCommunicator.fireEventSync("kick:get-reward-management-state", {});
            },

            getAllKickRewards: () => {
                return backendCommunicator.fireEventAsync("kick:get-all-kick-rewards", {});
            },

            reconcileRewards: () => {
                return backendCommunicator.fireEventAsync("kick:reconcile-rewards", {});
            },

            manageReward: (firebotRewardId: string) => {
                return backendCommunicator.fireEventAsync("kick:manage-reward", { firebotRewardId });
            },

            unmanageReward: (firebotRewardId: string) => {
                return backendCommunicator.fireEventAsync("kick:unmanage-reward", { firebotRewardId });
            },

            updateRewardOverrides: (firebotRewardId: string, overrides: any) => {
                return backendCommunicator.fireEventAsync("kick:update-reward-overrides", {
                    firebotRewardId,
                    overrides
                });
            },

            resyncReward: (firebotRewardId: string) => {
                return backendCommunicator.fireEventAsync("kick:resync-reward", { firebotRewardId });
            },

            syncAllRewards: () => {
                return backendCommunicator.fireEventAsync("kick:sync-all-rewards", {});
            },

            // Event listeners
            onConnectionsUpdate: (callback: (data: any) => void) => {
                backendCommunicator.on("kick:connections-update", callback);
            },

            onStreamerAuthUrl: (callback: (url: string) => void) => {
                backendCommunicator.on("kick:streamer-auth-url", callback);
            },

            onBotAuthUrl: (callback: (url: string) => void) => {
                backendCommunicator.on("kick:bot-auth-url", callback);
            },

            onRewardManagementStateUpdated: (callback: (state: any) => void) => {
                backendCommunicator.on("kick:reward-management-state-updated", callback);
            },

            onRewardManagementError: (callback: (error: any) => void) => {
                backendCommunicator.on("kick:reward-management-error", callback);
            },

            onChannelRewardsUpdated: (callback: () => void) => {
                backendCommunicator.on("channel-rewards-updated", callback);
            },

            onKickChannelRewardsRefresh: (callback: (data: { firebotRewardId?: string }) => void) => {
                backendCommunicator.on("kick:channel-rewards-refresh", callback);
            }
        };
    }
};
