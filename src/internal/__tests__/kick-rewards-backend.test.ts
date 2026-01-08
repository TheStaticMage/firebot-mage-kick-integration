/* eslint-disable @typescript-eslint/unbound-method */
import { FirebotCustomReward, KickRewardManagementData } from '../../shared/types';
import { KickRewardsBackend } from '../kick-rewards-backend';

jest.mock('../../main', () => ({
    firebot: {
        modules: {
            frontendCommunicator: {
                on: jest.fn(),
                onAsync: jest.fn(),
                send: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

const mockKickRewardsState = {
    getAllManagementData: jest.fn(),
    getManagementData: jest.fn(),
    setManagementData: jest.fn(),
    removeManagementData: jest.fn(),
    canManageMore: jest.fn()
};

jest.mock('../../integration-singleton', () => ({
    integration: {
        getKickRewardsState: jest.fn(() => mockKickRewardsState),
        kick: {
            rewardsManager: {
                getAllRewards: jest.fn(),
                createReward: jest.fn(),
                updateReward: jest.fn(),
                deleteReward: jest.fn()
            }
        }
    }
}));

jest.mock('../reflector', () => ({
    reflectEvent: jest.fn()
}));

import { integration } from '../../integration-singleton';
import { firebot, logger } from '../../main';
import { reflectEvent } from '../reflector';

const mockFrontendCommunicator = firebot.modules.frontendCommunicator as jest.Mocked<typeof firebot.modules.frontendCommunicator>;
const mockLogger = logger as jest.Mocked<typeof logger>;
const mockRewardsManager = integration.kick.rewardsManager as jest.Mocked<typeof integration.kick.rewardsManager>;
const mockReflectEvent = reflectEvent as jest.MockedFunction<typeof reflectEvent>;

describe('KickRewardsBackend', () => {
    let backend: KickRewardsBackend;
    let registeredHandlers: Map<string, any>;

    beforeEach(() => {
        jest.clearAllMocks();
        registeredHandlers = new Map();

        (mockFrontendCommunicator.on as jest.Mock).mockImplementation((event: string, handler: any) => {
            registeredHandlers.set(event, handler);
        });

        (mockFrontendCommunicator.onAsync as jest.Mock).mockImplementation((event: string, handler: any) => {
            registeredHandlers.set(event, handler);
        });

        backend = new KickRewardsBackend();
        backend.registerHandlers();
    });

    const createMockFirebotReward = (overrides?: Partial<FirebotCustomReward>): any => {
        const twitchData = {
            id: 'fb-reward-1',
            title: 'Test Reward',
            cost: 100,
            prompt: 'Test prompt',
            backgroundColor: '#9147FF',
            isEnabled: true,
            isPaused: false,
            isUserInputRequired: false,
            shouldRedemptionsSkipRequestQueue: false,
            ...overrides
        };
        return {
            id: twitchData.id,
            twitchData
        };
    };

    /* eslint-disable camelcase */
    const createMockKickReward = (overrides?: Partial<any>): any => ({
        id: 'kick-123',
        title: 'Test Reward',
        description: 'Test description',
        cost: 100,
        background_color: '#9147FF',
        is_enabled: true,
        is_paused: false,
        is_user_input_required: false,
        should_redemptions_skip_request_queue: false,
        ...overrides
    });
    /* eslint-enable camelcase */

    describe('registerHandlers', () => {
        it('registers all required handlers', () => {
            expect(mockFrontendCommunicator.on).toHaveBeenCalledWith('kick:get-reward-management-state', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:get-all-kick-rewards', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:manage-reward', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:unmanage-reward', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:refresh-kick-rewards', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:update-reward-overrides', expect.any(Function));
            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:reconcile-rewards', expect.any(Function));
        });
    });

    describe('kick:get-reward-management-state', () => {
        it('returns all management data', () => {
            const mockData = {
                'reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Test Reward',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockKickRewardsState.getAllManagementData.mockReturnValue(mockData);

            const handler = registeredHandlers.get('kick:get-reward-management-state');
            const result = handler();

            expect(result).toEqual(mockData);
            expect(mockKickRewardsState.getAllManagementData).toHaveBeenCalled();
        });
    });

    describe('kick:get-all-kick-rewards', () => {
        it('returns all rewards with managed status', async () => {
            const kickRewards = [
                createMockKickReward({ id: 'kick-1', title: 'Reward 1', cost: 100 }),
                createMockKickReward({ id: 'kick-2', title: 'Reward 2', cost: 200 }),
                createMockKickReward({ id: 'kick-3', title: 'Reward 3', cost: 300 })
            ];

            const managementState = {
                'fb-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-1',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockRewardsManager.getAllRewards.mockResolvedValue(kickRewards);
            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);

            const handler = registeredHandlers.get('kick:get-all-kick-rewards');
            const result = await handler();

            expect(result).toEqual([
                { id: 'kick-1', title: 'Reward 1', cost: 100, isManaged: true, isEnabled: true, isPaused: false },
                { id: 'kick-2', title: 'Reward 2', cost: 200, isManaged: false, isEnabled: true, isPaused: false },
                { id: 'kick-3', title: 'Reward 3', cost: 300, isManaged: false, isEnabled: true, isPaused: false }
            ]);
        });

        it('returns cached data on API failure', async () => {
            mockRewardsManager.getAllRewards
                .mockResolvedValueOnce([
                    createMockKickReward({ id: 'kick-1', title: 'Reward 1', cost: 100 }),
                    createMockKickReward({ id: 'kick-2', title: 'Cached Reward', cost: 200 })
                ])
                .mockResolvedValueOnce(null);

            mockKickRewardsState.getAllManagementData.mockReturnValue({
                'fb-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-1',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            });

            const handler = registeredHandlers.get('kick:get-all-kick-rewards');

            await handler();
            const result = await handler();

            expect(result).toEqual([
                { id: 'kick-2', title: 'Cached Reward', cost: 200, isManaged: false, isEnabled: true, isPaused: false }
            ]);
        });

        it('returns empty array when no rewards and no cache', async () => {
            mockRewardsManager.getAllRewards.mockResolvedValue(null);
            mockKickRewardsState.getAllManagementData.mockReturnValue({});

            const handler = registeredHandlers.get('kick:get-all-kick-rewards');
            const result = await handler();

            expect(result).toEqual([]);
        });

        it('handles error and returns cached data', async () => {
            mockRewardsManager.getAllRewards.mockRejectedValue(new Error('API error'));

            const handler = registeredHandlers.get('kick:get-all-kick-rewards');
            const result = await handler();

            expect(result).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error getting all Kick rewards'));
        });
    });

    describe('kick:manage-reward', () => {
        it('creates reward and saves management data', async () => {
            const firebotReward = createMockFirebotReward();
            const kickReward = createMockKickReward();

            mockKickRewardsState.canManageMore.mockResolvedValue(true);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.createReward.mockResolvedValue(kickReward);

            const handler = registeredHandlers.get('kick:manage-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockKickRewardsState.canManageMore).toHaveBeenCalled();
            expect(mockReflectEvent).toHaveBeenCalledWith('get-channel-rewards', {}, false);
            expect(mockRewardsManager.createReward).toHaveBeenCalledWith(
                firebotReward.twitchData,
                expect.objectContaining({ cost: 100, skipQueue: false, enabled: true })
            );
            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Test Reward'
                })
            );
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-state-updated',
                expect.any(Object)
            );
        });

        it('creates reward with overrides', async () => {
            const firebotReward = createMockFirebotReward();
            const kickReward = createMockKickReward({ cost: 500 });
            const overrides = { cost: 500, skipQueue: true, enabled: false };

            mockKickRewardsState.canManageMore.mockResolvedValue(true);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.createReward.mockResolvedValue(kickReward);

            const handler = registeredHandlers.get('kick:manage-reward');
            await handler({ firebotRewardId: 'fb-reward-1', overrides });

            expect(mockRewardsManager.createReward).toHaveBeenCalledWith(
                firebotReward.twitchData,
                expect.objectContaining({ cost: 500, skipQueue: true, enabled: false })
            );
        });

        it('throws error when at 15 reward limit', async () => {
            mockKickRewardsState.canManageMore.mockResolvedValue(false);

            const handler = registeredHandlers.get('kick:manage-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('Maximum of 15 Kick rewards');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.objectContaining({
                    message: expect.stringContaining('Maximum of 15 Kick rewards')
                })
            );
        });

        it('throws error when Firebot reward not found', async () => {
            mockKickRewardsState.canManageMore.mockResolvedValue(true);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:manage-reward');

            await expect(handler({ firebotRewardId: 'non-existent' })).rejects.toThrow('not found');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });

        it('throws error when Kick API fails', async () => {
            const firebotReward = createMockFirebotReward();

            mockKickRewardsState.canManageMore.mockResolvedValue(true);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.createReward.mockResolvedValue(null);

            const handler = registeredHandlers.get('kick:manage-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('Failed to create reward');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });
    });

    describe('kick:unmanage-reward', () => {
        it('deletes reward and removes management data', async () => {
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockRewardsManager.deleteReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:unmanage-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockRewardsManager.deleteReward).toHaveBeenCalledWith('kick-123');
            expect(mockKickRewardsState.removeManagementData).toHaveBeenCalledWith('fb-reward-1');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-state-updated',
                expect.any(Object)
            );
        });

        it('removes state when already unmanaged', async () => {
            mockKickRewardsState.getManagementData.mockReturnValue(null);

            const handler = registeredHandlers.get('kick:unmanage-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockRewardsManager.deleteReward).not.toHaveBeenCalled();
            expect(mockKickRewardsState.removeManagementData).toHaveBeenCalledWith('fb-reward-1');
        });

        it('removes state when missing kickRewardId', async () => {
            mockKickRewardsState.getManagementData.mockReturnValue({
                managedOnKick: true,
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            });

            const handler = registeredHandlers.get('kick:unmanage-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockRewardsManager.deleteReward).not.toHaveBeenCalled();
            expect(mockKickRewardsState.removeManagementData).toHaveBeenCalledWith('fb-reward-1');
        });

        it('removes state even when Kick deletion fails', async () => {
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockRewardsManager.deleteReward.mockResolvedValue(false);

            const handler = registeredHandlers.get('kick:unmanage-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to delete reward'));
            expect(mockKickRewardsState.removeManagementData).toHaveBeenCalledWith('fb-reward-1');
        });

        it('sends error on exception', async () => {
            mockKickRewardsState.getManagementData.mockImplementation(() => {
                throw new Error('State error');
            });

            const handler = registeredHandlers.get('kick:unmanage-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('State error');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });
    });

    describe('kick:refresh-kick-rewards', () => {
        it('returns rewards from API', async () => {
            const mockRewards = [
                createMockKickReward({ id: 'kick-1', title: 'Reward 1', cost: 100 }),
                createMockKickReward({ id: 'kick-2', title: 'Reward 2', cost: 200 })
            ];

            mockRewardsManager.getAllRewards.mockResolvedValue(mockRewards);

            const handler = registeredHandlers.get('kick:refresh-kick-rewards');
            const result = await handler();

            expect(result).toEqual(mockRewards);
        });

        it('returns empty array on API failure', async () => {
            mockRewardsManager.getAllRewards.mockResolvedValue(null);

            const handler = registeredHandlers.get('kick:refresh-kick-rewards');
            const result = await handler();

            expect(result).toEqual([]);
        });

        it('returns empty array on error', async () => {
            mockRewardsManager.getAllRewards.mockRejectedValue(new Error('API error'));

            const handler = registeredHandlers.get('kick:refresh-kick-rewards');
            const result = await handler();

            expect(result).toEqual([]);
            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Error refreshing'));
        });
    });

    describe('kick:update-reward-overrides', () => {
        it('updates reward and saves new overrides', async () => {
            const firebotReward = createMockFirebotReward();
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:update-reward-overrides');
            await handler({
                firebotRewardId: 'fb-reward-1',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            });

            expect(mockRewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-123',
                {
                    ...firebotReward.twitchData,
                    isPaused: false
                },
                expect.objectContaining({ cost: 200, skipQueue: true, enabled: false, paused: false })
            );
            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({
                    overrides: { cost: 200, skipQueue: true, enabled: false, paused: false }
                })
            );
        });

        it('throws error when reward not managed', async () => {
            mockKickRewardsState.getManagementData.mockReturnValue(null);

            const handler = registeredHandlers.get('kick:update-reward-overrides');

            await expect(handler({
                firebotRewardId: 'fb-reward-1',
                overrides: { cost: 200 }
            })).rejects.toThrow('not managed on Kick');

            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });

        it('throws error when Firebot reward not found', async () => {
            mockKickRewardsState.getManagementData.mockReturnValue({
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            });
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:update-reward-overrides');

            await expect(handler({
                firebotRewardId: 'fb-reward-1',
                overrides: { cost: 200 }
            })).rejects.toThrow('not found');
        });

        it('throws error when Kick API fails', async () => {
            const firebotReward = createMockFirebotReward();
            mockKickRewardsState.getManagementData.mockReturnValue({
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            });
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.updateReward.mockResolvedValue(false);

            const handler = registeredHandlers.get('kick:update-reward-overrides');

            await expect(handler({
                firebotRewardId: 'fb-reward-1',
                overrides: { cost: 200 }
            })).rejects.toThrow('Failed to update reward');
        });
    });

    describe('kick:resync-reward', () => {
        it('successfully re-syncs a managed reward', async () => {
            const firebotReward = createMockFirebotReward();
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Old Title',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.deleteReward.mockResolvedValue(true);
            mockRewardsManager.createReward.mockResolvedValue(createMockKickReward({ id: 'kick-new-456', cost: 200 }));

            const handler = registeredHandlers.get('kick:resync-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockRewardsManager.deleteReward).toHaveBeenCalledWith('kick-123');
            expect(mockRewardsManager.createReward).toHaveBeenCalledWith(
                firebotReward.twitchData,
                managementData.overrides
            );
            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({ kickRewardId: 'kick-new-456' })
            );
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-state-updated',
                expect.any(Object)
            );
        });

        it('updates reward title if changed', async () => {
            const firebotReward = createMockFirebotReward({ title: 'New Title' });
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Old Title',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.deleteReward.mockResolvedValue(true);
            mockRewardsManager.createReward.mockResolvedValue(createMockKickReward({ id: 'kick-new-456', title: 'New Title', cost: 200 }));

            const handler = registeredHandlers.get('kick:resync-reward');
            await handler({ firebotRewardId: 'fb-reward-1' });

            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({ firebotRewardTitle: 'New Title' })
            );
        });

        it('throws error when reward is not managed', async () => {
            mockKickRewardsState.getManagementData.mockReturnValue({
                managedOnKick: false,
                firebotRewardTitle: 'Test Reward',
                overrides: {}
            });

            const handler = registeredHandlers.get('kick:resync-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('not managed on Kick');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });

        it('throws error when Firebot reward not found', async () => {
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:resync-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('not found');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });

        it('throws error when API create fails', async () => {
            const firebotReward = createMockFirebotReward();
            const managementData: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            };

            mockKickRewardsState.getManagementData.mockReturnValue(managementData);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.deleteReward.mockResolvedValue(true);
            mockRewardsManager.createReward.mockResolvedValue(null);

            const handler = registeredHandlers.get('kick:resync-reward');

            await expect(handler({ firebotRewardId: 'fb-reward-1' })).rejects.toThrow('Failed to re-create');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });
    });

    describe('kick:sync-all-rewards', () => {
        it('successfully syncs all managed rewards', async () => {
            const firebotReward1 = createMockFirebotReward({ id: 'fb-reward-1', title: 'Reward 1' });
            const firebotReward2 = createMockFirebotReward({ id: 'fb-reward-2', title: 'Reward 2', isEnabled: true });

            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true, paused: false }
                },
                'fb-reward-2': {
                    managedOnKick: true,
                    kickRewardId: 'kick-456',
                    firebotRewardTitle: 'Reward 2',
                    overrides: { cost: 200, skipQueue: true, enabled: false, paused: false }
                }
            };

            const kickReward1 = createMockKickReward({ id: 'kick-123', title: 'Old Title 1', cost: 100 });
            const kickReward2 = createMockKickReward({ id: 'kick-456', title: 'Reward 2', cost: 150 });

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([firebotReward1, firebotReward2]);
            mockRewardsManager.getAllRewards.mockResolvedValue([kickReward1, kickReward2]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            const result = await handler();

            expect(mockRewardsManager.updateReward).toHaveBeenCalledTimes(2);
            expect(mockRewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-123',
                firebotReward1.twitchData,
                { cost: 100, skipQueue: false, enabled: true, paused: false }
            );
            expect(mockRewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-456',
                firebotReward2.twitchData,
                { cost: 200, skipQueue: true, enabled: true, paused: false }
            );
            expect(result).toEqual({ unchanged: 0, updated: 2, failed: 0 });
        });

        it('skips unmanaged rewards', async () => {
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: false,
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            const result = await handler();

            expect(mockRewardsManager.updateReward).not.toHaveBeenCalled();
            expect(result).toEqual({ unchanged: 0, updated: 0, failed: 0 });
        });

        it('counts failed syncs separately', async () => {
            const firebotReward1 = createMockFirebotReward({ id: 'fb-reward-1', title: 'Reward 1' });
            const firebotReward2 = createMockFirebotReward({ id: 'fb-reward-2', title: 'Reward 2' });

            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                },
                'fb-reward-2': {
                    managedOnKick: true,
                    kickRewardId: 'kick-456',
                    firebotRewardTitle: 'Reward 2',
                    overrides: { cost: 200, skipQueue: true, enabled: false }
                }
            };

            const kickReward1 = createMockKickReward({ id: 'kick-123', title: 'Old Title 1', cost: 100 });
            const kickReward2 = createMockKickReward({ id: 'kick-456', title: 'Old Title 2', cost: 200 });

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([firebotReward1, firebotReward2]);
            mockRewardsManager.getAllRewards.mockResolvedValue([kickReward1, kickReward2]);
            mockRewardsManager.updateReward
                .mockResolvedValueOnce(true)
                .mockResolvedValueOnce(false);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            const result = await handler();

            expect(result).toEqual({ unchanged: 0, updated: 1, failed: 1 });
        });

        it('handles missing Firebot rewards', async () => {
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            const result = await handler();

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('not found locally'));
            expect(result).toEqual({ unchanged: 0, updated: 0, failed: 1 });
        });

        it('skips rewards that are already in sync', async () => {
            const firebotReward1 = createMockFirebotReward({
                id: 'fb-reward-1',
                title: 'Reward 1',
                cost: 100,
                prompt: 'Test prompt',
                backgroundColor: '#9147FF',
                isEnabled: true,
                isUserInputRequired: false,
                shouldRedemptionsSkipRequestQueue: false
            });

            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            /* eslint-disable camelcase */
            const kickReward = createMockKickReward({
                id: 'kick-123',
                title: 'Reward 1',
                description: 'Test prompt',
                cost: 100,
                background_color: '#9147FF',
                is_enabled: true,
                is_user_input_required: false,
                should_redemptions_skip_request_queue: false
            });
            /* eslint-enable camelcase */

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([firebotReward1]);
            mockRewardsManager.getAllRewards.mockResolvedValue([kickReward]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            const result = await handler();

            expect(mockRewardsManager.deleteReward).not.toHaveBeenCalled();
            expect(mockRewardsManager.createReward).not.toHaveBeenCalled();
            expect(result).toEqual({ unchanged: 1, updated: 0, failed: 0 });
        });

        it('updates reward titles when changed', async () => {
            const firebotReward1 = createMockFirebotReward({ id: 'fb-reward-1', title: 'New Title' });

            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Old Title',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            const kickReward = createMockKickReward({ id: 'kick-123', title: 'Old Title', cost: 100 });

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([firebotReward1]);
            mockRewardsManager.getAllRewards.mockResolvedValue([kickReward]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            await handler();

            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({ firebotRewardTitle: 'New Title' })
            );
        });

        it('uses Firebot paused state when syncing', async () => {
            const firebotReward1 = createMockFirebotReward({
                id: 'fb-reward-1',
                title: 'Reward 1',
                isPaused: true
            });

            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Reward 1',
                    overrides: { cost: 100, skipQueue: false, enabled: true, paused: false }
                }
            };

            const kickReward = createMockKickReward({ id: 'kick-123', is_paused: false }); // eslint-disable-line camelcase

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockReflectEvent.mockResolvedValue([firebotReward1]);
            mockRewardsManager.getAllRewards.mockResolvedValue([kickReward]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:sync-all-rewards');
            await handler();

            expect(mockRewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-123',
                firebotReward1.twitchData,
                { cost: 100, skipQueue: false, enabled: true, paused: true }
            );
        });
    });

    describe('kick:reconcile-rewards', () => {
        it('re-creates missing Kick rewards', async () => {
            const firebotReward = createMockFirebotReward();
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-missing',
                    firebotRewardTitle: 'Old Title',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            const kickRewards = [createMockKickReward({ id: 'kick-123', title: 'Other Reward' })];
            const newKickReward = createMockKickReward({ id: 'kick-new', title: 'Test Reward', cost: 100 });

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockRewardsManager.getAllRewards.mockResolvedValue(kickRewards);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.createReward.mockResolvedValue(newKickReward);

            const handler = registeredHandlers.get('kick:reconcile-rewards');
            const result = await handler();

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('not found on Kick'));
            expect(mockRewardsManager.createReward).toHaveBeenCalledWith(
                firebotReward.twitchData,
                managementState['fb-reward-1'].overrides
            );
            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({ kickRewardId: 'kick-new' })
            );
            expect(result).toEqual({ updated: 1 });
        });

        it('updates existing Kick rewards', async () => {
            const firebotReward = createMockFirebotReward();
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Old Title',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            const kickRewards = [createMockKickReward({ id: 'kick-123', title: 'Test Reward' })];

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockRewardsManager.getAllRewards.mockResolvedValue(kickRewards);
            mockReflectEvent.mockResolvedValue([firebotReward]);
            mockRewardsManager.updateReward.mockResolvedValue(true);

            const handler = registeredHandlers.get('kick:reconcile-rewards');
            const result = await handler();

            expect(mockRewardsManager.updateReward).toHaveBeenCalledWith(
                'kick-123',
                firebotReward.twitchData,
                managementState['fb-reward-1'].overrides
            );
            expect(mockKickRewardsState.setManagementData).toHaveBeenCalledWith(
                'fb-reward-1',
                expect.objectContaining({ firebotRewardTitle: 'Test Reward' })
            );
            expect(result).toEqual({ updated: 1 });
        });

        it('handles missing Firebot rewards', async () => {
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Test Reward',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockRewardsManager.getAllRewards.mockResolvedValue([]);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:reconcile-rewards');
            const result = await handler();

            expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('not found locally'));
            expect(result).toEqual({ updated: 0 });
        });

        it('skips unmanaged rewards', async () => {
            const managementState = {
                'fb-reward-1': {
                    managedOnKick: false,
                    firebotRewardTitle: 'Test Reward',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockKickRewardsState.getAllManagementData.mockReturnValue(managementState);
            mockRewardsManager.getAllRewards.mockResolvedValue([]);
            mockReflectEvent.mockResolvedValue([]);

            const handler = registeredHandlers.get('kick:reconcile-rewards');
            const result = await handler();

            expect(mockRewardsManager.createReward).not.toHaveBeenCalled();
            expect(mockRewardsManager.updateReward).not.toHaveBeenCalled();
            expect(result).toEqual({ updated: 0 });
        });

        it('sends error on exception', async () => {
            mockKickRewardsState.getAllManagementData.mockImplementation(() => {
                throw new Error('State error');
            });

            const handler = registeredHandlers.get('kick:reconcile-rewards');

            await expect(handler()).rejects.toThrow('State error');
            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:reward-management-error',
                expect.any(Object)
            );
        });
    });
});
