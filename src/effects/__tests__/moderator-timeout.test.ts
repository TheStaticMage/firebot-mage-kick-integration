import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { moderatorTimeoutEffect } from '../moderator-timeout';

type ModeratorTimeoutEffectParams = {
    username: string;
    time: string | number;
    reason: string;
};

// Mock the integration and logger
jest.mock('../../integration', () => ({
    integration: {
        kick: {
            userApi: {
                banUserByUsername: jest.fn()
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

const { integration } = require('../../integration');
const { logger } = require('../../main');

describe('moderatorTimeoutEffect.onTriggerEvent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('successfully times out a user with valid parameters', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '300', // 5 minutes in seconds
            reason: 'Test timeout reason'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        const result = await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            5, // 300 seconds = 5 minutes
            true, // temporary ban (timeout)
            'Test timeout reason'
        );
        expect(logger.debug).toHaveBeenCalledWith('testuser was timed out via the Timeout effect (duration=5 minutes).');
        expect(result).toBe(true);
    });

    it('uses default reason when no reason provided', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '120',
            reason: ''
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            2, // 120 seconds = 2 minutes
            true,
            'Timed out via Firebot'
        );
    });

    it('rounds time to nearest minute with minimum of 1 minute', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '30', // 30 seconds, should round to 1 minute minimum
            reason: 'Short timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            1, // Minimum 1 minute
            true,
            'Short timeout'
        );
    });

    it('caps time to maximum of 10080 minutes (7 days)', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '999999', // Very large number, should cap to 10080 minutes
            reason: 'Long timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            10080, // Maximum 10080 minutes (7 days)
            true,
            'Long timeout'
        );
    });

    it('rounds fractional minutes correctly', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '150', // 2.5 minutes, should round to 3 minutes
            reason: 'Fractional timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            3, // 150 seconds = 2.5 minutes, rounded to 3
            true,
            'Fractional timeout'
        );
    });

    it('returns false and logs error when time is not a valid number', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: 'invalid',
            reason: 'Test reason'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        const result = await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(logger.error).toHaveBeenCalledWith('Invalid timeout time provided: invalid');
        expect(integration.kick.userApi.banUserByUsername).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('returns false and logs error when API call fails', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '300',
            reason: 'Test reason'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(false);

        const result = await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            5,
            true,
            'Test reason'
        );
        expect(logger.error).toHaveBeenCalledWith('testuser was unable to be timed out via the Timeout effect (duration=5 minutes).');
        expect(result).toBe(false);
    });

    it('handles zero time correctly (should use minimum 1 minute)', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '0',
            reason: 'Zero timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            1, // Zero should become 1 minute minimum
            true,
            'Zero timeout'
        );
    });

    it('handles negative time correctly (should use minimum 1 minute)', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: '-100',
            reason: 'Negative timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            1, // Negative should become 1 minute minimum
            true,
            'Negative timeout'
        );
    });

    it('handles numeric time parameter (backward compatibility)', async () => {
        const effect: ModeratorTimeoutEffectParams = {
            username: 'testuser',
            time: 300, // Number instead of string
            reason: 'Numeric timeout'
        };
        const trigger: Trigger = { type: 'command', metadata: {} } as any;

        integration.kick.userApi.banUserByUsername.mockResolvedValue(true);

        const result = await moderatorTimeoutEffect.onTriggerEvent({ trigger, effect } as any);

        expect(integration.kick.userApi.banUserByUsername).toHaveBeenCalledWith(
            'testuser',
            5, // 300 seconds = 5 minutes
            true,
            'Numeric timeout'
        );
        expect(logger.debug).toHaveBeenCalledWith('testuser was timed out via the Timeout effect (duration=5 minutes).');
        expect(result).toBe(true);
    });
});
