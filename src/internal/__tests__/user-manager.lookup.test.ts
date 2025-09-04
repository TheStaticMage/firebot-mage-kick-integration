import { KickUserManager } from '../user-manager';
import { createMockKick } from '../mock-kick';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../webhook-handler/webhook-parsers', () => ({
    parseBasicKickUser: jest.fn()
}));

describe('KickUserManager lookupUserById', () => {
    let manager: KickUserManager;
    let mockKick: any;
    let mockParseBasicKickUser: jest.Mock;

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickUserManager(mockKick);

        // Get the mocked function
        const { parseBasicKickUser } = require('../webhook-handler/webhook-parsers');
        mockParseBasicKickUser = parseBasicKickUser as jest.Mock;
        mockParseBasicKickUser.mockClear();
    });

    describe('lookupUserById method', () => {
        it('should successfully retrieve user by ID', async () => {
            const mockApiResponse = {
                id: 123456,
                username: 'testuser',
                slug: 'testuser',
                bio: 'Test bio'
            };

            const mockParsedUser = {
                userId: '123456',
                name: 'testuser'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockApiResponse]
            });

            mockParseBasicKickUser.mockReturnValue(mockParsedUser);

            const result = await manager.lookupUserById('123456');

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/users?id=123456', 'GET');
            expect(mockParseBasicKickUser).toHaveBeenCalledWith(mockApiResponse);
            expect(result).toEqual(mockParsedUser);
        });

        it('should successfully retrieve user by numeric ID', async () => {
            const mockApiResponse = {
                id: 789012,
                username: 'numericuser',
                slug: 'numericuser'
            };

            const mockParsedUser = {
                userId: '789012',
                name: 'numericuser'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockApiResponse]
            });

            mockParseBasicKickUser.mockReturnValue(mockParsedUser);

            const result = await manager.lookupUserById(789012);

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/users?id=789012', 'GET');
            expect(result).toEqual(mockParsedUser);
        });

        it('should handle empty user ID', async () => {
            const mockApiResponse = {
                id: 111222,
                username: 'defaultuser',
                slug: 'defaultuser'
            };

            const mockParsedUser = {
                userId: '111222',
                name: 'defaultuser'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockApiResponse]
            });

            mockParseBasicKickUser.mockReturnValue(mockParsedUser);

            const result = await manager.lookupUserById('');

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/users', 'GET');
            expect(result).toEqual(mockParsedUser);
        });

        it('should throw error when API response is null', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: null
            });

            await expect(manager.lookupUserById('123456')).rejects.toThrow('Failed to retrieve user from Kick API.');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/users?id=123456', 'GET');
        });

        it('should throw error when API response has no data', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: undefined
            });

            await expect(manager.lookupUserById('123456')).rejects.toThrow('Failed to retrieve user from Kick API.');
        });

        it('should throw error when API response has wrong data length', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: []
            });

            await expect(manager.lookupUserById('123456')).rejects.toThrow('Failed to retrieve user from Kick API.');
        });

        it('should throw error when API response has multiple users', async () => {
            const mockUsers = [
                {
                    id: 123456,
                    username: 'user1',
                    slug: 'user1'
                },
                {
                    id: 789012,
                    username: 'user2',
                    slug: 'user2'
                }
            ];

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: mockUsers
            });

            await expect(manager.lookupUserById('123456')).rejects.toThrow('Failed to retrieve user from Kick API.');
        });

        it('should throw error when parsed user has no user ID', async () => {
            const mockApiResponse = {
                username: 'invaliduser',
                slug: 'invaliduser'
            };

            const mockParsedUser = {
                userId: '', // Empty user ID
                name: 'invaliduser'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockApiResponse]
            });

            mockParseBasicKickUser.mockReturnValue(mockParsedUser);

            await expect(manager.lookupUserById('123456')).rejects.toThrow('No user ID found in Kick API response.');
        });

        it('should propagate HTTP errors properly', async () => {
            const apiError = new Error('User service unavailable');
            mockKick.httpCallWithTimeout.mockRejectedValue(apiError);

            await expect(manager.lookupUserById('123456')).rejects.toThrow('User service unavailable');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/users?id=123456', 'GET');
        });

        it('should handle network timeout errors', async () => {
            const timeoutError = new Error('Request timeout');
            mockKick.httpCallWithTimeout.mockRejectedValue(timeoutError);

            await expect(manager.lookupUserById('123456')).rejects.toThrow('Request timeout');
        });
    });

    describe('Promise rejection prevention', () => {
        it('should not create unhandled promise rejections in lookupUserById', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('Test error'));

            try {
                await manager.lookupUserById('123456');
            } catch (error) {
                // Expected to catch the error
                expect(error).toBeInstanceOf(Error);
            }

            // Wait a tick to let any unhandled rejections surface
            await new Promise(resolve => setImmediate(resolve));

            expect(unhandledRejections).toHaveLength(0);

            // Restore original handlers
            process.removeAllListeners('unhandledRejection');
            originalHandler.forEach(handler => process.on('unhandledRejection', handler));
        });

        it('should not create unhandled promise rejections when API returns invalid data', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: null
            });

            try {
                await manager.lookupUserById('123456');
            } catch (error) {
                // Expected to catch the error
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('Failed to retrieve user from Kick API.');
            }

            // Wait a tick to let any unhandled rejections surface
            await new Promise(resolve => setImmediate(resolve));

            expect(unhandledRejections).toHaveLength(0);

            // Restore original handlers
            process.removeAllListeners('unhandledRejection');
            originalHandler.forEach(handler => process.on('unhandledRejection', handler));
        });

        it('should not create unhandled promise rejections when user has no ID', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            const mockApiResponse = {
                username: 'invaliduser',
                slug: 'invaliduser'
            };

            const mockParsedUser = {
                userId: '', // Empty user ID
                name: 'invaliduser'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockApiResponse]
            });

            mockParseBasicKickUser.mockReturnValue(mockParsedUser);

            try {
                await manager.lookupUserById('123456');
            } catch (error) {
                // Expected to catch the error
                expect(error).toBeInstanceOf(Error);
                expect((error as Error).message).toBe('No user ID found in Kick API response.');
            }

            // Wait a tick to let any unhandled rejections surface
            await new Promise(resolve => setImmediate(resolve));

            expect(unhandledRejections).toHaveLength(0);

            // Restore original handlers
            process.removeAllListeners('unhandledRejection');
            originalHandler.forEach(handler => process.on('unhandledRejection', handler));
        });
    });
});
