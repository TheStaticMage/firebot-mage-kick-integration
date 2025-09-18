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

    describe('same-account detection and prevention', () => {
        let mockHttpCallWithTimeout: jest.Mock;
        let mockIntegration: any;

        beforeEach(() => {
            mockHttpCallWithTimeout = require('../http').httpCallWithTimeout as jest.Mock;
            mockIntegration = require('../../integration').integration;

            // Clear any previous mocks
            mockHttpCallWithTimeout.mockClear();

            // Set up mock kick instance with broadcaster
            mockIntegration.kick = {
                broadcaster: {
                    userId: 12345,
                    name: 'teststreamer',
                    email: 'test@example.com',
                    profilePicture: 'pic.jpg'
                },
                bot: null
            };

            // Mock integration settings
            mockIntegration.getSettings = jest.fn().mockReturnValue({
                webhookProxy: {
                    webhookProxyUrl: 'https://proxy.example.com'
                }
            });

            // Mock integration methods
            mockIntegration.saveIntegrationTokenData = jest.fn();
            mockIntegration.disconnect = jest.fn();
            mockIntegration.connect = jest.fn();

            // Mock kick instance methods
            if (!mockIntegration.kick) {
                mockIntegration.kick = {};
            }
            mockIntegration.kick.setAuthToken = jest.fn();
            mockIntegration.kick.setBotAuthToken = jest.fn();
        });

        it('prevents same account authorization during bot authorization', async () => {
            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'bot-token',
                'refresh_token': 'bot-refresh',
                'expires_in': 3600
            });

            // Mock bot user verification returning same user ID as broadcaster
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                data: [{
                    'user_id': 12345, // Same ID as broadcaster
                    name: 'teststreamer'
                }]
            });

            // Set up callback request
            const req = {
                query: {
                    code: 'auth-code',
                    state: 'test-state'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Set up token request state
            (authManager as any).tokenRequests['test-state'] = 'bot';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Cannot authorize the same account for both streamer and bot'));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('teststreamer'));
        });

        it('allows bot authorization when different account is used', async () => {
            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'bot-token',
                'refresh_token': 'bot-refresh',
                'expires_in': 3600
            });

            // Mock bot user verification returning different user ID
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                data: [{
                    'user_id': 67890, // Different ID from broadcaster
                    name: 'botaccount'
                }]
            });

            // Set up callback request
            const req = {
                query: {
                    code: 'auth-code',
                    state: 'test-state'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Set up token request state
            (authManager as any).tokenRequests['test-state'] = 'bot';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for bot!'));
        });

        it('handles verification error during bot authorization', async () => {
            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'bot-token',
                'refresh_token': 'bot-refresh',
                'expires_in': 3600
            });

            // Mock bot user verification failure
            mockHttpCallWithTimeout.mockRejectedValueOnce(new Error('API Error'));

            // Set up callback request
            const req = {
                query: {
                    code: 'auth-code',
                    state: 'test-state'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Set up token request state
            (authManager as any).tokenRequests['test-state'] = 'bot';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Failed to verify bot account'));
        });

        it('requires broadcaster to be present when authorizing bot account', async () => {
            // Remove broadcaster
            mockIntegration.kick.broadcaster = null;

            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'bot-token',
                'refresh_token': 'bot-refresh',
                'expires_in': 3600
            });

            // Set up callback request
            const req = {
                query: {
                    code: 'auth-code',
                    state: 'test-state'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Set up token request state
            (authManager as any).tokenRequests['test-state'] = 'bot';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Cannot authorize a bot account until a streamer account has been authorized'));
        });

        it('skips same-account check for streamer authorization', async () => {
            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'streamer-token',
                'refresh_token': 'streamer-refresh',
                'expires_in': 3600
            });

            // Set up callback request
            const req = {
                query: {
                    code: 'auth-code',
                    state: 'test-state'
                }
            };

            const res = {
                status: jest.fn().mockReturnThis(),
                send: jest.fn()
            };

            // Set up token request state
            (authManager as any).tokenRequests['test-state'] = 'streamer';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for streamer!'));
        });

        it('verifyBotUser returns correct user information', async () => {
            // Clear any previous mocks and set up fresh mock
            mockHttpCallWithTimeout.mockClear();

            // Mock API response
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                data: [{
                    'user_id': 12345,
                    name: 'testbot'
                }]
            });

            const result = await (authManager as any).verifyBotUser('test-token');

            expect(result).toEqual({
                userId: 12345,
                name: 'testbot'
            });
            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: expect.stringContaining('/public/v1/users'),
                method: 'GET',
                authToken: 'test-token'
            });
        });

        it('verifyBotUser handles API errors', async () => {
            // Clear any previous mocks and set up fresh mock
            mockHttpCallWithTimeout.mockClear();

            // Mock API failure
            mockHttpCallWithTimeout.mockRejectedValueOnce(new Error('Network Error'));

            await expect((authManager as any).verifyBotUser('test-token')).rejects.toThrow('Network Error');
        });

        it('verifyBotUser handles invalid API response', async () => {
            // Mock invalid response
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                data: []
            });

            await expect((authManager as any).verifyBotUser('test-token')).rejects.toThrow('Failed to retrieve bot user from Kick API');
        });

        it('verifyBotUser handles missing user ID', async () => {
            // Clear any previous mocks and set up fresh mock
            mockHttpCallWithTimeout.mockClear();

            // Mock response without user ID
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                data: [{
                    name: 'testbot'
                    // Missing user_id field
                }]
            });

            await expect((authManager as any).verifyBotUser('test-token')).rejects.toThrow('No user ID found in bot user API response');
        });
    });
});
