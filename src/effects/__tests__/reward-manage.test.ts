import { rewardManageEffect } from '../reward-manage';

type StringUpdatable = { update: boolean; newValue: string };
type BooleanUpdatable = { update: boolean; newValue: boolean };

type RewardManageParams = {
    rewardId: string;
    action: "manage" | "unmanage";
    rewardName?: string;
    rewardSettings: {
        cost: StringUpdatable;
        enabled: BooleanUpdatable;
        skipQueue: BooleanUpdatable;
    };
};

jest.mock('../../integration', () => ({
    integration: {
        getKickRewardsState: jest.fn(),
        kick: {
            rewardsManager: {
                deleteReward: jest.fn(),
                getAllRewards: jest.fn(),
                createReward: jest.fn(),
                updateReward: jest.fn()
            }
        }
    }
}));

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../internal/reflector', () => ({
    reflectEvent: jest.fn()
}));

const { integration } = require('../../integration');
const { logger } = require('../../main');
const { reflectEvent } = require('../../internal/reflector');

describe('rewardManageEffect.onTriggerEvent', () => {
    let mockState: any;
    let mockManagementData: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockManagementData = {
            managedOnKick: false,
            kickRewardId: undefined,
            firebotRewardTitle: undefined,
            overrides: {}
        };

        mockState = {
            getManagementData: jest.fn(() => mockManagementData),
            setManagementData: jest.fn(),
            removeManagementData: jest.fn(),
            canManageMore: jest.fn(async () => true)
        };

        integration.getKickRewardsState.mockReturnValue(mockState);
    });

    describe('unmanage action', () => {
        it('successfully unmanages a reward that is managed on Kick', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);
            integration.kick.rewardsManager.deleteReward.mockResolvedValue(true);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'unmanage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: false, newValue: "1" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.deleteReward).toHaveBeenCalledWith('kick-reward-123');
            expect(mockState.removeManagementData).toHaveBeenCalledWith('firebot-reward-1');
            expect(result).toBe(true);
        });

        it('returns true when trying to unmanage already unmanaged reward', async () => {
            mockManagementData = {
                managedOnKick: false,
                kickRewardId: undefined,
                firebotRewardTitle: undefined,
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'unmanage',
                rewardSettings: {
                    cost: { update: false, newValue: "1" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.deleteReward).not.toHaveBeenCalled();
            expect(result).toBe(true);
        });

        it('returns false when delete API call fails', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);
            integration.kick.rewardsManager.deleteReward.mockResolvedValue(false);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'unmanage',
                rewardSettings: {
                    cost: { update: false, newValue: "1" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.deleteReward).toHaveBeenCalledWith('kick-reward-123');
            expect(mockState.removeManagementData).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });

    describe('manage action - create new reward', () => {
        const mockFirebotReward = {
            id: 'firebot-reward-1',
            title: 'Test Reward',
            cost: 500,
            isEnabled: true,
            shouldRedemptionsSkipRequestQueue: false,
            backgroundColor: '#FF0000',
            prompt: 'Test prompt',
            isUserInputRequired: false
        };

        beforeEach(() => {
            mockManagementData = {
                managedOnKick: false,
                kickRewardId: undefined,
                firebotRewardTitle: undefined,
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);
            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.getAllRewards.mockResolvedValue([]);
        });

        it('creates new reward with upstream Firebot values when no overrides specified', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                mockFirebotReward,
                {
                    cost: 500,
                    skipQueue: false,
                    enabled: true
                }
            );
            expect(mockState.setManagementData).toHaveBeenCalledWith(
                'firebot-reward-1',
                expect.objectContaining({
                    managedOnKick: true,
                    kickRewardId: 'kick-reward-123',
                    firebotRewardTitle: 'Test Reward',
                    overrides: {
                        cost: 500,
                        skipQueue: false,
                        enabled: true
                    }
                })
            );
            expect(result).toBe(true);
        });

        it('passes backgroundColor and isUserInputRequired from Firebot reward', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                expect.objectContaining({
                    backgroundColor: '#FF0000',
                    isUserInputRequired: false
                }),
                expect.any(Object)
            );
            expect(result).toBe(true);
        });

        it('creates new reward with override cost', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "1000" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                mockFirebotReward,
                {
                    cost: 1000,
                    skipQueue: false,
                    enabled: true
                }
            );
            expect(result).toBe(true);
        });

        it('creates new reward with override skipQueue', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: false, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: true, newValue: true }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                mockFirebotReward,
                {
                    cost: 500,
                    skipQueue: true,
                    enabled: true
                }
            );
            expect(result).toBe(true);
        });

        it('creates new reward with override enabled', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: false, newValue: "500" },
                    enabled: { update: true, newValue: false },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                mockFirebotReward,
                {
                    cost: 500,
                    skipQueue: false,
                    enabled: false
                }
            );
            expect(result).toBe(true);
        });

        it('creates new reward with all overrides', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue({
                id: 'kick-reward-123',
                title: 'Test Reward'
            });

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "2000" },
                    enabled: { update: true, newValue: false },
                    skipQueue: { update: true, newValue: true }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalledWith(
                mockFirebotReward,
                {
                    cost: 2000,
                    skipQueue: true,
                    enabled: false
                }
            );
            expect(result).toBe(true);
        });

        it('returns false when Firebot reward not found', async () => {
            reflectEvent.mockResolvedValue([]);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot manage reward firebot-reward-1: Firebot reward not found.'
            );
            expect(integration.kick.rewardsManager.createReward).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false when create API call fails', async () => {
            integration.kick.rewardsManager.createReward.mockResolvedValue(null);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.createReward).toHaveBeenCalled();
            expect(mockState.setManagementData).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false when Kick limit reached and reward is not already managed', async () => {
            mockState.canManageMore.mockResolvedValue(false);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot manage reward: Kick limit of 15 rewards reached.'
            );
            expect(integration.kick.rewardsManager.createReward).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('allows create if Kick limit reached but reward already managed', async () => {
            mockState.canManageMore.mockResolvedValue(false);
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Test Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalled();
            expect(result).toBe(true);
        });
    });

    describe('manage action - update existing reward', () => {
        const mockFirebotReward = {
            id: 'firebot-reward-1',
            title: 'Updated Reward',
            cost: 750,
            isEnabled: false,
            shouldRedemptionsSkipRequestQueue: true,
            backgroundColor: '#00FF00',
            prompt: 'Updated prompt',
            isUserInputRequired: true
        };

        beforeEach(() => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Old Title',
                overrides: { cost: 500, skipQueue: false, enabled: true }
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);
            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.getAllRewards.mockResolvedValue([]);
        });

        it('updates existing reward with no overrides using upstream values', async () => {
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Updated Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "750" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    cost: 750,
                    skipQueue: true,
                    enabled: false
                }
            );
            expect(mockState.setManagementData).toHaveBeenCalledWith(
                'firebot-reward-1',
                expect.objectContaining({
                    kickRewardId: 'kick-reward-123',
                    firebotRewardTitle: 'Updated Reward',
                    overrides: {
                        cost: 750,
                        skipQueue: true,
                        enabled: false
                    }
                })
            );
            expect(result).toBe(true);
        });

        it('passes backgroundColor and isUserInputRequired from Firebot reward on update', async () => {
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Updated Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "750" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                expect.objectContaining({
                    backgroundColor: '#00FF00',
                    isUserInputRequired: true
                }),
                expect.any(Object)
            );
            expect(result).toBe(true);
        });

        it('updates existing reward with override cost', async () => {
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Updated Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "1500" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    cost: 1500,
                    skipQueue: true,
                    enabled: false
                }
            );
            expect(result).toBe(true);
        });

        it('returns false when update API call fails', async () => {
            integration.kick.rewardsManager.updateReward.mockResolvedValue(false);

            const effect: RewardManageParams = {
                rewardId: 'firebot-reward-1',
                action: 'manage',
                rewardName: 'Updated Reward',
                rewardSettings: {
                    cost: { update: true, newValue: "750" },
                    enabled: { update: false, newValue: true },
                    skipQueue: { update: false, newValue: false }
                }
            };

            const result = await rewardManageEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalled();
            expect(mockState.setManagementData).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });
    });
});
