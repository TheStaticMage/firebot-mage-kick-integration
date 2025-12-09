/* eslint-disable @typescript-eslint/unbound-method */
import { RewardsManager } from '../rewards-manager';
import type { Kick } from '../kick';
import type { FirebotCustomReward } from '../../shared/types';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

import { logger } from '../../main';

describe('RewardsManager', () => {
    let rewardsManager: RewardsManager;
    let mockKick: jest.Mocked<Kick>;

    beforeEach(() => {
        jest.clearAllMocks();
        mockKick = {
            httpCallWithTimeout: jest.fn()
        } as any;
        rewardsManager = new RewardsManager(mockKick);
    });

    const createMockFirebotReward = (overrides?: Partial<FirebotCustomReward>): FirebotCustomReward => ({
        broadcasterId: 'broadcaster-1',
        broadcasterLogin: 'broadcaster',
        broadcasterName: 'Broadcaster',
        id: 'fb-reward-1',
        title: 'Test Reward',
        cost: 100,
        prompt: 'Test prompt',
        defaultImage: { url1x: '', url2x: '', url4x: '' },
        backgroundColor: '#9147FF',
        isEnabled: true,
        isUserInputRequired: false,
        maxPerStreamSetting: { isEnabled: false, maxPerStream: 0 },
        maxPerUserPerStreamSetting: { isEnabled: false, maxPerUserPerStream: 0 },
        globalCooldownSetting: { isEnabled: false, globalCooldownSeconds: 0 },
        isPaused: false,
        isInStock: true,
        shouldRedemptionsSkipRequestQueue: false,
        redemptionsRedeemedCurrentStream: undefined,
        ...overrides
    });

    describe('getAllRewards', () => {
        it('returns rewards on successful fetch', async () => {
            const mockRewards = [
                { id: 'kick-1', title: 'Reward 1', cost: 100 },
                { id: 'kick-2', title: 'Reward 2', cost: 200 }
            ];

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: mockRewards
            });

            const result = await rewardsManager.getAllRewards();

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
                '/public/v1/channels/rewards',
                'GET'
            );
            expect(result).toEqual(mockRewards);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Retrieved 2 total rewards'));
        });

        it('returns empty array when response data is empty array', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: []
            });

            const result = await rewardsManager.getAllRewards();

            expect(result).toEqual([]);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Retrieved 0 total rewards'));
        });

        it('returns null when response is null', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue(null);

            const result = await rewardsManager.getAllRewards();

            expect(result).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Failed to retrieve rewards'));
        });

        it('returns null when response data is missing', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            const result = await rewardsManager.getAllRewards();

            expect(result).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Failed to retrieve rewards'));
        });

        it('returns null when response data is not an array', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: 'not an array'
            });

            const result = await rewardsManager.getAllRewards();

            expect(result).toBeNull();
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Failed to retrieve rewards'));
        });

        it('returns null on error', async () => {
            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('Network error'));

            const result = await rewardsManager.getAllRewards();

            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error retrieving rewards'));
        });
    });

    describe('createReward', () => {
        it('creates reward with base values when no overrides', async () => {
            const firebotReward = createMockFirebotReward();
            const mockKickReward = { id: 'kick-123', title: 'Test Reward', cost: 100 };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: mockKickReward
            });

            const result = await rewardsManager.createReward(firebotReward);

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
                '/public/v1/channels/rewards',
                'POST',
                expect.stringContaining('"title":"Test Reward"')
            );

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            /* eslint-disable camelcase */
            expect(payload).toEqual({
                title: 'Test Reward',
                cost: 100,
                description: 'Test prompt',
                background_color: '#9147FF',
                is_enabled: true,
                is_user_input_required: false,
                should_redemptions_skip_request_queue: false
            });
            /* eslint-enable camelcase */

            expect(result).toEqual(mockKickReward);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully created reward'));
        });

        it('creates reward with overrides', async () => {
            const firebotReward = createMockFirebotReward();
            const overrides = { cost: 500, skipQueue: true, enabled: false };
            const mockKickReward = { id: 'kick-123', title: 'Test Reward', cost: 500 };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: mockKickReward
            });

            const result = await rewardsManager.createReward(firebotReward, overrides);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.cost).toBe(500);
            expect(payload.should_redemptions_skip_request_queue).toBe(true);
            expect(payload.is_enabled).toBe(false);

            expect(result).toEqual(mockKickReward);
        });

        it('handles empty prompt as empty string', async () => {
            const firebotReward = createMockFirebotReward({ prompt: '' });
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: { id: 'kick-123' }
            });

            await rewardsManager.createReward(firebotReward);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.description).toBe('');
        });

        it('handles null prompt as empty string', async () => {
            const firebotReward = createMockFirebotReward({ prompt: null as any });
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: { id: 'kick-123' }
            });

            await rewardsManager.createReward(firebotReward);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.description).toBe('');
        });

        it('returns null when response is null', async () => {
            const firebotReward = createMockFirebotReward();
            mockKick.httpCallWithTimeout.mockResolvedValue(null);

            const result = await rewardsManager.createReward(firebotReward);

            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create reward'));
        });

        it('returns null when response data is missing', async () => {
            const firebotReward = createMockFirebotReward();
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            const result = await rewardsManager.createReward(firebotReward);

            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to create reward'));
        });

        it('returns null on error', async () => {
            const firebotReward = createMockFirebotReward();
            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('API error'));

            const result = await rewardsManager.createReward(firebotReward);

            expect(result).toBeNull();
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error creating reward'));
        });
    });

    describe('updateReward', () => {
        it('updates reward with base values when no overrides', async () => {
            const firebotReward = createMockFirebotReward();
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            const result = await rewardsManager.updateReward('kick-123', firebotReward);

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
                '/public/v1/channels/rewards/kick-123',
                'PATCH',
                expect.stringContaining('"title":"Test Reward"')
            );

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            /* eslint-disable camelcase */
            expect(payload).toEqual({
                title: 'Test Reward',
                cost: 100,
                description: 'Test prompt',
                background_color: '#9147FF',
                is_enabled: true,
                is_user_input_required: false,
                should_redemptions_skip_request_queue: false
            });
            /* eslint-enable camelcase */

            expect(result).toBe(true);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully updated reward'));
        });

        it('updates reward with overrides', async () => {
            const firebotReward = createMockFirebotReward();
            const overrides = { cost: 300, skipQueue: true, enabled: false };
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            const result = await rewardsManager.updateReward('kick-123', firebotReward, overrides);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.cost).toBe(300);
            expect(payload.should_redemptions_skip_request_queue).toBe(true);
            expect(payload.is_enabled).toBe(false);

            expect(result).toBe(true);
        });

        it('handles partial overrides', async () => {
            const firebotReward = createMockFirebotReward({ cost: 100, isEnabled: true });
            const overrides = { cost: 200 };
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            await rewardsManager.updateReward('kick-123', firebotReward, overrides);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.cost).toBe(200);
            expect(payload.is_enabled).toBe(true);
            expect(payload.should_redemptions_skip_request_queue).toBe(false);
        });

        it('returns false on error', async () => {
            const firebotReward = createMockFirebotReward();
            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('API error'));

            const result = await rewardsManager.updateReward('kick-123', firebotReward);

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error updating reward'));
        });
    });

    describe('deleteReward', () => {
        it('deletes reward successfully', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({});

            const result = await rewardsManager.deleteReward('kick-123');

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith(
                '/public/v1/channels/rewards/kick-123',
                'DELETE'
            );
            expect(result).toBe(true);
            expect(logger.debug).toHaveBeenCalledWith(expect.stringContaining('Successfully deleted reward'));
        });

        it('returns false on error', async () => {
            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('API error'));

            const result = await rewardsManager.deleteReward('kick-123');

            expect(result).toBe(false);
            expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Error deleting reward'));
        });
    });

    describe('override precedence', () => {
        it('overrides take precedence over base reward values', async () => {
            const firebotReward = createMockFirebotReward({
                cost: 100,
                isEnabled: true,
                shouldRedemptionsSkipRequestQueue: false
            });

            const overrides = {
                cost: 999,
                enabled: false,
                skipQueue: true
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({ data: { id: 'kick-123' } });

            await rewardsManager.createReward(firebotReward, overrides);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.cost).toBe(999);
            expect(payload.is_enabled).toBe(false);
            expect(payload.should_redemptions_skip_request_queue).toBe(true);
        });

        it('undefined overrides fall back to base values', async () => {
            const firebotReward = createMockFirebotReward({
                cost: 100,
                isEnabled: true,
                shouldRedemptionsSkipRequestQueue: false
            });

            const overrides = {
                cost: undefined,
                enabled: undefined,
                skipQueue: undefined
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({ data: { id: 'kick-123' } });

            await rewardsManager.createReward(firebotReward, overrides);

            const callArg = mockKick.httpCallWithTimeout.mock.calls[0][2];
            const payload = JSON.parse(callArg as string);

            expect(payload.cost).toBe(100);
            expect(payload.is_enabled).toBe(true);
            expect(payload.should_redemptions_skip_request_queue).toBe(false);
        });
    });
});
