import { rewardEnableDisableEffect } from '../reward-enable-disable';

type RewardEnableDisableParams = {
    rewardId: string;
    action: "enable" | "disable";
    rewardName?: string;
};

jest.mock('../../integration', () => ({
    integration: {
        getKickRewardsState: jest.fn(),
        kick: {
            rewardsManager: {
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

describe('rewardEnableDisableEffect.onTriggerEvent', () => {
    let mockState: any;
    let mockManagementData: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockManagementData = {
            managedOnKick: true,
            kickRewardId: 'kick-reward-123',
            firebotRewardTitle: 'Test Reward',
            overrides: { cost: 500, skipQueue: false, enabled: true }
        };

        mockState = {
            getManagementData: jest.fn(() => mockManagementData),
            setManagementData: jest.fn()
        };

        integration.getKickRewardsState.mockReturnValue(mockState);
    });

    describe('enable action', () => {
        it('successfully enables a managed reward', async () => {
            const mockFirebotReward = {
                id: 'firebot-reward-1',
                title: 'Test Reward',
                cost: 500,
                isEnabled: false,
                shouldRedemptionsSkipRequestQueue: false,
                backgroundColor: '#FF0000',
                prompt: 'Test prompt',
                isUserInputRequired: false
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable',
                rewardName: 'Test Reward'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(reflectEvent).toHaveBeenCalledWith('get-channel-rewards', {});
            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
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

        it('preserves existing overrides when enabling', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 1000, skipQueue: true, enabled: false }
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

            const mockFirebotReward = {
                id: 'firebot-reward-1',
                title: 'Test Reward',
                cost: 500,
                isEnabled: false,
                shouldRedemptionsSkipRequestQueue: false,
                backgroundColor: '#FF0000',
                prompt: 'Test prompt',
                isUserInputRequired: false
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    cost: 1000,
                    skipQueue: true,
                    enabled: true
                }
            );
            expect(result).toBe(true);
        });
    });

    describe('disable action', () => {
        it('successfully disables a managed reward', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 500, skipQueue: false, enabled: true }
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

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

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'disable',
                rewardName: 'Test Reward'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    cost: 500,
                    skipQueue: false,
                    enabled: false
                }
            );
            expect(mockState.setManagementData).toHaveBeenCalledWith(
                'firebot-reward-1',
                expect.objectContaining({
                    overrides: {
                        cost: 500,
                        skipQueue: false,
                        enabled: false
                    }
                })
            );
            expect(result).toBe(true);
        });

        it('preserves existing overrides when disabling', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 2000, skipQueue: true, enabled: true }
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

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

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'disable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    cost: 2000,
                    skipQueue: true,
                    enabled: false
                }
            );
            expect(result).toBe(true);
        });
    });

    describe('error cases', () => {
        it('returns false and logs error when reward is not managed on Kick', async () => {
            mockManagementData = {
                managedOnKick: false,
                kickRewardId: undefined,
                firebotRewardTitle: undefined,
                overrides: {}
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot enable reward firebot-reward-1: It is not managed in Kick.'
            );
            expect(integration.kick.rewardsManager.updateReward).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false and logs error when management data is missing', async () => {
            mockState.getManagementData.mockReturnValue(undefined);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'disable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot disable reward firebot-reward-1: It is not managed in Kick.'
            );
            expect(integration.kick.rewardsManager.updateReward).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false and logs error when Firebot reward not found', async () => {
            reflectEvent.mockResolvedValue([]);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot enable reward firebot-reward-1: Firebot reward not found.'
            );
            expect(integration.kick.rewardsManager.updateReward).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('returns false and logs error when update API call fails', async () => {
            const mockFirebotReward = {
                id: 'firebot-reward-1',
                title: 'Test Reward',
                cost: 500,
                isEnabled: false,
                shouldRedemptionsSkipRequestQueue: false,
                backgroundColor: '#FF0000',
                prompt: 'Test prompt',
                isUserInputRequired: false
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(false);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalled();
            expect(mockState.setManagementData).not.toHaveBeenCalled();
            expect(result).toBe(false);
        });

        it('handles missing Firebot reward in array when searching by ID', async () => {
            const mockFirebotReward = {
                id: 'firebot-reward-2',
                title: 'Wrong Reward',
                cost: 500
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(logger.error).toHaveBeenCalledWith(
                'Cannot enable reward firebot-reward-1: Firebot reward not found.'
            );
            expect(result).toBe(false);
        });

        it('creates empty overrides object if not present', async () => {
            mockManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-reward-123',
                firebotRewardTitle: 'Test Reward'
                // Note: no overrides property
            };
            mockState.getManagementData.mockReturnValue(mockManagementData);

            const mockFirebotReward = {
                id: 'firebot-reward-1',
                title: 'Test Reward',
                cost: 500,
                isEnabled: false,
                shouldRedemptionsSkipRequestQueue: false,
                backgroundColor: '#FF0000',
                prompt: 'Test prompt',
                isUserInputRequired: false
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            const result = await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(integration.kick.rewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-reward-123',
                mockFirebotReward,
                {
                    enabled: true
                }
            );
            expect(result).toBe(true);
        });
    });

    describe('debug logging', () => {
        it('logs debug messages during execution', async () => {
            const mockFirebotReward = {
                id: 'firebot-reward-1',
                title: 'Test Reward',
                cost: 500,
                isEnabled: false,
                shouldRedemptionsSkipRequestQueue: false,
                backgroundColor: '#FF0000',
                prompt: 'Test prompt',
                isUserInputRequired: false
            };

            reflectEvent.mockResolvedValue([mockFirebotReward]);
            integration.kick.rewardsManager.updateReward.mockResolvedValue(true);

            const effect: RewardEnableDisableParams = {
                rewardId: 'firebot-reward-1',
                action: 'enable'
            };

            await rewardEnableDisableEffect.onTriggerEvent({ effect } as any);

            expect(logger.debug).toHaveBeenCalledWith(
                'Fetching Firebot reward data for reward ID: firebot-reward-1'
            );
            expect(logger.debug).toHaveBeenCalledWith(
                expect.stringContaining('Received Firebot reward data:')
            );
        });
    });
});
