import { KickChannelManager } from '../channel-manager';
import { createMockKick } from '../mock-kick';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    firebot: {}
}));

jest.mock('../webhook-handler/webhook-parsers', () => ({
    parseChannel: jest.fn().mockReturnValue({
        id: 123,
        userId: 456,
        slug: 'test-channel'
    })
}));

jest.mock('../../events/livestream-metadata-updated', () => ({
    triggerCategoryChangedEvent: jest.fn(),
    triggerTitleChangedEvent: jest.fn()
}));

describe('KickChannelManager', () => {
    let manager: KickChannelManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickChannelManager(mockKick);
    });

    describe('getCategoryInfo method', () => {
        it('should successfully retrieve category info and cache it', async () => {
            const mockCategory = {
                id: 123,
                name: 'Gaming',
                slug: 'gaming',
                tags: ['games', 'streaming'],
                description: 'Gaming category'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockCategory]
            });

            const result = await manager.getCategoryInfo(123);

            expect(result).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/123', 'GET');

            // Test caching - second call should not make HTTP request
            const cachedResult = await manager.getCategoryInfo(123);
            expect(cachedResult).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledTimes(1);
        });

        it('should throw error when API response is invalid', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: null
            });

            await expect(manager.getCategoryInfo(456)).rejects.toThrow('Failed to retrieve category from Kick API.');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/456', 'GET');
        });

        it('should throw error when API response has no data', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: undefined
            });

            await expect(manager.getCategoryInfo(789)).rejects.toThrow('Failed to retrieve category from Kick API.');
        });

        it('should throw error when API response has wrong data length', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: []
            });

            await expect(manager.getCategoryInfo(789)).rejects.toThrow('Failed to retrieve category from Kick API.');
        });

        it('should propagate HTTP errors properly', async () => {
            const networkError = new Error('Network timeout');
            mockKick.httpCallWithTimeout.mockRejectedValue(networkError);

            await expect(manager.getCategoryInfo(123)).rejects.toThrow('Network timeout');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/123', 'GET');
        });

        it('should not cache failed requests', async () => {
            mockKick.httpCallWithTimeout.mockRejectedValueOnce(new Error('First failure'));

            await expect(manager.getCategoryInfo(123)).rejects.toThrow('First failure');

            // Second call should retry the HTTP request
            const mockCategory = {
                id: 123,
                name: 'Gaming',
                slug: 'gaming'
            };
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockCategory]
            });

            const result = await manager.getCategoryInfo(123);
            expect(result).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('Promise rejection prevention', () => {
        it('should not create unhandled promise rejections in getCategoryInfo', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('Test error'));

            try {
                await manager.getCategoryInfo(123);
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
    });
});

describe('KickChannelManager async fixes - Issue #1 Promise rejection fixes', () => {
    let manager: KickChannelManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickChannelManager(mockKick);
    });

    describe('getCategoryInfo method', () => {
        it('should successfully retrieve category info and cache it', async () => {
            const mockCategory = {
                id: 123,
                name: 'Gaming',
                slug: 'gaming',
                tags: ['games', 'streaming'],
                description: 'Gaming category'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockCategory]
            });

            const result = await manager.getCategoryInfo(123);

            expect(result).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/123', 'GET');

            // Test caching - second call should not make HTTP request
            const cachedResult = await manager.getCategoryInfo(123);
            expect(cachedResult).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledTimes(1);
        });

        it('should throw error when API response is invalid', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: null
            });

            await expect(manager.getCategoryInfo(456)).rejects.toThrow('Failed to retrieve category from Kick API.');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/456', 'GET');
        });

        it('should throw error when API response has no data', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: undefined
            });

            await expect(manager.getCategoryInfo(789)).rejects.toThrow('Failed to retrieve category from Kick API.');
        });

        it('should throw error when API response has wrong data length', async () => {
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: []
            });

            await expect(manager.getCategoryInfo(789)).rejects.toThrow('Failed to retrieve category from Kick API.');
        });

        it('should propagate HTTP errors properly', async () => {
            const networkError = new Error('Network timeout');
            mockKick.httpCallWithTimeout.mockRejectedValue(networkError);

            await expect(manager.getCategoryInfo(123)).rejects.toThrow('Network timeout');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/categories/123', 'GET');
        });

        it('should not cache failed requests', async () => {
            mockKick.httpCallWithTimeout.mockRejectedValueOnce(new Error('First failure'));

            await expect(manager.getCategoryInfo(123)).rejects.toThrow('First failure');

            // Second call should retry the HTTP request
            const mockCategory = {
                id: 123,
                name: 'Gaming',
                slug: 'gaming'
            };
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockCategory]
            });

            const result = await manager.getCategoryInfo(123);
            expect(result).toEqual(mockCategory);
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledTimes(2);
        });
    });

    describe('getChannelReal method (via test helper)', () => {
        it('should successfully retrieve channel info by username', async () => {
            const mockChannel = {
                id: 456,
                userId: 789,
                slug: 'test-channel',
                user: {
                    id: 789,
                    username: 'testuser'
                }
            };

            // Mock the parseChannel function by ensuring response has correct structure
            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockChannel]
            });

            await manager.getChannel('test-channel');

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/channels?slug=test-channel', 'GET', '', expect.any(AbortSignal));
        });

        it('should successfully retrieve channel info by user ID', async () => {
            const mockChannel = {
                id: 456,
                userId: 789,
                slug: 'test-channel'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockChannel]
            });

            await manager.getChannel(789);

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/channels?broadcaster_user_id=789', 'GET', '', expect.any(AbortSignal));
        });

        it('should handle empty parameters', async () => {
            const mockChannel = {
                id: 456,
                userId: 789,
                slug: 'test-channel'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [mockChannel]
            });

            await manager.getChannel();

            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/channels', 'GET', '', expect.any(AbortSignal));
        });

        it('should propagate HTTP errors properly', async () => {
            const apiError = new Error('Channel not found');
            mockKick.httpCallWithTimeout.mockRejectedValue(apiError);

            await expect(manager.getChannel('nonexistent')).rejects.toThrow('Channel not found');
            expect(mockKick.httpCallWithTimeout).toHaveBeenCalledWith('/public/v1/channels?slug=nonexistent', 'GET', '', expect.any(AbortSignal));
        });
    });

    describe('Promise rejection prevention', () => {
        it('should not create unhandled promise rejections in getCategoryInfo', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('Test error'));

            try {
                await manager.getCategoryInfo(123);
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

        it('should not create unhandled promise rejections in getChannelReal', async () => {
            // Setup unhandled rejection listener
            const unhandledRejections: any[] = [];
            const originalHandler = process.listeners('unhandledRejection');
            process.removeAllListeners('unhandledRejection');
            process.on('unhandledRejection', (reason) => {
                unhandledRejections.push(reason);
            });

            mockKick.httpCallWithTimeout.mockRejectedValue(new Error('Test error'));

            try {
                await manager.getChannel('test');
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
    });
});
