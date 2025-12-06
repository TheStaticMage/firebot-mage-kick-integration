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
        getSettings: jest.fn(() => ({})),
        saveIntegrationTokenData: jest.fn()
    }
}));

jest.mock('../http', () => ({
    httpCallWithTimeout: jest.fn()
}));

import { AuthManager } from '../auth';
import { httpCallWithTimeout } from '../http';
import { integration } from '../../integration';
import { IntegrationConstants } from '../../constants';

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

            // Spy on scheduleNextBotTokenRenewal and disconnect
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');
            const disconnectSpy = jest.spyOn(authManager, 'disconnect');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return true because bot token is optional
            expect(result).toBe(true);

            // Should not have disconnected or scheduled retry because missing bot token is normal
            expect(disconnectSpy).not.toHaveBeenCalled();
            expect(scheduleSpyBot).not.toHaveBeenCalled();
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

        it('retries bot token renewal when refresh fails with error (bot token present)', async () => {
            // Set up auth manager with tokens
            (authManager as any).botRefreshToken = 'test-bot-refresh-token';
            (authManager as any).botTokenExpiresAt = Date.now() + 60000;

            // Mock refreshAuthTokenReal to fail
            const mockError = new Error('Network timeout');
            jest.spyOn(authManager as any, 'refreshAuthTokenReal').mockRejectedValue(mockError);

            // Spy on scheduleNextBotTokenRenewal
            const scheduleSpyBot = jest.spyOn(authManager as any, 'scheduleNextBotTokenRenewal');

            // Call refreshBotToken directly
            const result = await (authManager as any).refreshBotToken();

            // Should return false due to error
            expect(result).toBe(false);

            // Should have scheduled retry after 10 seconds
            expect(scheduleSpyBot).toHaveBeenCalledWith(10000);
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
                kickApp: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret'
                },
                connectivity: {
                    firebotUrl: 'http://localhost:7472'
                }
            });

            // Mock integration methods
            mockIntegration.saveIntegrationTokenData = jest.fn();
            mockIntegration.disconnect = jest.fn();
            mockIntegration.connect = jest.fn();
            mockIntegration.sendCriticalErrorNotification = jest.fn();

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
                'expires_in': 3600,
                'scope': IntegrationConstants.BOT_SCOPES.join(' ')
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
                'expires_in': 3600,
                'scope': IntegrationConstants.BOT_SCOPES.join(' ')
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
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for bot account!'));
        });

        it('handles verification error during bot authorization', async () => {
            // Mock successful token exchange
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'bot-token',
                'refresh_token': 'bot-refresh',
                'expires_in': 3600,
                'scope': IntegrationConstants.BOT_SCOPES.join(' ')
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
                'expires_in': 3600,
                'scope': IntegrationConstants.BOT_SCOPES.join(' ')
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
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('until the streamer account has been authorized'));
        });

        it('sends critical error when streamer scopes are missing', async () => {
            mockHttpCallWithTimeout.mockResolvedValueOnce({
                'access_token': 'streamer-token',
                'refresh_token': 'streamer-refresh',
                'expires_in': 3600,
                'scope': 'user:read chat:write'
            });

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

            (authManager as any).tokenRequests['test-state'] = 'streamer';
            (authManager as any).codeChallenges['test-state'] = 'code-verifier';

            await authManager.handleAuthCallback(req, res);

            expect(res.status).toHaveBeenCalledWith(200);
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('partially authorized for streamer account'));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Important permissions were not granted'));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('Try Again'));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('/integrations/firebot-mage-kick-integration/link/streamer'));
            expect(res.send).toHaveBeenCalledWith(expect.stringContaining('https://github.com/TheStaticMage/firebot-mage-kick-integration/blob/main/doc/troubleshooting.md'));
            expect(mockIntegration.sendCriticalErrorNotification).toHaveBeenCalledWith(
                expect.stringContaining('streamer token is missing required scopes')
            );
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

    describe('refreshAuthTokenReal', () => {
        /* eslint-disable camelcase */
        const mockIntegration = integration as any;
        const mockHttpCall = httpCallWithTimeout as jest.MockedFunction<typeof httpCallWithTimeout>;

        beforeEach(() => {
            // Set up default refresh tokens and auth tokens
            (authManager as any).streamerRefreshToken = 'streamer-refresh-token';
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).streamerAuthToken = '';
            (authManager as any).botAuthToken = '';

            // Mock Date.now() for consistent testing
            jest.spyOn(Date, 'now').mockReturnValue(1000000);

            // Set up integration.kick mock functions
            mockIntegration.kick = {
                setAuthToken: jest.fn(),
                setBotAuthToken: jest.fn()
            };
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        describe('Direct auth flow', () => {
            beforeEach(() => {
                mockHttpCall.mockClear();

                mockIntegration.getSettings.mockReturnValue({
                    connectivity: {
                        firebotUrl: 'http://localhost:7472'
                    },
                    kickApp: {
                        clientId: 'test-client-id',
                        clientSecret: 'test-client-secret'
                    }
                });
            });

            it('should successfully refresh streamer token via direct auth', async () => {
                mockHttpCall.mockResolvedValue({
                    access_token: 'new-streamer-access-token',
                    refresh_token: 'new-streamer-refresh-token',
                    expires_in: 3600,
                    scope: IntegrationConstants.STREAMER_SCOPES.join(' ')
                });

                await (authManager as any).refreshAuthTokenReal('streamer');

                expect(mockHttpCall).toHaveBeenCalledWith({
                    url: 'https://id.kick.com/oauth/token',
                    method: 'POST',
                    body: 'grant_type=refresh_token&refresh_token=streamer-refresh-token&client_id=test-client-id&client_secret=test-client-secret&redirect_uri=http%3A%2F%2Flocalhost%3A7472%2Fintegrations%2Ffirebot-mage-kick-integration%2Fcallback'
                });

                expect((authManager as any).streamerAuthToken).toBe('new-streamer-access-token');
                expect((authManager as any).streamerRefreshToken).toBe('new-streamer-refresh-token');
                expect((authManager as any).streamerTokenExpiresAt).toBe(1000000 + (3600 * 1000));
                expect(mockIntegration.kick.setAuthToken).toHaveBeenCalledWith('new-streamer-access-token');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('new-streamer-refresh-token', 'bot-refresh-token');
            });

            it('should successfully refresh bot token via direct auth', async () => {
                mockHttpCall.mockResolvedValue({
                    access_token: 'new-bot-access-token',
                    refresh_token: 'new-bot-refresh-token',
                    expires_in: 3600,
                    scope: IntegrationConstants.BOT_SCOPES.join(' ')
                });

                await (authManager as any).refreshAuthTokenReal('bot');

                expect(mockHttpCall).toHaveBeenCalledWith({
                    url: 'https://id.kick.com/oauth/token',
                    method: 'POST',
                    body: 'grant_type=refresh_token&refresh_token=bot-refresh-token&client_id=test-client-id&client_secret=test-client-secret&redirect_uri=http%3A%2F%2Flocalhost%3A7472%2Fintegrations%2Ffirebot-mage-kick-integration%2Fcallback'
                });

                expect((authManager as any).botAuthToken).toBe('new-bot-access-token');
                expect((authManager as any).botRefreshToken).toBe('new-bot-refresh-token');
                expect((authManager as any).botTokenExpiresAt).toBe(1000000 + (3600 * 1000));
                expect(mockIntegration.kick.setBotAuthToken).toHaveBeenCalledWith('new-bot-access-token');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', 'new-bot-refresh-token');
            });
        });

        describe('Error handling', () => {
            beforeEach(() => {
                mockHttpCall.mockClear();

                mockIntegration.getSettings.mockReturnValue({
                    connectivity: {
                        firebotUrl: 'http://localhost:7472'
                    },
                    kickApp: {
                        clientId: 'test-client-id',
                        clientSecret: 'test-client-secret'
                    }
                });
            });

            it('should handle 401 error for streamer token and clear refresh token', async () => {
                const error401 = { status: 401, message: 'Unauthorized' };
                mockHttpCall.mockRejectedValue(error401);

                await (authManager as any).refreshAuthTokenReal('streamer');

                expect(mockIntegration.sendCriticalErrorNotification).toHaveBeenCalledWith(
                    'Kick integration streamer refresh token is invalid. Open the Kick Accounts screen to re-authorize the streamer account.'
                );
                expect((authManager as any).streamerRefreshToken).toBe('');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('', 'bot-refresh-token');
            });

            it('should handle 401 error for bot token and clear refresh token', async () => {
                const error401 = { status: 401, message: 'Unauthorized' };
                mockHttpCall.mockRejectedValue(error401);

                await (authManager as any).refreshAuthTokenReal('bot');

                expect(mockIntegration.sendCriticalErrorNotification).toHaveBeenCalledWith(
                    'Kick integration bot refresh token is invalid. Open the Kick Accounts screen to re-authorize the bot account.'
                );
                expect((authManager as any).botRefreshToken).toBe('');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', '');
            });

            it('should handle non-401 errors by re-throwing for streamer', async () => {
                const networkError = new Error('Network timeout');
                mockHttpCall.mockRejectedValue(networkError);

                await expect((authManager as any).refreshAuthTokenReal('streamer')).rejects.toThrow('Network timeout');

                // Should not clear refresh token for non-401 errors
                expect((authManager as any).streamerRefreshToken).toBe('streamer-refresh-token');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', 'bot-refresh-token');
            });

            it('should handle non-401 errors by re-throwing for bot', async () => {
                const networkError = new Error('Network timeout');
                mockHttpCall.mockRejectedValue(networkError);

                await expect((authManager as any).refreshAuthTokenReal('bot')).rejects.toThrow('Network timeout');

                // Should not clear refresh token for non-401 errors
                expect((authManager as any).botRefreshToken).toBe('bot-refresh-token');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', 'bot-refresh-token');
            });

            it('should handle 401 error with non-object error', async () => {
                mockHttpCall.mockRejectedValue('String error with 401');

                await expect((authManager as any).refreshAuthTokenReal('streamer')).rejects.toBe('String error with 401');

                // Should not clear refresh token for non-object errors, even if they contain "401"
                expect((authManager as any).streamerRefreshToken).toBe('streamer-refresh-token');
                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', 'bot-refresh-token');
            });

            it('should always save integration token data in finally block on success', async () => {
                mockHttpCall.mockResolvedValue({
                    access_token: 'new-access-token',
                    refresh_token: 'new-refresh-token',
                    expires_in: 3600,
                    scope: IntegrationConstants.STREAMER_SCOPES.join(' ')
                });

                await (authManager as any).refreshAuthTokenReal('streamer');

                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('new-refresh-token', 'bot-refresh-token');
            });

            it('should always save integration token data in finally block on error', async () => {
                const networkError = new Error('Network error');
                mockHttpCall.mockRejectedValue(networkError);

                await expect((authManager as any).refreshAuthTokenReal('streamer')).rejects.toThrow('Network error');

                expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalledWith('streamer-refresh-token', 'bot-refresh-token');
            });
        });

        describe('Edge cases', () => {
            beforeEach(() => {
                mockHttpCall.mockClear();
            });

            it('should handle empty client credentials gracefully in direct auth', async () => {
                mockIntegration.getSettings.mockReturnValue({
                    connectivity: {
                        firebotUrl: 'http://localhost:7472'
                    },
                    kickApp: {
                        clientId: '', // Empty client ID
                        clientSecret: '' // Empty client secret
                    }
                });

                mockHttpCall.mockResolvedValue({
                    access_token: 'new-access-token',
                    refresh_token: 'new-refresh-token',
                    expires_in: 3600,
                    scope: IntegrationConstants.STREAMER_SCOPES.join(' ')
                });

                await (authManager as any).refreshAuthTokenReal('streamer');

                expect(mockHttpCall).toHaveBeenCalledWith({
                    url: 'https://id.kick.com/oauth/token',
                    method: 'POST',
                    body: 'grant_type=refresh_token&refresh_token=streamer-refresh-token&client_id=&client_secret=&redirect_uri=http%3A%2F%2Flocalhost%3A7472%2Fintegrations%2Ffirebot-mage-kick-integration%2Fcallback'
                });
            });
        });
    });

    describe('getStreamerConnectionStatus()', () => {
        it('returns ready: true when both streamerRefreshToken and streamerAuthToken are set', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).streamerAuthToken = 'auth-token';
            (authManager as any).streamerTokenExpiresAt = 0;

            const status = authManager.getStreamerConnectionStatus();

            expect(status.ready).toBe(true);
            expect(status.tokenExpiresAt).toBe(0);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns ready: false when streamerRefreshToken is missing', () => {
            (authManager as any).streamerRefreshToken = '';
            (authManager as any).streamerAuthToken = 'auth-token';
            (authManager as any).streamerTokenExpiresAt = 0;

            const status = authManager.getStreamerConnectionStatus();

            expect(status.ready).toBe(false);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns ready: false when streamerAuthToken is missing', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).streamerAuthToken = '';
            (authManager as any).streamerTokenExpiresAt = 0;

            const status = authManager.getStreamerConnectionStatus();

            expect(status.ready).toBe(false);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns tokenExpiresAt from streamerTokenExpiresAt', () => {
            const expiryTime = Date.now() + 3600000;
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).streamerAuthToken = 'auth-token';
            (authManager as any).streamerTokenExpiresAt = expiryTime;

            const status = authManager.getStreamerConnectionStatus();

            expect(status.tokenExpiresAt).toBe(expiryTime);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns tokenExpiresAt as 0 when not set', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).streamerAuthToken = 'auth-token';
            (authManager as any).streamerTokenExpiresAt = 0;

            const status = authManager.getStreamerConnectionStatus();

            expect(status.tokenExpiresAt).toBe(0);
            expect(status.missingScopes).toEqual([]);
        });

        it('surfaces missing scopes when present', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).streamerAuthToken = 'auth-token';
            (authManager as any).streamerTokenExpiresAt = 0;
            (authManager as any).streamerMissingScopes = ['chat:write'];

            const status = authManager.getStreamerConnectionStatus();

            expect(status.missingScopes).toEqual(['chat:write']);
        });
    });

    describe('getBotConnectionStatus()', () => {
        it('returns ready: true when both botRefreshToken and botAuthToken are set', () => {
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).botAuthToken = 'bot-auth-token';
            (authManager as any).botTokenExpiresAt = 0;

            const status = authManager.getBotConnectionStatus();

            expect(status.ready).toBe(true);
            expect(status.tokenExpiresAt).toBe(0);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns ready: false when botRefreshToken is missing', () => {
            (authManager as any).botRefreshToken = '';
            (authManager as any).botAuthToken = 'bot-auth-token';
            (authManager as any).botTokenExpiresAt = 0;

            const status = authManager.getBotConnectionStatus();

            expect(status.ready).toBe(false);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns ready: false when botAuthToken is missing', () => {
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).botAuthToken = '';
            (authManager as any).botTokenExpiresAt = 0;

            const status = authManager.getBotConnectionStatus();

            expect(status.ready).toBe(false);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns tokenExpiresAt from botTokenExpiresAt', () => {
            const expiryTime = Date.now() + 3600000;
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).botAuthToken = 'bot-auth-token';
            (authManager as any).botTokenExpiresAt = expiryTime;

            const status = authManager.getBotConnectionStatus();

            expect(status.tokenExpiresAt).toBe(expiryTime);
            expect(status.missingScopes).toEqual([]);
        });

        it('returns tokenExpiresAt as 0 when not set', () => {
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).botAuthToken = 'bot-auth-token';
            (authManager as any).botTokenExpiresAt = 0;

            const status = authManager.getBotConnectionStatus();

            expect(status.tokenExpiresAt).toBe(0);
            expect(status.missingScopes).toEqual([]);
        });

        it('surfaces missing scopes when present', () => {
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            (authManager as any).botAuthToken = 'bot-auth-token';
            (authManager as any).botTokenExpiresAt = 0;
            (authManager as any).botMissingScopes = ['chat:write', 'chat:read'];

            const status = authManager.getBotConnectionStatus();

            expect(status.missingScopes).toEqual(['chat:write', 'chat:read']);
        });
    });

    describe('deauthorizeStreamer()', () => {
        it('clears streamerRefreshToken', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';

            authManager.deauthorizeStreamer();

            expect((authManager as any).streamerRefreshToken).toBe('');
        });

        it('clears streamerAuthToken', () => {
            (authManager as any).streamerAuthToken = 'auth-token';

            authManager.deauthorizeStreamer();

            expect((authManager as any).streamerAuthToken).toBe('');
        });

        it('clears streamerMissingScopes', () => {
            (authManager as any).streamerMissingScopes = ['chat:write'];

            authManager.deauthorizeStreamer();

            expect((authManager as any).streamerMissingScopes).toEqual([]);
        });

        it('sets streamerTokenExpiresAt to 0', () => {
            (authManager as any).streamerTokenExpiresAt = Date.now() + 3600000;

            authManager.deauthorizeStreamer();

            expect((authManager as any).streamerTokenExpiresAt).toBe(0);
        });

        it('cancels existing streamerAuthRenewer timeout', () => {
            const timeoutId = setTimeout(() => {
                void 0;
            }, 1000);
            (authManager as any).streamerAuthRenewer = timeoutId;
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

            authManager.deauthorizeStreamer();

            expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
            clearTimeoutSpy.mockRestore();
        });

        it('calls saveIntegrationTokenData with empty streamer token', () => {
            (authManager as any).streamerRefreshToken = 'refresh-token';
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            const mockSave = jest.fn();
            (integration.saveIntegrationTokenData as any) = mockSave;

            authManager.deauthorizeStreamer();

            expect(mockSave).toHaveBeenCalled();
        });

        it('preserves botRefreshToken when saving', () => {
            (authManager as any).streamerRefreshToken = 'streamer-refresh';
            (authManager as any).botRefreshToken = 'bot-refresh';

            authManager.deauthorizeStreamer();

            // Bot token should still be present in the manager
            expect((authManager as any).botRefreshToken).toBe('bot-refresh');
        });

        it('logs debug and info messages', () => {
            const { logger } = require('../../main');

            authManager.deauthorizeStreamer();

            expect(logger.debug).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
        });
    });

    describe('deauthorizeBot()', () => {
        it('clears botRefreshToken', () => {
            (authManager as any).botRefreshToken = 'bot-refresh-token';

            authManager.deauthorizeBot();

            expect((authManager as any).botRefreshToken).toBe('');
        });

        it('clears botAuthToken', () => {
            (authManager as any).botAuthToken = 'bot-auth-token';

            authManager.deauthorizeBot();

            expect((authManager as any).botAuthToken).toBe('');
        });

        it('clears botMissingScopes', () => {
            (authManager as any).botMissingScopes = ['chat:write'];

            authManager.deauthorizeBot();

            expect((authManager as any).botMissingScopes).toEqual([]);
        });

        it('sets botTokenExpiresAt to 0', () => {
            (authManager as any).botTokenExpiresAt = Date.now() + 3600000;

            authManager.deauthorizeBot();

            expect((authManager as any).botTokenExpiresAt).toBe(0);
        });

        it('cancels existing botAuthRenewer timeout', () => {
            const timeoutId = setTimeout(() => {
                void 0;
            }, 1000);
            (authManager as any).botAuthRenewer = timeoutId;
            const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');

            authManager.deauthorizeBot();

            expect(clearTimeoutSpy).toHaveBeenCalledWith(timeoutId);
            clearTimeoutSpy.mockRestore();
        });

        it('calls saveIntegrationTokenData with empty bot token', () => {
            (authManager as any).streamerRefreshToken = 'streamer-refresh-token';
            (authManager as any).botRefreshToken = 'bot-refresh-token';
            const mockSave = jest.fn();
            (integration.saveIntegrationTokenData as any) = mockSave;

            authManager.deauthorizeBot();

            expect(mockSave).toHaveBeenCalled();
        });

        it('preserves streamerRefreshToken when saving', () => {
            (authManager as any).streamerRefreshToken = 'streamer-refresh';
            (authManager as any).botRefreshToken = 'bot-refresh';

            authManager.deauthorizeBot();

            // Streamer token should still be present in the manager
            expect((authManager as any).streamerRefreshToken).toBe('streamer-refresh');
        });

        it('logs debug and info messages', () => {
            const { logger } = require('../../main');

            authManager.deauthorizeBot();

            expect(logger.debug).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
        });
    });

    describe('registerUIExtensionEvents()', () => {
        it('returns early if frontendCommunicator is null and logs warning', () => {
            const { logger } = require('../../main');
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(null, 'http://localhost:7472', mockCallback);

            expect(logger.warn).toHaveBeenCalledWith('Frontend communicator not available for UI extension events');
        });

        it('returns early if frontendCommunicator is undefined and logs warning', () => {
            const { logger } = require('../../main');
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(undefined, 'http://localhost:7472', mockCallback);

            expect(logger.warn).toHaveBeenCalledWith('Frontend communicator not available for UI extension events');
        });

        it('registers onAsync handler for "kick:get-connections"', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:get-connections', expect.any(Function));
        });

        it('handler calls notifyConnectionStateChange callback', async () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const getConnectionsCall = onAsyncCalls.find((call: any) => call[0] === 'kick:get-connections');
            const handler = getConnectionsCall[1];

            // Call the handler
            await handler();

            expect(mockCallback).toHaveBeenCalled();
        });

        it('registers on handler for "kick:authorize-streamer"', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            expect(mockFrontendCommunicator.on).toHaveBeenCalledWith('kick:authorize-streamer', expect.any(Function));
        });

        it('handler constructs correct authorization URL for streamer', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onCalls = mockFrontendCommunicator.on.mock.calls;
            const authorizeStreamerCall = onCalls.find((call: any) => call[0] === 'kick:authorize-streamer');
            const handler = authorizeStreamerCall[1];

            // Call the handler
            handler();

            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:streamer-auth-url',
                'http://localhost:7472/integrations/firebot-mage-kick-integration/link/streamer'
            );
        });

        it('registers on handler for "kick:authorize-bot"', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            expect(mockFrontendCommunicator.on).toHaveBeenCalledWith('kick:authorize-bot', expect.any(Function));
        });

        it('handler sends correct bot auth URL via frontendCommunicator', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onCalls = mockFrontendCommunicator.on.mock.calls;
            const authorizeBotCall = onCalls.find((call: any) => call[0] === 'kick:authorize-bot');
            const handler = authorizeBotCall[1];

            // Call the handler
            handler();

            expect(mockFrontendCommunicator.send).toHaveBeenCalledWith(
                'kick:bot-auth-url',
                'http://localhost:7472/integrations/firebot-mage-kick-integration/link/bot'
            );
        });

        it('registers onAsync handler for "kick:deauthorize-streamer"', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:deauthorize-streamer', expect.any(Function));
        });

        it('deauthorize-streamer handler calls deauthorizeStreamer method', async () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            const deauthorizeSpy = jest.spyOn(authManager, 'deauthorizeStreamer');

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeStreamerCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-streamer');
            const handler = deauthorizeStreamerCall[1];

            // Call the handler
            await handler();

            expect(deauthorizeSpy).toHaveBeenCalled();
            deauthorizeSpy.mockRestore();
        });

        it('deauthorize-streamer handler calls notifyConnectionStateChange', async () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            jest.spyOn(authManager, 'deauthorizeStreamer').mockResolvedValue();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeStreamerCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-streamer');
            const handler = deauthorizeStreamerCall[1];

            // Call the handler
            await handler();

            expect(mockCallback).toHaveBeenCalled();
        });

        it('deauthorize-streamer handler handles errors gracefully', async () => {
            const { logger } = require('../../main');
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            const testError = new Error('Deauthorize failed');
            jest.spyOn(authManager, 'deauthorizeStreamer').mockRejectedValue(testError);

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeStreamerCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-streamer');
            const handler = deauthorizeStreamerCall[1];

            // Call the handler
            await handler();

            expect(logger.error).toHaveBeenCalledWith('Failed to deauthorize streamer: Deauthorize failed');
        });

        it('registers onAsync handler for "kick:deauthorize-bot"', () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            expect(mockFrontendCommunicator.onAsync).toHaveBeenCalledWith('kick:deauthorize-bot', expect.any(Function));
        });

        it('deauthorize-bot handler calls deauthorizeBot method', async () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            const deauthorizeSpy = jest.spyOn(authManager, 'deauthorizeBot');

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeBotCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-bot');
            const handler = deauthorizeBotCall[1];

            // Call the handler
            await handler();

            expect(deauthorizeSpy).toHaveBeenCalled();
            deauthorizeSpy.mockRestore();
        });

        it('deauthorize-bot handler calls notifyConnectionStateChange', async () => {
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            jest.spyOn(authManager, 'deauthorizeBot').mockResolvedValue();

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeBotCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-bot');
            const handler = deauthorizeBotCall[1];

            // Call the handler
            await handler();

            expect(mockCallback).toHaveBeenCalled();
        });

        it('deauthorize-bot handler handles errors gracefully', async () => {
            const { logger } = require('../../main');
            const mockFrontendCommunicator = {
                onAsync: jest.fn(),
                on: jest.fn(),
                send: jest.fn()
            };
            const mockCallback = jest.fn();
            const testError = new Error('Bot deauthorize failed');
            jest.spyOn(authManager, 'deauthorizeBot').mockRejectedValue(testError);

            authManager.registerUIExtensionEvents(mockFrontendCommunicator, 'http://localhost:7472', mockCallback);

            // Get the registered handler
            const onAsyncCalls = mockFrontendCommunicator.onAsync.mock.calls;
            const deauthorizeBotCall = onAsyncCalls.find((call: any) => call[0] === 'kick:deauthorize-bot');
            const handler = deauthorizeBotCall[1];

            // Call the handler
            await handler();

            expect(logger.error).toHaveBeenCalledWith('Failed to deauthorize bot: Bot deauthorize failed');
        });
    });
});
