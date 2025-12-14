import {
    AngularJsPage,
    UIExtension
} from "@crowbartools/firebot-custom-scripts-types/types/modules/ui-extension-manager";
import { loadTemplate } from "./kick-template-loader";
import { kickBackendService } from "./kick-backend-service";
import { kickUtilitiesService } from "./kick-utilities";

const kickIntegrationPage: AngularJsPage = {
    id: "kick-integration",
    name: "Kick",
    controller: ($scope: any, backendCommunicator: any, $timeout: any, channelRewardsService: any, logger: any, utilityService: any, kickBackendService: any, kickUtilitiesService: any) => {
        // Connections Tab Logic
        $scope.connections = {
            connected: false,
            streamer: {
                ready: false,
                status: "Authorization required",
                tokenExpiresAt: undefined,
                missingScopes: []
            },
            bot: {
                ready: false,
                status: "Authorization required",
                tokenExpiresAt: undefined,
                missingScopes: []
            }
        };

        $scope.currentAuthType = null;
        $scope.webhookUrl = "";
        let copyButtonTimeout: any = null;
        let authModalCloser: (() => void) | null = null;

        // Initialize - request current status
        kickBackendService.getConnections();

        // Request webhook data
        const updateWebhookData = () => {
            const data = kickBackendService.getWebhookData();
            if (data) {
                $scope.webhookUrl = data.url || "";
            }
        };
        updateWebhookData();

        // Listen for connection updates
        kickBackendService.onConnectionsUpdate((data: any) => {
            $scope.connections = {
                ...data,
                streamer: {
                    ...data.streamer,
                    missingScopes: data.streamer.missingScopes || []
                },
                bot: {
                    ...data.bot,
                    missingScopes: data.bot.missingScopes || []
                }
            };

            maybeCloseAuthModal(data);
            // Refresh webhook status when connection state changes
            updateWebhookData();
        });

        // Listen for streamer auth URL
        kickBackendService.onStreamerAuthUrl((url: string) => {
            $timeout(() => {
                showAuthModal("Authorize Streamer Connection", url);
                $scope.currentAuthType = "streamer";
            });
        });

        // Listen for bot auth URL
        kickBackendService.onBotAuthUrl((url: string) => {
            $timeout(() => {
                showAuthModal("Authorize Bot Connection", url);
                $scope.currentAuthType = "bot";
            });
        });

        function showAuthModal(title: string, url: string) {
            utilityService.showModal({
                templateUrl: "kickAuthModal.html",
                size: "md",
                controllerFunc: ($scope: any, $uibModalInstance: any, $interval: any, $timeout: any, authUrl: string, authType: string, kickBackendService: any) => {
                    $scope.modalTitle = title;
                    $scope.authUrl = authUrl;
                    $scope.currentAuthType = authType;

                    let copyButtonTimeout: any = null;

                    // Start polling for connection status updates while modal is open
                    const statusCheckInterval = $interval(() => {
                        kickBackendService.getConnections();
                    }, 2000);

                    $scope.copyUrl = () => {
                        const result = kickUtilitiesService.copyToClipboard({
                            url: authUrl,
                            buttonId: "btn-copy-url-modal",
                            $timeout,
                            copyButtonTimeout
                        });
                        copyButtonTimeout = result.timeout;
                    };

                    const closeModal = () => {
                        $interval.cancel(statusCheckInterval);
                        if (copyButtonTimeout) {
                            $timeout.cancel(copyButtonTimeout);
                        }
                        $uibModalInstance.close();
                        authModalCloser = null;
                    };

                    authModalCloser = closeModal;
                    $scope.close = closeModal;

                    $scope.$on('$destroy', () => {
                        $interval.cancel(statusCheckInterval);
                        authModalCloser = null;
                    });
                },
                resolveObj: {
                    authUrl: () => url,
                    authType: () => $scope.currentAuthType
                },
                closeCallback: () => {
                    authModalCloser = null;
                    $scope.currentAuthType = null;
                    updateWebhookData();
                }
            });
        }

        $scope.authorizeStreamer = () => {
            kickBackendService.authorizeStreamer();
        };

        $scope.deauthorizeStreamer = () => {
            showConfirmModal(
                "Deauthorize Streamer",
                "Are you sure you want to deauthorize the streamer connection?"
            ).then((confirmed) => {
                if (confirmed) {
                    kickBackendService.deauthorizeStreamer();
                }
            });
        };

        $scope.authorizeBot = () => {
            kickBackendService.authorizeBot();
        };

        $scope.deauthorizeBot = () => {
            showConfirmModal(
                "Deauthorize Bot",
                "Are you sure you want to deauthorize the bot connection?"
            ).then((confirmed) => {
                if (confirmed) {
                    kickBackendService.deauthorizeBot();
                }
            });
        };

        $scope.copyUrl = () => {
            const result = kickUtilitiesService.copyToClipboard({
                url: $scope.authUrl,
                buttonId: "btn-copy-url",
                $timeout,
                copyButtonTimeout
            });
            copyButtonTimeout = result.timeout;
        };

        $scope.getStreamerStatusClass = () => {
            if (!$scope.connections.connected) {
                return "status-disconnected";
            }
            if ($scope.connections.streamer.ready) {
                return "status-ready";
            }
            if ($scope.connections.streamer.status === "Awaiting connection") {
                return "status-awaiting";
            }
            return "status-not-ready";
        };

        $scope.getStreamerStatusText = () => {
            if (!$scope.connections.connected) {
                return "Disconnected";
            }
            if ($scope.connections.streamer.ready) {
                return "Ready";
            }
            if ($scope.connections.streamer.status === "Awaiting connection") {
                return "Awaiting";
            }
            return "Not Ready";
        };

        $scope.getBotStatusClass = () => {
            if (!$scope.connections.connected) {
                return "status-disconnected";
            }
            if ($scope.connections.bot.ready) {
                return "status-ready";
            }
            if ($scope.connections.bot.status === "Awaiting connection") {
                return "status-awaiting";
            }
            return "status-not-ready";
        };

        $scope.getBotStatusText = () => {
            if (!$scope.connections.connected) {
                return "Disconnected";
            }
            if ($scope.connections.bot.ready) {
                return "Ready";
            }
            if ($scope.connections.bot.status === "Awaiting connection") {
                return "Awaiting";
            }
            return "Not Ready";
        };

        $scope.copyWebhookUrl = () => {
            const url = $scope.webhookUrl;
            if (!url) {
                return;
            }
            const result = kickUtilitiesService.copyToClipboard({
                url,
                buttonId: "btn-copy-webhook-url",
                $timeout,
                copyButtonTimeout,
                originalText: "Copy URL"
            });
            copyButtonTimeout = result.timeout;
        };

        $scope.registerWebhook = () => {
            kickBackendService.registerWebhook().then((result: any) => {
                $timeout(() => {
                    if (result.success) {
                        $scope.webhookUrl = result.url;
                    } else {
                        showErrorModal("Webhook Registration Failed", result.error || "Failed to register webhook");
                    }
                });
            }).catch((error: any) => {
                logger.error("Failed to register webhook:", error);
                $timeout(() => {
                    showErrorModal("Webhook Registration Failed", error?.message || "An error occurred while registering the webhook");
                });
            });
        };

        $scope.resetWebhookSubscriptions = () => {
            showConfirmModal(
                "Reset Webhook Subscriptions",
                "This will reset all webhook subscriptions and reconnect the integration. This may cause brief instability. Are you sure?"
            ).then((confirmed) => {
                if (!confirmed) {
                    return;
                }

                kickBackendService.resetWebhookSubscriptions().then((result: any) => {
                    $timeout(() => {
                        if (result.success) {
                            showInfoModal("Webhook Reset Complete", "Webhook subscriptions have been reset and the integration has been reconnected. If webhooks do not work correctly, please check the Firebot logs for any error messages.");
                        } else {
                            showErrorModal("Webhook Reset Failed", result.error || "Failed to reset webhook subscriptions");
                        }
                    });
                }).catch((error: any) => {
                    logger.error("Failed to reset webhook subscriptions:", error);
                    $timeout(() => {
                        showErrorModal("Webhook Reset Failed", error?.message || "An error occurred while resetting webhook subscriptions");
                    });
                });
            });
        };

        // Rewards Tab Logic
        $scope.rewardsTab = {
            loading: false,
            firebotRewards: [],
            baseRewards: [],
            kickRewards: [],
            outsideFirebotRewards: [],
            syncState: {},
            syncedCount: 0,
            totalKickRewardsCount: 0
        };

        // Table headers for rewards
        $scope.rewardHeaders = [
            {
                headerStyles: {
                    'width': '200px'
                },
                name: "REWARD",
                icon: "fa-gifts",
                dataField: "title",
                sortable: true,
                cellTemplate: `
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <div>{{ data.title }}</div>
                    </div>
                `
            },
            {
                name: "STATUS",
                icon: "fa-circle",
                headerStyles: {
                    'width': '125px'
                },
                cellTemplate: `
                    <span class="label" ng-class="{'label-success': data.syncState.managedOnKick, 'label-default': !data.syncState.managedOnKick, 'label-warning': data.isExternal}">
                        <i ng-if="data.isExternal" class="fas fa-lock" style="margin-right: 5px;"></i>
                        {{ data.isExternal ? 'Outside Firebot' : (data.syncState.managedOnKick ? 'Managed' : 'Unmanaged') }}
                    </span>
                `
            },
            {
                name: "FIREBOT COST",
                icon: "fa-coin",
                dataField: "cost",
                sortable: true,
                headerStyles: {
                    'width': '125px'
                },
                cellTemplate: `
                    <span ng-if="!data.isExternal">{{ data.cost }}</span>
                    <span ng-if="data.isExternal">&nbsp;</span>
                `
            },
            {
                name: "KICK COST",
                icon: "fa-coin",
                headerStyles: {
                    'width': '125px'
                },
                cellTemplate: `
                    <span ng-if="data.isExternal">{{ data.cost }}</span>
                    <span ng-if="!data.isExternal && data.syncState.managedOnKick">
                        {{ data.syncState.overrides.cost !== undefined ? data.syncState.overrides.cost : data.cost }}
                    </span>
                    <span ng-if="!data.isExternal && !data.syncState.managedOnKick">&nbsp;</span>
                `
            },
            {
                name: "SKIP QUEUE",
                icon: "fa-forward",
                headerStyles: {
                    'width': '100px',
                    'text-align': 'center'
                },
                cellStyles: {
                    'text-align': 'center'
                },
                cellTemplate: `
                    <span ng-if="data.isExternal">&nbsp;</span>
                    <i ng-if="!data.isExternal && data.syncState.managedOnKick && data.syncState.overrides.skipQueue" class="fas fa-check" style="color: #53fc18;"></i>
                    <i ng-if="!data.isExternal && data.syncState.managedOnKick && !data.syncState.overrides.skipQueue" class="fas fa-times" style="color: #dc3545;"></i>
                    <span ng-if="!data.isExternal && !data.syncState.managedOnKick">&nbsp;</span>
                `
            },
            {
                name: "ENABLED",
                icon: "fa-toggle-on",
                headerStyles: {
                    'width': '100px',
                    'text-align': 'center'
                },
                cellStyles: {
                    'text-align': 'center'
                },
                cellTemplate: `
                    <span ng-if="data.isExternal">&nbsp;</span>
                    <i ng-if="!data.isExternal && data.syncState.managedOnKick && data.syncState.overrides.enabled !== false" class="fas fa-check" style="color: #53fc18;"></i>
                    <i ng-if="!data.isExternal && data.syncState.managedOnKick && data.syncState.overrides.enabled === false" class="fas fa-times" style="color: #dc3545;"></i>
                    <span ng-if="!data.isExternal && !data.syncState.managedOnKick">&nbsp;</span>
                `
            }
        ];

        const applyManagementStateToRewards = (rewards: any[], managementState: any) => {
            return rewards.map((reward) => {
                const management = managementState[reward.id] || { managedOnKick: false, overrides: {} };
                const overrides = management.overrides || {};
                return {
                    ...reward,
                    syncState: {
                        ...management,
                        overrides
                    }
                };
            });
        };

        const showErrorModal = (title: string, message: string, details?: string) => {
            utilityService.showModal({
                templateUrl: "kickErrorModal.html",
                size: "sm",
                controllerFunc: ($scope: any, $uibModalInstance: any) => {
                    $scope.title = title;
                    $scope.message = message;
                    $scope.details = details || "";

                    $scope.close = () => {
                        $uibModalInstance.close();
                    };
                }
            });
        };

        const showConfirmModal = (title: string, message: string): Promise<boolean> => {
            return new Promise((resolve) => {
                utilityService.showModal({
                    templateUrl: "kickConfirmModal.html",
                    size: "sm",
                    controllerFunc: ($scope: any, $uibModalInstance: any) => {
                        $scope.title = title;
                        $scope.message = message;

                        $scope.confirm = () => {
                            $uibModalInstance.close(true);
                        };

                        $scope.cancel = () => {
                            $uibModalInstance.dismiss();
                        };
                    },
                    closeCallback: (confirmed: boolean) => {
                        resolve(confirmed === true);
                    }
                });
            });
        };

        const showInfoModal = (title: string, message: string) => {
            utilityService.showModal({
                templateUrl: "kickInfoModal.html",
                size: "sm",
                controllerFunc: ($scope: any, $uibModalInstance: any) => {
                    $scope.title = title;
                    $scope.message = message;

                    $scope.close = () => {
                        $uibModalInstance.close();
                    };
                }
            });
        };

        $scope.showEditPropertiesModal = (item: any) => {
            const syncState = $scope.rewardsTab.syncState[item.id];
            if (!syncState || !syncState.managedOnKick) {
                return;
            }

            // Ensure overrides exists
            if (!syncState.overrides) {
                syncState.overrides = {};
            }

            utilityService.showModal({
                templateUrl: "editKickRewardPropertiesModal.html",
                size: "sm",
                controllerFunc: ($scope: any, $uibModalInstance: any, reward: any, syncState: any, kickBackendService: any, logger: any) => {
                    $scope.reward = reward;
                    $scope.cost = syncState.overrides.cost || reward.cost;
                    $scope.skipQueue = syncState.overrides.skipQueue || false;
                    $scope.enabled = syncState.overrides.enabled !== undefined ? syncState.overrides.enabled : true;

                    $scope.dismiss = () => {
                        $uibModalInstance.dismiss();
                    };

                    $scope.save = () => {
                        // Ensure overrides exists
                        if (!syncState.overrides) {
                            syncState.overrides = {};
                        }

                        syncState.overrides.cost = $scope.cost;
                        syncState.overrides.skipQueue = $scope.skipQueue;
                        syncState.overrides.enabled = $scope.enabled;

                        kickBackendService.updateRewardOverrides(reward.id, syncState.overrides).then(() => {
                            $uibModalInstance.close({ action: "save" });
                        }).catch((error: any) => {
                            logger.error("Failed to update overrides:", error);
                            $uibModalInstance.dismiss();
                        });
                    };
                },
                resolveObj: {
                    reward: () => item,
                    syncState: () => syncState
                },
                closeCallback: (response: any) => {
                    if (response && response.action === "save") {
                        $scope.loadRewards();
                    }
                }
            });
        };

        $scope.loadRewards = () => {
            $scope.rewardsTab.loading = true;

            try {
                channelRewardsService.loadChannelRewards();

                const manageable = channelRewardsService.channelRewards
                    .filter((r: any) => r.manageable)
                    .map((r: any) => ({
                        id: r.id,
                        title: r.twitchData.title,
                        cost: r.twitchData.cost
                    }));

                const state = kickUtilitiesService.normalizeManagementState(kickBackendService.getRewardManagementState());
                logger.debug("Loaded sync state:", state);
                logger.debug("Manageable rewards:", manageable);

                manageable.forEach((reward: any) => {
                    if (!state[reward.id]) {
                        state[reward.id] = {
                            managedOnKick: false,
                            firebotRewardTitle: reward.title,
                            overrides: {}
                        };
                    } else if (!state[reward.id].overrides) {
                        // Ensure overrides exists for synced rewards
                        state[reward.id].overrides = {};
                    }
                });

                // Fetch all Kick rewards to get external ones
                kickBackendService.getAllKickRewards().then((kickRewards: any[]) => {
                    const outsideFirebotRewards = kickRewards
                        .filter((r: any) => !r.isManaged)
                        .map((r: any) => ({
                            id: `outside-firebot-${r.id}`,
                            title: r.title,
                            cost: r.cost,
                            isExternal: true,
                            syncState: { managedOnKick: false, overrides: {} }
                        }));

                    $timeout(() => {
                        const normalizedState = kickUtilitiesService.normalizeManagementState(state);
                        $scope.rewardsTab.syncState = normalizedState;
                        $scope.rewardsTab.syncedCount = Object.values(normalizedState).filter((s: any) => s.managedOnKick).length;
                        $scope.rewardsTab.baseRewards = manageable;
                        $scope.rewardsTab.totalKickRewardsCount = kickRewards.length;
                        $scope.rewardsTab.outsideFirebotRewards = outsideFirebotRewards;
                        const firebotRewardsWithSync = applyManagementStateToRewards(manageable, normalizedState);
                        $scope.rewardsTab.firebotRewards = [...firebotRewardsWithSync, ...outsideFirebotRewards];
                        $scope.rewardsTab.loading = false;
                        logger.debug("Final sync state after load:", $scope.rewardsTab.syncState);
                        logger.debug("Synced count:", $scope.rewardsTab.syncedCount);
                        logger.debug("Total Kick rewards:", $scope.rewardsTab.totalKickRewardsCount);
                    });
                }).catch((error: any) => {
                    logger.error("Failed to load Kick rewards:", error);
                    $timeout(() => {
                        const normalizedState = kickUtilitiesService.normalizeManagementState(state);
                        $scope.rewardsTab.syncState = normalizedState;
                        $scope.rewardsTab.syncedCount = Object.values(normalizedState).filter((s: any) => s.managedOnKick).length;
                        $scope.rewardsTab.baseRewards = manageable;
                        $scope.rewardsTab.firebotRewards = applyManagementStateToRewards(manageable, normalizedState);
                        $scope.rewardsTab.loading = false;
                    });
                });
            } catch (error: any) {
                logger.error("Failed to load rewards:", error);
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                    showErrorModal("Load Rewards Failed", "Failed to load rewards", error?.message);
                });
            }
        };

        $scope.reconcileRewards = () => {
            $scope.rewardsTab.loading = true;
            kickBackendService.reconcileRewards().then(() => {
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                    $scope.loadRewards();
                });
            }).catch((error: any) => {
                logger.error("Failed to reconcile rewards:", error);
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                    showErrorModal("Reconcile Failed", error?.message || "Failed to reconcile rewards", error?.details);
                });
            });
        };

        $scope.manageReward = (rewardId: string) => {
            $scope.rewardsTab.loading = true;
            kickBackendService.manageReward(rewardId).then(() => {
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                });
            }).catch((error: any) => {
                logger.error("Failed to manage reward:", error);
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                    const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                    showErrorModal("Manage Reward Failed", error?.message || "Failed to manage reward in Kick", `${error?.message || ""}${statusMsg}`);
                });
            });
        };

        $scope.unmanageReward = (rewardId: string) => {
            showConfirmModal(
                "Stop Managing Reward",
                "This will delete the reward on Kick but keep it in Firebot."
            ).then((confirmed) => {
                if (!confirmed) {
                    return;
                }

                $scope.rewardsTab.loading = true;
                kickBackendService.unmanageReward(rewardId).then(() => {
                    $timeout(() => {
                        $scope.rewardsTab.loading = false;
                    });
                }).catch((error: any) => {
                    logger.error("Failed to unmanage reward:", error);
                    $timeout(() => {
                        $scope.rewardsTab.loading = false;
                        const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                        showErrorModal("Remove Reward Failed", error?.message || "Failed to remove reward from Kick", `${error?.message || ""}${statusMsg}`);
                    });
                });
            });
        };

        $scope.updateOverrides = (rewardId: string) => {
            const overrides = $scope.rewardsTab.syncState[rewardId]?.overrides;
            if (!overrides) {
                return;
            }

            kickBackendService.updateRewardOverrides(rewardId, overrides).catch((error: any) => {
                logger.error("Failed to update overrides:", error);
                $timeout(() => {
                    const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                    showErrorModal("Update Overrides Failed", error?.message || "Failed to update reward overrides", `${error?.message || ""}${statusMsg}`);
                });
            });
        };

        $scope.resyncReward = (rewardId: string) => {
            $scope.rewardsTab.loading = true;
            kickBackendService.resyncReward(rewardId).then(() => {
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                });
            }).catch((error: any) => {
                logger.error("Failed to re-sync reward:", error);
                $timeout(() => {
                    $scope.rewardsTab.loading = false;
                    const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                    showErrorModal("Re-sync Failed", error?.message || "Failed to re-sync reward to Kick", `${error?.message || ""}${statusMsg}`);
                });
            });
        };

        $scope.syncAllRewards = () => {
            showConfirmModal(
                "Sync All Rewards",
                "Sync all managed rewards to Kick with current Firebot settings?"
            ).then((confirmed) => {
                if (!confirmed) {
                    return;
                }

                $scope.rewardsTab.loading = true;
                kickBackendService.syncAllRewards().then((result: any) => {
                    $timeout(() => {
                        $scope.rewardsTab.loading = false;
                        let message = `Unchanged: ${result.unchanged}, Updated: ${result.updated}`;
                        if (result.failed > 0) {
                            message += `, Failed: ${result.failed}`;
                        }
                        showInfoModal("Sync Complete", message);
                    });
                }).catch((error: any) => {
                    logger.error("Failed to sync all rewards:", error);
                    $timeout(() => {
                        $scope.rewardsTab.loading = false;
                        const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                        showErrorModal("Sync All Rewards Failed", error?.message || "Failed to sync all rewards to Kick", `${error?.message || ""}${statusMsg}`);
                    });
                });
            });
        };

        $scope.rewardMenuOptions = (item: any) => {
            // Outside Firebot rewards have no menu options and no menu button
            if (item.isExternal) {
                return null;
            }

            const isSynced = $scope.rewardsTab.syncState[item.id]?.managedOnKick;
            const options = [];

            if (isSynced) {
                options.push({
                    html: `<a href><i class="far fa-pen" style="margin-right: 10px;"></i> Edit Kick Properties</a>`,
                    click: function () {
                        $scope.showEditPropertiesModal(item);
                    },
                    enabled: !$scope.rewardsTab.loading
                });
                options.push({
                    html: `<a href><i class="far fa-sync" style="margin-right: 10px;"></i> Re-sync</a>`,
                    click: function () {
                        $scope.resyncReward(item.id);
                    },
                    enabled: !$scope.rewardsTab.loading
                });
            }

            if (!isSynced) {
                options.push({
                    html: `<a href><i class="far fa-sync" style="margin-right: 10px;"></i> Start Managing in Kick</a>`,
                    click: function () {
                        $scope.manageReward(item.id);
                    },
                    enabled: $scope.rewardsTab.totalKickRewardsCount < 15 && !$scope.rewardsTab.loading
                });
            } else {
                options.push({
                    html: `<a href style="color: #fb7373;"><i class="far fa-times" style="margin-right: 10px;"></i> Stop Managing in Kick</a>`,
                    click: function () {
                        $scope.unmanageReward(item.id);
                    },
                    enabled: !$scope.rewardsTab.loading
                });
            }

            return options;
        };

        kickBackendService.onRewardManagementStateUpdated((state: any) => {
            $timeout(() => {
                const normalizedState = kickUtilitiesService.normalizeManagementState(state);
                $scope.rewardsTab.syncState = normalizedState;
                const firebotRewardsWithSync = applyManagementStateToRewards(
                    $scope.rewardsTab.baseRewards || [],
                    normalizedState
                );
                $scope.rewardsTab.firebotRewards = [...firebotRewardsWithSync, ...($scope.rewardsTab.outsideFirebotRewards || [])];
                const syncedCount: number = Object.values(normalizedState).filter((s: any) => s.managedOnKick).length;
                $scope.rewardsTab.syncedCount = syncedCount;
                const externalCount: number = ($scope.rewardsTab.outsideFirebotRewards || []).length;
                $scope.rewardsTab.totalKickRewardsCount = syncedCount + externalCount;
            });
        });

        kickBackendService.onRewardManagementError((error: any) => {
            logger.error("Kick Reward Management Error:", error.message);
            $timeout(() => {
                $scope.rewardsTab.loading = false;
                const statusMsg = error?.status ? ` (HTTP ${error.status})` : "";
                showErrorModal("Reward Management Error", error?.message || "An error occurred while managing rewards", `${error?.details || ""}${statusMsg}`);
            });
        });

        kickBackendService.onChannelRewardsUpdated(() => {
            if ($scope.activeTab === "rewards") {
                $scope.loadRewards();
            }
        });

        // Initial load for rewards tab
        $scope.$watch("activeTab", (newVal: string) => {
            if (newVal === "rewards") {
                $scope.loadRewards();
            }
        });

        const maybeCloseAuthModal = (connectionData?: any) => {
            if (!$scope.currentAuthType || !authModalCloser) {
                return;
            }

            const data = connectionData || $scope.connections;
            const authReady = $scope.currentAuthType === "streamer"
                ? data.streamer.ready
                : data.bot.ready;

            if (authReady) {
                authModalCloser();
            }
        };
    },
    type: "angularjs",
    icon: "fa-plug",
    template: loadTemplate()
};

export const kickExtension: UIExtension = {
    id: "kick-extension",
    pages: [kickIntegrationPage],
    providers: {
        factories: [kickBackendService, kickUtilitiesService]
    }
};
