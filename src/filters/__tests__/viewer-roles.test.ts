import { viewerRolesFilter } from '../viewer-roles';
import { IntegrationConstants } from '../../constants';
import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";

// Mock the integration singleton
jest.mock('../../integration-singleton', () => ({
    integration: {
        kick: {
            userManager: {
                getViewerById: jest.fn()
            }
        }
    }
}));

// Mock the logger
jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Import the mocked integration after setting up the mock
import { integration } from '../../integration-singleton';

describe('viewerRolesFilter.predicate', () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const mockGetViewerById = jest.mocked(integration.kick.userManager.getViewerById);

    // Helper function to create a mock FirebotViewer
    const createMockViewer = (twitchRoles: string[], username = 'testuser', id = '12345'): FirebotViewer => ({
        _id: id,
        username: username,
        displayName: username,
        profilePicUrl: '',
        twitch: false,
        twitchRoles: twitchRoles,
        online: false,
        onlineAt: 0,
        lastSeen: Date.now(),
        joinDate: Date.now(),
        minutesInChannel: 0,
        chatMessages: 0,
        disableAutoStatAccrual: false,
        disableActiveUserList: true,
        disableViewerList: true,
        metadata: {},
        currency: {},
        ranks: {}
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('basic validation', () => {
        it('returns false when both username and userId are missing', async () => {
            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: {}
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).not.toHaveBeenCalled();
        });

        it('returns false when username is empty string and userId is missing', async () => {
            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: '' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).not.toHaveBeenCalled();
        });

        it('returns false when viewer is not found', async () => {
            mockGetViewerById.mockResolvedValue(undefined);

            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });
    });

    describe('include comparison', () => {
        it('returns true when viewer has the specified role', async () => {
            const mockViewer = createMockViewer(['broadcaster', 'mod']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('returns false when viewer does not have the specified role', async () => {
            const mockViewer = createMockViewer(['mod', 'vip']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('returns true when viewer has multiple roles including the specified one', async () => {
            const mockViewer = createMockViewer(['sub', 'vip', 'mod']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'vip' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'chat-message',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('returns false when viewer has empty roles array', async () => {
            const mockViewer = createMockViewer([]);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'sub' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });
    });

    describe('doesn\'t include comparison', () => {
        it('returns false when viewer has the specified role', async () => {
            const mockViewer = createMockViewer(['broadcaster', 'mod']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'doesn\'t include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('returns true when viewer does not have the specified role', async () => {
            const mockViewer = createMockViewer(['mod', 'vip']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'doesn\'t include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('returns true when viewer has empty roles array', async () => {
            const mockViewer = createMockViewer([]);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'doesn\'t include', value: 'sub' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });
    });

    describe('role-specific tests', () => {
        it('correctly filters for broadcaster role', async () => {
            const mockViewer = createMockViewer(['broadcaster'], 'streamer');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'chat-message',
                eventMeta: { username: 'streamer', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it('correctly filters for mod role', async () => {
            const mockViewer = createMockViewer(['mod'], 'moderator');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'mod' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'chat-message',
                eventMeta: { username: 'moderator', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it('correctly filters for vip role', async () => {
            const mockViewer = createMockViewer(['vip'], 'vipuser');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'vip' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'vipuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it('correctly filters for founder role', async () => {
            const mockViewer = createMockViewer(['founder', 'sub'], 'founder');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'founder' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'founder', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it('correctly filters for sub role', async () => {
            const mockViewer = createMockViewer(['sub'], 'subscriber');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'sub' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'chat-message',
                eventMeta: { username: 'subscriber', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });

        it('correctly filters for og role', async () => {
            const mockViewer = createMockViewer(['og'], 'oguser');
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'og' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'oguser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
        });
    });

    describe('unknown comparison types', () => {
        it('returns false for unknown comparison type', async () => {
            const mockViewer = createMockViewer(['broadcaster']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'unknown_type', value: 'broadcaster' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });
    });

    describe('edge cases', () => {
        it('handles viewer with userId only (no username)', async () => {
            const mockViewer = createMockViewer(['mod']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'mod' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });

        it('handles viewer with username only (no userId) - calls getViewerById with undefined', async () => {
            // Since the predicate only uses userId for lookup, when userId is undefined,
            // getViewerById will be called with undefined and should return undefined
            mockGetViewerById.mockResolvedValue(undefined);

            const filterSettings = { comparisonType: 'include', value: 'mod' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'viewer-arrived',
                eventMeta: { username: 'testuser' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(false); // Should return false because viewer is not found
            expect(mockGetViewerById).toHaveBeenCalledWith(undefined);
        });

        it('uses userId when both username and userId are provided', async () => {
            const mockViewer = createMockViewer(['vip']);
            mockGetViewerById.mockResolvedValue(mockViewer);

            const filterSettings = { comparisonType: 'include', value: 'vip' };
            const eventData = {
                eventSourceId: IntegrationConstants.INTEGRATION_ID,
                eventId: 'chat-message',
                eventMeta: { username: 'testuser', userId: 'k12345' }
            };

            const result = await viewerRolesFilter.predicate(filterSettings, eventData);
            expect(result).toBe(true);
            expect(mockGetViewerById).toHaveBeenCalledWith('k12345');
        });
    });
});
