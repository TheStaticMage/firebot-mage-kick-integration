import {
    isConnectionReady,
    updateConnectionReadyStatus,
    getConnectionStatusMessage
} from '../connection-utils';
import { KickConnection } from '../../shared/types';

describe('connection-utils', () => {
    describe('isConnectionReady()', () => {
        it('returns true when both refreshToken and ready are truthy', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: true,
                username: 'test-user'
            };

            expect(isConnectionReady(connection)).toBe(true);
        });

        it('returns false when refreshToken is missing', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: '',
                tokenExpiresAt: 0,
                ready: true,
                username: 'test-user'
            };

            expect(isConnectionReady(connection)).toBe(false);
        });

        it('returns false when ready is false', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: false,
                username: 'test-user'
            };

            expect(isConnectionReady(connection)).toBe(false);
        });

        it('returns false for both falsy', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: '',
                tokenExpiresAt: 0,
                ready: false,
                username: 'test-user'
            };

            expect(isConnectionReady(connection)).toBe(false);
        });
    });

    describe('updateConnectionReadyStatus()', () => {
        it('sets ready to true', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: false,
                username: 'test-user'
            };

            updateConnectionReadyStatus(connection, true);

            expect(connection.ready).toBe(true);
        });

        it('sets ready to false', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: true,
                username: 'test-user'
            };

            updateConnectionReadyStatus(connection, false);

            expect(connection.ready).toBe(false);
        });

        it('updates existing connection object correctly', () => {
            const connection: KickConnection = {
                type: 'bot',
                accessToken: 'old-access',
                refreshToken: 'old-refresh',
                tokenExpiresAt: 1000,
                ready: false,
                username: 'bot-user'
            };

            updateConnectionReadyStatus(connection, true);

            // Verify other properties remain unchanged
            expect(connection.type).toBe('bot');
            expect(connection.accessToken).toBe('old-access');
            expect(connection.refreshToken).toBe('old-refresh');
            expect(connection.tokenExpiresAt).toBe(1000);
            expect(connection.username).toBe('bot-user');
            expect(connection.ready).toBe(true);
        });
    });

    describe('getConnectionStatusMessage()', () => {
        it('returns "Integration disconnected" when isIntegrationConnected is false', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: true,
                username: 'test-user'
            };

            const message = getConnectionStatusMessage(connection, false);

            expect(message).toBe('Integration disconnected');
        });

        it('returns "Authorization required" when not ready and no refreshToken', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: '',
                refreshToken: '',
                tokenExpiresAt: 0,
                ready: false,
                username: 'test-user'
            };

            const message = getConnectionStatusMessage(connection, true);

            expect(message).toBe('Authorization required');
        });

        it('returns "Awaiting connection" when not ready but has refreshToken', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: '',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: false,
                username: 'test-user'
            };

            const message = getConnectionStatusMessage(connection, true);

            expect(message).toBe('Awaiting connection');
        });

        it('returns "Ready" when ready and no tokenExpiresAt', () => {
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: 0,
                ready: true,
                username: 'test-user'
            };

            const message = getConnectionStatusMessage(connection, true);

            expect(message).toBe('Ready');
        });

        it('formats expiration date correctly when tokenExpiresAt is set', () => {
            const expiryTime = new Date(2025, 11, 25, 14, 30, 45).getTime(); // Dec 25, 2025 2:30:45 PM
            const connection: KickConnection = {
                type: 'streamer',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: expiryTime,
                ready: true,
                username: 'test-user'
            };

            const message = getConnectionStatusMessage(connection, true);

            // Message should follow format: "Ready - Token expires YYYY-MM-DD at HH:mm:ss"
            expect(message).toContain('Ready - Token expires');
            expect(message).toMatch(/2025-12-25 at 14:30:45/);
        });

        it('handles edge case with tokenExpiresAt at midnight', () => {
            const midnightTime = new Date(2025, 11, 26, 0, 0, 0).getTime(); // Dec 26, 2025 midnight
            const connection: KickConnection = {
                type: 'bot',
                accessToken: 'access-token',
                refreshToken: 'refresh-token',
                tokenExpiresAt: midnightTime,
                ready: true,
                username: 'bot-user'
            };

            const message = getConnectionStatusMessage(connection, true);

            expect(message).toContain('Ready - Token expires');
            expect(message).toMatch(/2025-12-26 at 00:00:00/);
        });
    });
});
