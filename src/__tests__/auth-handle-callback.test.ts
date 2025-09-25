/* eslint-disable camelcase, @typescript-eslint/unbound-method */
import { AuthManager } from '../internal/auth';
import { integration } from '../integration';
import { httpCallWithTimeout } from '../internal/http';

// Mock dependencies
jest.mock('../integration');
jest.mock('../internal/http');
jest.mock('../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

const mockIntegration = integration as jest.Mocked<typeof integration>;
const mockHttpCallWithTimeout = httpCallWithTimeout as jest.MockedFunction<typeof httpCallWithTimeout>;

describe('AuthManager.handleAuthCallback', () => {
    let authManager: AuthManager;
    let mockReq: any;
    let mockRes: any;

    beforeEach(() => {
        authManager = new AuthManager();

        // Setup mock request
        mockReq = {
            query: {
                code: 'test-auth-code',
                state: 'test-state-uuid'
            }
        };

        // Setup mock response
        mockRes = {
            status: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis()
        };

        // Reset all mocks
        jest.clearAllMocks();

        // Setup default integration settings mock
        mockIntegration.getSettings.mockReturnValue({
            connectivity: {
                firebotUrl: 'http://localhost:7472'
            },
            webhookProxy: {
                webhookProxyUrl: ''
            },
            kickApp: {
                clientId: 'test-client-id',
                clientSecret: 'test-client-secret'
            }
        } as any);

        mockIntegration.kick = {
            broadcaster: {
                userId: 12345
            },
            setAuthToken: jest.fn(),
            setBotAuthToken: jest.fn()
        } as any;

        mockIntegration.disconnect = jest.fn();
        mockIntegration.connect = jest.fn();
        mockIntegration.saveIntegrationTokenData = jest.fn();

        // Setup default token request and code challenge
        (authManager as any).tokenRequests = {
            'test-state-uuid': 'streamer'
        };
        (authManager as any).codeChallenges = {
            'test-state-uuid': 'test-code-verifier'
        };
    });

    describe('Error cases', () => {
        it('should return 400 when code is missing', async () => {
            mockReq.query.code = undefined;

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Missing 'code' or 'state' in callback.");
        });

        it('should return 400 when state is missing', async () => {
            mockReq.query.state = undefined;

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Missing 'code' or 'state' in callback.");
        });

        it('should return 400 when token type is unknown', async () => {
            (authManager as any).tokenRequests = {}; // Empty token requests

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith("Unknown token type for state: test-state-uuid");
        });
    });

    describe('Streamer authorization - Webhook Proxy', () => {
        beforeEach(() => {
            mockIntegration.getSettings.mockReturnValue({
                connectivity: {
                    firebotUrl: 'http://localhost:7472'
                },
                webhookProxy: {
                    webhookProxyUrl: 'https://webhook-proxy.example.com'
                },
                kickApp: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret'
                }
            } as any);

            (authManager as any).tokenRequests = {
                'test-state-uuid': 'streamer'
            };
        });

        it('should return 200 on successful streamer authorization with webhook proxy', async () => {
            const mockResponse = {
                access_token: 'streamer-access-token',
                refresh_token: 'streamer-refresh-token',
                expires_in: 3600,
                proxy_poll_key: 'proxy-poll-key'
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: 'https://webhook-proxy.example.com/auth/token',
                method: 'POST',
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code: 'test-auth-code',
                    code_verifier: 'test-code-verifier'
                })
            });

            expect(mockIntegration.kick.setAuthToken).toHaveBeenCalledWith('streamer-access-token');
            expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalled();
            expect(mockIntegration.disconnect).toHaveBeenCalled();
            expect(mockIntegration.connect).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for streamer!'));
        });

        it('should return 400 when streamer lacks proxy_poll_key with webhook proxy', async () => {
            const mockResponse = {
                access_token: 'streamer-access-token',
                refresh_token: 'streamer-refresh-token',
                expires_in: 3600
                // Missing proxy_poll_key
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('cannot be authorized as a streamer account because it is configured as a bot account'));
        });

        it('should return 500 on HTTP call failure with webhook proxy', async () => {
            const error = new Error('Network error');
            mockHttpCallWithTimeout.mockRejectedValue(error);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to exchange code for tokens via webhook proxy'));
        });
    });

    describe('Streamer authorization - Direct', () => {
        beforeEach(() => {
            mockIntegration.getSettings.mockReturnValue({
                connectivity: {
                    firebotUrl: 'http://localhost:7472'
                },
                webhookProxy: {
                    webhookProxyUrl: '' // Empty webhook proxy URL
                },
                kickApp: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret'
                }
            } as any);

            (authManager as any).tokenRequests = {
                'test-state-uuid': 'streamer'
            };
        });

        it('should return 200 on successful streamer authorization with direct auth', async () => {
            const mockResponse = {
                access_token: 'streamer-access-token',
                refresh_token: 'streamer-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: expect.stringContaining('/oauth/token'),
                method: 'POST',
                body: expect.stringContaining('grant_type=authorization_code')
            });

            expect(mockIntegration.kick.setAuthToken).toHaveBeenCalledWith('streamer-access-token');
            expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalled();
            expect(mockIntegration.disconnect).toHaveBeenCalled();
            expect(mockIntegration.connect).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for streamer!'));
        });

        it('should return 500 on HTTP call failure with direct auth', async () => {
            const error = new Error('API error');
            mockHttpCallWithTimeout.mockRejectedValue(error);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to exchange code for tokens: Error: API error'));
        });
    });

    describe('Bot authorization - Webhook Proxy', () => {
        beforeEach(() => {
            mockIntegration.getSettings.mockReturnValue({
                connectivity: {
                    firebotUrl: 'http://localhost:7472'
                },
                webhookProxy: {
                    webhookProxyUrl: 'https://webhook-proxy.example.com'
                },
                kickApp: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret'
                }
            } as any);

            (authManager as any).tokenRequests = {
                'test-state-uuid': 'bot'
            };

            // Mock verifyBotUser method
            (authManager as any).verifyBotUser = jest.fn().mockResolvedValue({
                userId: 67890,
                name: 'TestBot'
            });
        });

        it('should return 200 on successful bot authorization with webhook proxy', async () => {
            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
                // No proxy_poll_key for bot
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: 'https://webhook-proxy.example.com/auth/token',
                method: 'POST',
                body: JSON.stringify({
                    grant_type: 'authorization_code',
                    code: 'test-auth-code',
                    code_verifier: 'test-code-verifier'
                })
            });

            expect((authManager as any).verifyBotUser).toHaveBeenCalledWith('bot-access-token');
            expect(mockIntegration.kick.setBotAuthToken).toHaveBeenCalledWith('bot-access-token');
            expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalled();
            expect(mockIntegration.disconnect).toHaveBeenCalled();
            expect(mockIntegration.connect).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for bot!'));
        });

        it('should return 400 when bot has proxy_poll_key with webhook proxy', async () => {
            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600,
                proxy_poll_key: 'unexpected-proxy-poll-key'
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('cannot be authorized as a bot account because it is configured as a streamer account'));
        });

        it('should return 400 when broadcaster is not available for bot authorization', async () => {
            mockIntegration.kick.broadcaster = null;

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('A bot account cannot be authorized until the streamer account has been authorized'));
        });

        it('should return 400 when bot user ID matches broadcaster user ID', async () => {
            (authManager as any).verifyBotUser = jest.fn().mockResolvedValue({
                userId: 12345, // Same as broadcaster
                name: 'SameUser'
            });

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Cannot authorize the same account for both streamer and bot'));
        });

        it('should return 500 when bot user verification fails', async () => {
            (authManager as any).verifyBotUser = jest.fn().mockRejectedValue(new Error('Verification failed'));

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to verify bot account'));
        });

        it('should return 500 on HTTP call failure with webhook proxy', async () => {
            const error = new Error('Network error');
            mockHttpCallWithTimeout.mockRejectedValue(error);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to exchange code for tokens via webhook proxy'));
        });
    });

    describe('Bot authorization - Direct', () => {
        beforeEach(() => {
            mockIntegration.getSettings.mockReturnValue({
                connectivity: {
                    firebotUrl: 'http://localhost:7472'
                },
                webhookProxy: {
                    webhookProxyUrl: '' // Empty webhook proxy URL
                },
                kickApp: {
                    clientId: 'test-client-id',
                    clientSecret: 'test-client-secret'
                }
            } as any);

            (authManager as any).tokenRequests = {
                'test-state-uuid': 'bot'
            };

            // Mock verifyBotUser method
            (authManager as any).verifyBotUser = jest.fn().mockResolvedValue({
                userId: 67890,
                name: 'TestBot'
            });
        });

        it('should return 200 on successful bot authorization with direct auth', async () => {
            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockHttpCallWithTimeout).toHaveBeenCalledWith({
                url: expect.stringContaining('/oauth/token'),
                method: 'POST',
                body: expect.stringContaining('grant_type=authorization_code')
            });

            expect((authManager as any).verifyBotUser).toHaveBeenCalledWith('bot-access-token');
            expect(mockIntegration.kick.setBotAuthToken).toHaveBeenCalledWith('bot-access-token');
            expect(mockIntegration.saveIntegrationTokenData).toHaveBeenCalled();
            expect(mockIntegration.disconnect).toHaveBeenCalled();
            expect(mockIntegration.connect).toHaveBeenCalled();
            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Kick integration authorized for bot!'));
        });

        it('should return 400 when broadcaster is not available for bot authorization', async () => {
            mockIntegration.kick.broadcaster = null;

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('A bot account cannot be authorized until the streamer account has been authorized'));
        });

        it('should return 400 when bot user ID matches broadcaster user ID', async () => {
            (authManager as any).verifyBotUser = jest.fn().mockResolvedValue({
                userId: 12345, // Same as broadcaster
                name: 'SameUser'
            });

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Cannot authorize the same account for both streamer and bot'));
        });

        it('should return 500 when bot user verification fails', async () => {
            (authManager as any).verifyBotUser = jest.fn().mockRejectedValue(new Error('Verification failed'));

            const mockResponse = {
                access_token: 'bot-access-token',
                refresh_token: 'bot-refresh-token',
                expires_in: 3600
            };
            mockHttpCallWithTimeout.mockResolvedValue(mockResponse);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to verify bot account'));
        });

        it('should return 500 on HTTP call failure with direct auth', async () => {
            const error = new Error('API error');
            mockHttpCallWithTimeout.mockRejectedValue(error);

            await authManager.handleAuthCallback(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(500);
            expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Failed to exchange code for tokens: Error: API error'));
        });
    });
});
