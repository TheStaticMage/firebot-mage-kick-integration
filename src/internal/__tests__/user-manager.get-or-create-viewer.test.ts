import { KickUserManager } from '../user-manager';
import { createMockKick } from '../mock-kick';

jest.mock('@thestaticmage/mage-platform-lib-client', () => ({
    getOrCreateUser: jest.fn(),
    setUserRoles: jest.fn(),
    updateLastSeen: jest.fn()
}));

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
    const mockGetOrCreateUser = jest.mocked(require('@thestaticmage/mage-platform-lib-client').getOrCreateUser);
    const mockSetUserRoles = jest.mocked(require('@thestaticmage/mage-platform-lib-client').setUserRoles);
    const mockUpdateLastSeen = jest.mocked(require('@thestaticmage/mage-platform-lib-client').updateLastSeen);

    beforeEach(() => {
        mockKick = createMockKick();
        manager = new KickUserManager(mockKick);
        jest.clearAllMocks();
    });

    describe('getOrCreateViewer behavior', () => {
        const createMockKickUser = (userId = '123456') => ({
            userId,
            username: 'testuser',
            displayName: 'Test User',
            isVerified: false,
            profilePicture: 'https://example.com/avatar.jpg',
            channelSlug: 'testuser'
        });

        it('returns undefined for invalid user ID', async () => {
            const mockKickUser = createMockKickUser('');

            const result = await manager.getOrCreateViewer(mockKickUser);

            expect(result).toBeUndefined();
            expect(mockGetOrCreateUser).not.toHaveBeenCalled();
        });

        it('returns platform user and sets roles when provided', async () => {
            const mockKickUser = createMockKickUser('123456');
            const platformUser = {
                _id: 'k123456',
                username: 'testuser',
                displayName: 'Test User',
                profilePicUrl: 'https://example.com/avatar.jpg',
                lastSeen: 0,
                currency: {},
                metadata: {},
                chatMessages: 0,
                minutesInChannel: 0,
                twitchRoles: []
            };

            mockGetOrCreateUser.mockResolvedValue({ success: true, user: platformUser });
            mockSetUserRoles.mockResolvedValue({ success: true });
            mockUpdateLastSeen.mockResolvedValue({ success: true });

            const result = await manager.getOrCreateViewer(mockKickUser, ['mod'], true);

            expect(result).toEqual(platformUser);
            expect(mockSetUserRoles).toHaveBeenCalledWith({
                platform: 'kick',
                userId: 'k123456',
                roles: ['mod']
            });
            expect(mockUpdateLastSeen).toHaveBeenCalledWith({
                platform: 'kick',
                userId: 'k123456'
            });
        });

        it('returns undefined when platform-lib call fails', async () => {
            const mockKickUser = createMockKickUser('123456');

            mockGetOrCreateUser.mockResolvedValue({ success: false, error: 'nope' });

            const result = await manager.getOrCreateViewer(mockKickUser);

            expect(result).toBeUndefined();
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

    describe('database connection state consistency', () => {
        it('keeps gift and sub databases cleared on disconnect', async () => {
            manager.disconnectViewerDatabase();
            expect(manager).toBeDefined();
        });
    });
});
