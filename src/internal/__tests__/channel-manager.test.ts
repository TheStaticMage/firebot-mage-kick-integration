/* eslint-disable @typescript-eslint/unbound-method */
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
    parseChannel: jest.fn()
}));

import { logger } from '../../main';
import { parseChannel as mockParseChannelImport } from '../webhook-handler/webhook-parsers';

const mockParseChannel = mockParseChannelImport as jest.MockedFunction<typeof mockParseChannelImport>;

jest.mock('../../events/livestream-metadata-updated', () => ({
    triggerCategoryChangedEvent: jest.fn(),
    triggerTitleChangedEvent: jest.fn()
}));

jest.mock('../../integration', () => ({
    integration: {
        getSettings: jest.fn(() => ({
            logging: { logWebhooks: false },
            advanced: { allowTestWebhooks: false },
            triggerTwitchEvents: { titleChanged: false }
        }))
    }
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

    describe('updateTitle method', () => {
        beforeEach(() => {
            manager.start = jest.fn();
            manager.stop = jest.fn();
            manager['channel'] = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 0, name: '', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: ''
            };
        });

        it('should return true and trigger event when title is updated from empty', () => {
            const result = manager.updateTitle('New Title');
            expect(result).toBe(true);
        });

        it('should return true when title is updated from non-empty', () => {
            if (manager['channel']) {
                manager['channel'].streamTitle = 'Old Title';
            }
            const result = manager.updateTitle('New Title');
            expect(result).toBe(true);
        });

        it('should return false when title is the same', () => {
            if (manager['channel']) {
                manager['channel'].streamTitle = 'Existing Title';
            }
            const result = manager.updateTitle('Existing Title');
            expect(result).toBe(false);
        });

        it('should return false when title is empty string', () => {
            const result = manager.updateTitle('');
            expect(result).toBe(false);
        });

        it('should return false when title is whitespace only', () => {
            const result = manager.updateTitle('   ');
            expect(result).toBe(false);
        });

        it('should return false when channel is not initialized', () => {
            manager['channel'] = null;
            const result = manager.updateTitle('New Title');
            expect(result).toBe(false);
        });

        it('should update the channel title property', () => {
            manager.updateTitle('Updated Title');
            if (manager['channel']) {
                expect(manager['channel'].streamTitle).toBe('Updated Title');
            }
        });
    });

    describe('updateCategory method', () => {
        beforeEach(() => {
            manager.start = jest.fn();
            manager.stop = jest.fn();
            manager['channel'] = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 0, name: '', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: 'Test Stream'
            };
        });

        it('should return true when category is updated from empty', () => {
            const newCategory = { id: 123, name: 'Gaming', thumbnail: 'url' };
            const result = manager.updateCategory(newCategory);
            expect(result).toBe(true);
        });

        it('should return true when category is updated from non-empty', () => {
            if (manager['channel']) {
                manager['channel'].category = { id: 100, name: 'Old Category', thumbnail: '' };
            }
            const newCategory = { id: 123, name: 'New Category', thumbnail: '' };
            const result = manager.updateCategory(newCategory);
            expect(result).toBe(true);
        });

        it('should return false when category is the same', () => {
            const category = { id: 123, name: 'Gaming', thumbnail: '' };
            if (manager['channel']) {
                manager['channel'].category = category;
            }
            const result = manager.updateCategory(category);
            expect(result).toBe(false);
        });

        it('should return false when category ID is 0', () => {
            const invalidCategory = { id: 0, name: 'Invalid', thumbnail: '' };
            const result = manager.updateCategory(invalidCategory);
            expect(result).toBe(false);
        });

        it('should return false when channel is not initialized', () => {
            manager['channel'] = null;
            const category = { id: 123, name: 'Gaming', thumbnail: '' };
            const result = manager.updateCategory(category);
            expect(result).toBe(false);
        });

        it('should update the channel category property', () => {
            const newCategory = { id: 456, name: 'Music', thumbnail: '' };
            manager.updateCategory(newCategory);
            if (manager['channel']) {
                expect(manager['channel'].category).toBe(newCategory);
            }
        });
    });

    describe('refreshChannel method', () => {
        const { triggerCategoryChangedEvent, triggerTitleChangedEvent } = require('../../events/livestream-metadata-updated');

        beforeEach(() => {
            manager.start = jest.fn();
            manager.stop = jest.fn();
            jest.clearAllMocks();
            manager['channel'] = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 0, name: '', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: ''
            };
        });

        it('should update channel when getChannelReal succeeds with new title and category', async () => {
            const newChannelData = {
                bannerPicture: 'banner.jpg',
                broadcasterUserId: 2,
                category: { id: 123, name: 'Gaming', thumbnail: 'thumb.jpg' },
                channelDescription: 'Test channel',
                slug: 'test',
                stream: { isLive: true, isMature: false, key: 'key', language: 'en', thumbnail: 'stream.jpg', url: 'url', viewerCount: 100 },
                streamTitle: 'New Stream Title'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            manager['refreshChannel']();
            await new Promise(resolve => setImmediate(resolve));

            if (manager['channel']) {
                expect(manager['channel'].streamTitle).toBe('New Stream Title');
                expect(manager['channel'].category.id).toBe(123);
                expect(manager['channel'].stream.viewerCount).toBe(100);
            }
        });

        it('should trigger category changed event when category is updated', async () => {
            const newChannelData = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 456, name: 'Music', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: ''
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            triggerCategoryChangedEvent.mockClear();

            manager['refreshChannel']();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(triggerCategoryChangedEvent).toHaveBeenCalledWith({ id: 456, name: 'Music', thumbnail: '' });
        });

        it('should trigger title changed event when title is updated', async () => {
            const newChannelData = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 0, name: '', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: 'Brand New Title'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            triggerTitleChangedEvent.mockClear();

            manager['refreshChannel']();
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(triggerTitleChangedEvent).toHaveBeenCalledWith('Brand New Title');
        });

        it('should not trigger events when values do not change', async () => {
            if (manager['channel']) {
                manager['channel'].streamTitle = 'Existing Title';
                manager['channel'].category = { id: 100, name: 'Gaming', thumbnail: '' };
            }

            const newChannelData = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 100, name: 'Gaming', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: 'Existing Title'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            triggerCategoryChangedEvent.mockClear();
            triggerTitleChangedEvent.mockClear();

            manager['refreshChannel']();
            await new Promise(resolve => setImmediate(resolve));

            expect(triggerCategoryChangedEvent).not.toHaveBeenCalled();
            expect(triggerTitleChangedEvent).not.toHaveBeenCalled();
        });

        it('should handle HTTP errors gracefully', async () => {
            const error = new Error('Network error');
            mockKick.httpCallWithTimeout.mockRejectedValue(error);

            manager['refreshChannel']();
            await new Promise(resolve => setImmediate(resolve));

            expect(logger.error).toHaveBeenCalledWith(`Failed to refresh channel status: ${error}`);
        });

        it('should trigger channel data updated event on success', async () => {
            const newChannelData = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 100, name: 'Gaming', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: true, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 50 },
                streamTitle: 'Updated Title'
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            const triggerChannelDataUpdatedEventSpy = jest.spyOn(manager, 'triggerChannelDataUpdatedEvent' as any).mockImplementation(jest.fn());

            manager['refreshChannel']();
            await new Promise(resolve => setImmediate(resolve));

            expect(triggerChannelDataUpdatedEventSpy).toHaveBeenCalled();
            triggerChannelDataUpdatedEventSpy.mockRestore();
        });

        it('should handle missing title gracefully', async () => {
            const newChannelData = {
                bannerPicture: '',
                broadcasterUserId: 2,
                category: { id: 100, name: 'Gaming', thumbnail: '' },
                channelDescription: '',
                slug: 'test',
                stream: { isLive: false, isMature: false, key: '', language: '', thumbnail: '', url: '', viewerCount: 0 },
                streamTitle: null as any
            };

            mockKick.httpCallWithTimeout.mockResolvedValue({
                data: [newChannelData]
            });
            mockParseChannel.mockReturnValue(newChannelData);

            triggerTitleChangedEvent.mockClear();

            manager['refreshChannel']();
            await new Promise(resolve => setImmediate(resolve));

            expect(triggerTitleChangedEvent).not.toHaveBeenCalled();
        });
    });
});
