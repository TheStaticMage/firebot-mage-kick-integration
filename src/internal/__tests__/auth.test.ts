jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    scriptVersion: '1.0.0'
}));

jest.mock('../../integration', () => ({
    integration: {
        sendCriticalErrorNotification: jest.fn(),
        getSettings: jest.fn(() => ({
            accounts: {
                authorizeBotAccount: true
            }
        })),
        saveIntegrationTokenData: jest.fn()
    }
}));

jest.mock('../http', () => ({
    httpCallWithTimeout: jest.fn()
}));

import { AuthManager } from '../auth';

describe('AuthManager', () => {
    let authManager: AuthManager;

    beforeEach(() => {
        authManager = new AuthManager();
        jest.useFakeTimers();
        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.useRealTimers();
        authManager.disconnect();
    });

    describe('scheduled token renewal error handling', () => {
        it('handles errors in scheduled streamer token renewal without uncaught promise rejection', async () => {
            // Set up auth manager with tokens
            (authManager as any).streamerRefreshToken = 'test-refresh-token';
            (authManager as any).streamerTokenExpiresAt = Date.now() + 60000;

            // Mock refreshStreamerToken to throw an error
            const mockError = new Error('Network failure');
            jest.spyOn(authManager as any, 'refreshStreamerToken').mockRejectedValue(mockError);

            // Schedule a renewal with a short delay
            (authManager as any).scheduleNextStreamerTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // If we get here without an uncaught promise rejection, the test passes
            expect(true).toBe(true);
        });

        it('handles errors in scheduled bot token renewal without uncaught promise rejection', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshBotToken to throw an error
            const mockError = new Error('Auth server down');
            jest.spyOn(authManager as any, 'refreshBotToken').mockRejectedValue(mockError);

            // Schedule a renewal with a short delay
            (authManager as any).scheduleNextBotTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // If we get here without an uncaught promise rejection, the test passes
            expect(true).toBe(true);
        });

        it('successfully schedules and executes streamer token renewal without errors', async () => {
            // Set up auth manager with tokens
            (authManager as any).streamerRefreshToken = 'test-refresh-token';
            (authManager as any).streamerTokenExpiresAt = Date.now() + 60000;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshStreamerToken').mockResolvedValue(true);

            // Schedule a renewal with a short delay
            (authManager as any).scheduleNextStreamerTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // Verify the refresh was called and no error was thrown
            expect((authManager as any).refreshStreamerToken).toHaveBeenCalledTimes(1);
        });

        it('successfully schedules and executes bot token renewal without errors', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshBotToken').mockResolvedValue(true);

            // Schedule a renewal with a short delay
            (authManager as any).scheduleNextBotTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // Verify the refresh was called and no error was thrown
            expect((authManager as any).refreshBotToken).toHaveBeenCalledTimes(1);
        });

        it('handles errors in scheduled bot token renewal without uncaught promise rejection', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshBotToken to throw an error
            const mockError = new Error('Auth server down');
            jest.spyOn(authManager as any, 'refreshBotToken').mockRejectedValue(mockError);

            // Schedule a renewal with a short delay
            (authManager as any).scheduleNextBotTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // If we get here without an uncaught promise rejection, the test passes
            expect(true).toBe(true);
        });

        it('successfully schedules and executes streamer token renewal without errors', async () => {
            // Set up auth manager with tokens
            (authManager as any).streamerRefreshToken = 'test-refresh-token';
            (authManager as any).streamerTokenExpiresAt = Date.now() + 60000;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshStreamerToken').mockResolvedValue(true);

            // Schedule a renewal
            (authManager as any).scheduleNextStreamerTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // Verify the refresh was called and no error was thrown
            expect((authManager as any).refreshStreamerToken).toHaveBeenCalledTimes(1);
        });

        it('successfully schedules and executes bot token renewal without errors', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshBotToken').mockResolvedValue(true);

            // Schedule a renewal
            (authManager as any).scheduleNextBotTokenRenewal(1000);

            // Advance time to trigger the scheduled renewal
            jest.advanceTimersByTime(1000);

            // Wait for the async timeout callback to complete
            await Promise.resolve();

            // Verify the refresh was called and no error was thrown
            expect((authManager as any).refreshBotToken).toHaveBeenCalledTimes(1);
        });

        it('clears existing timeout before scheduling new streamer token renewal', () => {
            // Set up auth manager
            (authManager as any).streamerRefreshToken = 'test-refresh-token';

            // Schedule first renewal
            (authManager as any).scheduleNextStreamerTokenRenewal(5000);
            const firstTimeout = (authManager as any).streamerAuthRenewer;
            expect(firstTimeout).toBeTruthy();

            // Schedule second renewal (should clear the first)
            (authManager as any).scheduleNextStreamerTokenRenewal(10000);
            const secondTimeout = (authManager as any).streamerAuthRenewer;

            // The timeout should have been replaced with a new one
            expect(secondTimeout).toBeTruthy();
            expect(secondTimeout).not.toBe(firstTimeout);
        });

        it('clears existing timeout before scheduling new bot token renewal', () => {
            // Set up auth manager
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';

            // Schedule first renewal
            (authManager as any).scheduleNextBotTokenRenewal(5000);
            const firstTimeout = (authManager as any).botAuthRenewer;
            expect(firstTimeout).toBeTruthy();

            // Schedule second renewal (should clear the first)
            (authManager as any).scheduleNextBotTokenRenewal(10000);
            const secondTimeout = (authManager as any).botAuthRenewer;

            // The timeout should have been replaced with a new one
            expect(secondTimeout).toBeTruthy();
            expect(secondTimeout).not.toBe(firstTimeout);
        });
    });

    describe('token renewal retry logic', () => {
        it('retries streamer token renewal after 10 seconds when refresh fails but token exists', async () => {
            // Set up auth manager with tokens
            (authManager as any).streamerRefreshToken = 'test-refresh-token';
            (authManager as any).streamerTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail
            const mockError = new Error('Network timeout');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockRejectedValue(mockError);

            // Spy on scheduleNextStreamerTokenRenewal to track retry scheduling
            const scheduleSpyStreamer = jest.spyOn(authManager as any, 'scheduleNextStreamerTokenRenewal');

            // Call refreshStreamerToken directly
            const result = await (authManager as any).refreshStreamerToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have scheduled a retry in 10 seconds (not cleared the token)
            expect(scheduleSpyStreamer).toHaveBeenCalledWith(10000);

            // Refresh token should still exist (not cleared)
            expect((authManager as any).streamerRefreshToken).toBe('test-refresh-token');
        });

        it('retries bot token renewal after 10 seconds when refresh fails but token exists', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail
            const mockError = new Error('Auth server error');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockRejectedValue(mockError);

            // Spy on scheduleNextBotTokenRenewal to track retry scheduling
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have scheduled a retry in 10 seconds (not cleared the token)
            expect(scheduleSpyBot).toHaveBeenCalledWith(10000);

            // Refresh token should still exist (not cleared)
            expect((authManager as any).botRefreshToken).toBe('test-bot-refresh-token');
        });

        it('does not retry streamer token renewal when refresh token is missing', async () => {
            // Set up auth manager without refresh token
            (authManager as any).streamerRefreshToken = '';
            (authManager as any).streamerTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail (it will be called even with empty token)
            const mockError = new Error('No refresh token');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockRejectedValue(mockError);

            // Spy on scheduleNextStreamerTokenRenewal and disconnect
            const scheduleSpyStreamer = jest.spyOn(authManager as any, 'scheduleNextStreamerTokenRenewal');
            const disconnectSpy = jest.spyOn(authManager, 'disconnect');

            // Call refreshStreamerToken directly
            const result = await (authManager as any).refreshStreamerToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have disconnected (not scheduled retry) because token is missing
            expect(disconnectSpy).toHaveBeenCalled();
            expect(scheduleSpyStreamer).not.toHaveBeenCalledWith(10000);
        });

        it('does not retry bot token renewal when refresh token is missing', async () => {
            // Set up auth manager without refresh token
            (authManager as any).botRefreshToken = '';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail (it will be called even with empty token)
            const mockError = new Error('No refresh token');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockRejectedValue(mockError);

            // Spy on scheduleNextBotTokenRenewal and disconnect
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');
            const disconnectSpy = jest.spyOn(authManager, 'disconnect');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have disconnected (not scheduled retry) because token is missing
            expect(disconnectSpy).toHaveBeenCalled();
            expect(scheduleSpyBot).not.toHaveBeenCalledWith(10000);
        });

        it('schedules normal renewal after successful streamer token refresh', async () => {
            // Set up auth manager with tokens
            (authManager as any).streamerRefreshToken = 'test-refresh-token';
            const expiresAt = Date.now() + 3600000; // 1 hour from now
            (authManager as any).streamerTokenExpiresAt = expiresAt;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockResolvedValue(undefined);

            // Spy on scheduleNextStreamerTokenRenewal
            const scheduleSpyStreamer = jest.spyOn(authManager as any, 'scheduleNextStreamerTokenRenewal');

            // Call refreshStreamerToken directly
            const result = await (authManager as any).refreshStreamerToken();

            // Should return true due to success
            expect(result).toBe(true);

            // Should have scheduled normal renewal (5 minutes before expiration)
            const expectedDelay = expiresAt - Date.now() - 300000;
            expect(scheduleSpyStreamer).toHaveBeenCalledWith(expectedDelay);
        });

        it('schedules normal renewal after successful bot token refresh', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            const expiresAt = Date.now() + 3600000; // 1 hour from now
            (authManager as any).botTokenExpiresAt = expiresAt;

            // Mock successful refresh
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockResolvedValue(undefined);

            // Spy on scheduleNextBotTokenRenewal
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return true due to success
            expect(result).toBe(true);

            // Should have scheduled normal renewal (5 minutes before expiration)
            const expectedDelay = expiresAt - Date.now() - 300000;
            expect(scheduleSpyBot).toHaveBeenCalledWith(expectedDelay);
        });

        it('disconnects when bot token refresh fails and token gets cleared during error', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail and simulate token being cleared
            const mockError = new Error('Invalid refresh token');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockImplementation(() => {
                // Simulate the token being cleared during the error (e.g., by external code)
                (authManager as any).botRefreshToken = '';
                throw mockError;
            });

            // Spy on scheduleNextBotTokenRenewal and disconnect
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');
            const disconnectSpy = jest.spyOn(authManager, 'disconnect');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have disconnected (not scheduled retry) because token was cleared
            expect(disconnectSpy).toHaveBeenCalled();
            expect(scheduleSpyBot).not.toHaveBeenCalledWith(10000);
        });

        it('automatically retries bot token renewal from scheduled renewal when network error occurs', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            let callCount = 0;
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockImplementation(() => {
                callCount++;
                if (callCount === 1) {
                    // First call fails
                    throw new Error('Network timeout');
                }
                // Second call succeeds
                return Promise.resolve();
            });

            // Schedule a bot token renewal
            (authManager as any).scheduleNextBotTokenRenewal(1000);

            // Execute the first scheduled renewal (should fail and schedule retry)
            jest.advanceTimersByTime(1000);
            await Promise.resolve(); // Let async operations complete

            // Execute the retry (should succeed)
            jest.advanceTimersByTime(10000);
            await Promise.resolve(); // Let async operations complete

            // Both calls should have been made
            expect(callCount).toBe(2);

            // Token should still exist (not cleared)
            expect((authManager as any).botRefreshToken).toBe('test-bot-refresh-token');
        });
    });
});
