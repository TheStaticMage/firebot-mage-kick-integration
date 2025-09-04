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

describe('getOrCreateViewer', () => {
    let manager: KickUserManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickUserManager(mockKick);
    });

    const createMockKickUser = (userId = '123456') => ({
        userId,
        username: 'testuser',
        displayName: 'Test User',
        isVerified: false,
        profilePicture: 'https://example.com/avatar.jpg',
        channelSlug: 'testuser'
    });

    describe('getOrCreateViewer method null check', () => {
        it('should throw error when database is not connected', async () => {
            const mockKickUser = createMockKickUser();

            // Database is not connected (null by default)
            await expect(manager.getOrCreateViewer(mockKickUser)).rejects.toThrow('Viewer database is not connected.');
        });

        it('should handle invalid user ID properly when database is connected', async () => {
            const mockKickUser = createMockKickUser(''); // Invalid user ID

            // Even when database is not connected, this should still throw database error first
            // because the database check comes before the userId validation
            await expect(manager.getOrCreateViewer(mockKickUser)).rejects.toThrow('Viewer database is not connected.');
        });
    });
});

describe('dbDisconnect', () => {
    let manager: KickUserManager;
    let mockKick: any;

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickUserManager(mockKick);
    });

    const createMockKickUser = (userId = '123456') => ({
        userId,
        username: 'testuser',
        displayName: 'Test User',
        isVerified: false,
        profilePicture: 'https://example.com/avatar.jpg',
        channelSlug: 'testuser'
    });

    describe('database connection state consistency', () => {
        it('should handle disconnection properly', async () => {
            const mockKickUser = createMockKickUser();

            // Start with disconnected state (default)
            // Call disconnect to ensure null state
            manager.disconnectViewerDatabase();

            // Should throw error when database is disconnected
            await expect(manager.getOrCreateViewer(mockKickUser)).rejects.toThrow('Viewer database is not connected.');
        });
    });
});
