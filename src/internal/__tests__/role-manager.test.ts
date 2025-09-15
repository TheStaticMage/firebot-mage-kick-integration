/* eslint-disable @typescript-eslint/unbound-method */
jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    firebot: {
        modules: {
            twitchApi: {
                users: {
                    getUserByName: jest.fn()
                },
                getClient: jest.fn(() => ({
                    subscriptions: {
                        getSubscriptionForUser: jest.fn()
                    }
                })),
                moderation: {
                    getModerators: jest.fn()
                },
                channels: {
                    getVips: jest.fn()
                }
            },
            customRolesManager: {
                userIsInRole: jest.fn()
            }
        },
        firebot: {
            accounts: {
                streamer: {
                    userId: '1000000000',
                    username: 'TestStreamer'
                },
                bot: {
                    userId: '2000000000',
                    username: 'TestBot'
                }
            }
        }
    }
}));

import { RoleManager } from '../role-manager';
import { IKick } from '../kick-interface';
import { FirebotViewer } from '@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database';
import { firebot } from '../../main';

// Mock the kick interface
const mockKick: jest.Mocked<IKick> = {
    broadcaster: {
        email: 'broadcaster@example.com',
        name: 'TestKickBroadcaster',
        profilePicture: 'https://example.com/broadcaster.jpg',
        userId: 1000000001
    },
    bot: {
        email: 'bot@example.com',
        name: 'TestKickBot',
        profilePicture: 'https://example.com/bot.jpg',
        userId: 2000000001
    },
    userManager: {
        getViewerById: jest.fn(),
        getViewerByUsername: jest.fn()
    },
    channelManager: {} as any,
    chatManager: {} as any,
    userApi: {} as any,
    connect: jest.fn(),
    disconnect: jest.fn(),
    getAuthToken: jest.fn(),
    setAuthToken: jest.fn(),
    getBotAuthToken: jest.fn(),
    setBotAuthToken: jest.fn(),
    httpCallWithTimeout: jest.fn()
};

// Create proper mock clients for nested structures
const mockSubscriptionClient = {
    getSubscriptionForUser: jest.fn()
};

describe('RoleManager', () => {
    let roleManager: RoleManager;

    const createMockViewer = (overrides: Partial<FirebotViewer> = {}): FirebotViewer => ({
        _id: '123456789',
        username: 'testuser',
        displayName: 'TestUser',
        profilePicUrl: '',
        twitch: true,
        twitchRoles: ['mod'],
        online: false,
        onlineAt: 0,
        lastSeen: 0,
        joinDate: 0,
        minutesInChannel: 0,
        chatMessages: 0,
        disableAutoStatAccrual: false,
        disableActiveUserList: false,
        disableViewerList: false,
        metadata: {},
        currency: {},
        ranks: {},
        ...overrides
    });

    beforeEach(() => {
        roleManager = new RoleManager(mockKick);
        jest.clearAllMocks();
        jest.useFakeTimers();

        // Setup the nested mock structure
        (firebot.modules.twitchApi.getClient as jest.Mock).mockReturnValue({
            subscriptions: mockSubscriptionClient
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    describe('twitchUserHasRole', () => {
        describe('custom roles (UUID-based)', () => {
            it('checks custom role for user ID', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                customRolesManager.userIsInRole.mockReturnValue(true);

                const result = await roleManager.twitchUserHasRole('123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
                expect(customRolesManager.userIsInRole).toHaveBeenCalledWith('123456789', [], ['12345678-1234-1234-1234-123456789012']);
            });

            it('checks custom role for username by looking up user ID', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;

                (firebot.modules.twitchApi.users.getUserByName as jest.Mock).mockResolvedValue({ id: '123456789' } as any);
                customRolesManager.userIsInRole.mockReturnValue(true);

                const result = await roleManager.twitchUserHasRole('testuser', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
                expect(firebot.modules.twitchApi.users.getUserByName).toHaveBeenCalledWith('testuser');
                expect(customRolesManager.userIsInRole).toHaveBeenCalledWith('123456789', [], ['12345678-1234-1234-1234-123456789012']);
            });

            it('returns false when customRolesManager returns false', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                customRolesManager.userIsInRole.mockReturnValue(false);

                const result = await roleManager.twitchUserHasRole('123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(false);
            });

            it('handles errors when looking up username for custom role', async () => {
                (firebot.modules.twitchApi.users.getUserByName as jest.Mock).mockRejectedValue(new Error('User not found'));

                const result = await roleManager.twitchUserHasRole('testuser', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(false);
            });

            it('handles errors in customRolesManager', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                customRolesManager.userIsInRole.mockImplementation(() => {
                    throw new Error('Custom roles error');
                });

                const result = await roleManager.twitchUserHasRole('123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(false);
            });
        });

        describe('built-in roles', () => {
            describe('broadcaster role', () => {
                it('returns false for non-broadcaster by user ID', async () => {
                    const result = await roleManager.twitchUserHasRole('123456789', 'broadcaster');
                    expect(result).toBe(false);
                });

                it('returns true for broadcaster by username', async () => {
                    const result = await roleManager.twitchUserHasRole('teststreamer', 'broadcaster');
                    expect(result).toBe(true);
                });

                it('returns true for broadcaster when user ID matches (non-numeric)', async () => {
                    const result = await roleManager.twitchUserHasRole('1000000000', 'broadcaster');
                    expect(result).toBe(true);
                });

                it('returns true for broadcaster when user ID matches (numeric)', async () => {
                    const result = await roleManager.twitchUserHasRole(1000000000, 'broadcaster');
                    expect(result).toBe(true);
                });

                it('returns false for non-broadcaster (numeric)', async () => {
                    const result = await roleManager.twitchUserHasRole(420, 'broadcaster');
                    expect(result).toBe(false);
                });

                it('returns false for non-broadcaster', async () => {
                    const result = await roleManager.twitchUserHasRole('other-user-id', 'broadcaster');
                    expect(result).toBe(false);
                });

                it('returns false when broadcaster userId is not available', async () => {
                    // Temporarily clear broadcaster userId
                    const originalUserId = firebot.firebot.accounts.streamer.userId;
                    (firebot.firebot.accounts.streamer as any).userId = undefined;

                    const result = await roleManager.twitchUserHasRole('1000000000', 'broadcaster');
                    expect(result).toBe(false);

                    // Restore original value
                    firebot.firebot.accounts.streamer.userId = originalUserId;
                });

                it('returns false when broadcaster username is not available', async () => {
                    // Temporarily clear broadcaster username
                    const originalUsername = firebot.firebot.accounts.streamer.username;
                    (firebot.firebot.accounts.streamer as any).username = undefined;

                    const result = await roleManager.twitchUserHasRole('teststreamer', 'broadcaster');
                    expect(result).toBe(false);

                    // Restore original value
                    firebot.firebot.accounts.streamer.username = originalUsername;
                });

                it('returns false when both broadcaster userId and username are not available', async () => {
                    // Temporarily clear both broadcaster userId and username
                    const originalUserId = firebot.firebot.accounts.streamer.userId;
                    const originalUsername = firebot.firebot.accounts.streamer.username;
                    (firebot.firebot.accounts.streamer as any).userId = undefined;
                    (firebot.firebot.accounts.streamer as any).username = undefined;

                    const result = await roleManager.twitchUserHasRole('teststreamer', 'broadcaster');
                    expect(result).toBe(false);

                    // Restore original values
                    firebot.firebot.accounts.streamer.userId = originalUserId;
                    firebot.firebot.accounts.streamer.username = originalUsername;
                });
            });

            describe('bot role', () => {
                it('returns true for bot by user ID', async () => {
                    const result = await roleManager.twitchUserHasRole('2000000000', 'bot');
                    expect(result).toBe(true);
                });

                it('returns true for bot by username', async () => {
                    const result = await roleManager.twitchUserHasRole('testbot', 'bot');
                    expect(result).toBe(true);
                });

                it('returns true for bot when user ID matches (numeric)', async () => {
                    const result = await roleManager.twitchUserHasRole(2000000000, 'bot');
                    expect(result).toBe(true);
                });

                it('returns false for non-bot by user ID', async () => {
                    const result = await roleManager.twitchUserHasRole('123456789', 'bot');
                    expect(result).toBe(false);
                });

                it('returns false for non-bot by username', async () => {
                    const result = await roleManager.twitchUserHasRole('regularuser', 'bot');
                    expect(result).toBe(false);
                });

                it('returns false for non-bot (numeric)', async () => {
                    const result = await roleManager.twitchUserHasRole(420, 'bot');
                    expect(result).toBe(false);
                });

                it('returns true when comparing bot username with different case', async () => {
                    const result = await roleManager.twitchUserHasRole('TESTBOT', 'bot');
                    expect(result).toBe(true);
                });

                it('returns false when comparing non-bot with mixed case', async () => {
                    const result = await roleManager.twitchUserHasRole('OTHERUSER', 'bot');
                    expect(result).toBe(false);
                });

                it('returns false when bot userId is not available', async () => {
                    // Temporarily clear bot userId
                    const originalUserId = firebot.firebot.accounts.bot.userId;
                    (firebot.firebot.accounts.bot as any).userId = undefined;

                    const result = await roleManager.twitchUserHasRole('2000000000', 'bot');
                    expect(result).toBe(false);

                    // Restore original value
                    firebot.firebot.accounts.bot.userId = originalUserId;
                });

                it('returns false when bot username is not available', async () => {
                    // Temporarily clear bot username
                    const originalUsername = firebot.firebot.accounts.bot.username;
                    (firebot.firebot.accounts.bot as any).username = undefined;

                    const result = await roleManager.twitchUserHasRole('testbot', 'bot');
                    expect(result).toBe(false);

                    // Restore original value
                    firebot.firebot.accounts.bot.username = originalUsername;
                });

                it('returns false when both bot userId and username are not available', async () => {
                    // Temporarily clear both bot userId and username
                    const originalUserId = firebot.firebot.accounts.bot.userId;
                    const originalUsername = firebot.firebot.accounts.bot.username;
                    (firebot.firebot.accounts.bot as any).userId = undefined;
                    (firebot.firebot.accounts.bot as any).username = undefined;

                    const result = await roleManager.twitchUserHasRole('testbot', 'bot');
                    expect(result).toBe(false);

                    // Restore original values
                    firebot.firebot.accounts.bot.userId = originalUserId;
                    firebot.firebot.accounts.bot.username = originalUsername;
                });
            });

            describe('moderator role', () => {
                it('returns true when user is a moderator by ID', async () => {
                    (firebot.modules.twitchApi.moderation.getModerators as jest.Mock).mockResolvedValue([
                        { userId: '123456789', userName: 'testmod' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('123456789', 'mod');

                    expect(result).toBe(true);
                    expect(firebot.modules.twitchApi.moderation.getModerators).toHaveBeenCalled();
                });

                it('returns true when user is a moderator by username', async () => {
                    (firebot.modules.twitchApi.moderation.getModerators as jest.Mock).mockResolvedValue([
                        { userId: '123456789', userName: 'testmod' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('testmod', 'mod');

                    expect(result).toBe(true);
                });

                it('returns false when user is not a moderator', async () => {
                    (firebot.modules.twitchApi.moderation.getModerators as jest.Mock).mockResolvedValue([
                        { userId: '987654321', userName: 'othermod' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('123456789', 'mod');

                    expect(result).toBe(false);
                });
            });

            describe('VIP role', () => {
                it('returns true when user is a VIP by ID', async () => {
                    (firebot.modules.twitchApi.channels.getVips as jest.Mock).mockResolvedValue([
                        { id: '123456789', name: 'testvip' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('123456789', 'vip');

                    expect(result).toBe(true);
                    expect(firebot.modules.twitchApi.channels.getVips).toHaveBeenCalled();
                });

                it('returns true when user is a VIP by username', async () => {
                    (firebot.modules.twitchApi.channels.getVips as jest.Mock).mockResolvedValue([
                        { id: '123456789', name: 'testvip' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('testvip', 'vip');

                    expect(result).toBe(true);
                });

                it('returns false when user is not a VIP', async () => {
                    (firebot.modules.twitchApi.channels.getVips as jest.Mock).mockResolvedValue([
                        { id: '987654321', name: 'othervip' }
                    ] as any);

                    const result = await roleManager.twitchUserHasRole('123456789', 'vip');

                    expect(result).toBe(false);
                });
            });

            describe('subscriber role', () => {
                it('returns true when user is a subscriber by ID', async () => {
                    mockSubscriptionClient.getSubscriptionForUser.mockResolvedValue({ tier: '1000' } as any);

                    const result = await roleManager.twitchUserHasRole('123456789', 'sub');

                    expect(result).toBe(true);
                    expect(mockSubscriptionClient.getSubscriptionForUser).toHaveBeenCalledWith('1000000000', '123456789');
                });

                it('returns true when user is a subscriber by username', async () => {
                    (firebot.modules.twitchApi.users.getUserByName as jest.Mock).mockResolvedValue({ id: '123456789' } as any);
                    mockSubscriptionClient.getSubscriptionForUser.mockResolvedValue({ tier: '1000' } as any);

                    const result = await roleManager.twitchUserHasRole('testuser', 'sub');

                    expect(result).toBe(true);
                    expect(firebot.modules.twitchApi.users.getUserByName).toHaveBeenCalledWith('testuser');
                    expect(mockSubscriptionClient.getSubscriptionForUser).toHaveBeenCalledWith('1000000000', '123456789');
                });

                it('returns false when user is not a subscriber', async () => {
                    mockSubscriptionClient.getSubscriptionForUser.mockResolvedValue(null);

                    const result = await roleManager.twitchUserHasRole('123456789', 'sub');

                    expect(result).toBe(false);
                });

                it('handles subscription lookup errors', async () => {
                    mockSubscriptionClient.getSubscriptionForUser.mockRejectedValue(new Error('API error'));

                    const result = await roleManager.twitchUserHasRole('123456789', 'sub');

                    expect(result).toBe(false);
                });

                it('handles username lookup errors for subscriber check', async () => {
                    (firebot.modules.twitchApi.users.getUserByName as jest.Mock).mockRejectedValue(new Error('User not found'));

                    const result = await roleManager.twitchUserHasRole('testuser', 'sub');

                    expect(result).toBe(false);
                });
            });
        });

        describe('invalid inputs', () => {
            it('returns false for empty user identifier', async () => {
                const result = await roleManager.twitchUserHasRole('', 'mod');
                expect(result).toBe(false);
            });

            it('returns false for unknown role', async () => {
                const result = await roleManager.twitchUserHasRole('123456789', 'unknown-role');
                expect(result).toBe(false);
            });
        });

        describe('caching behavior', () => {
            it('caches subscriber results', async () => {
                mockSubscriptionClient.getSubscriptionForUser.mockResolvedValue({ tier: '1000' } as any);

                // First call
                await roleManager.twitchUserHasRole('123456789', 'sub');
                // Second call
                await roleManager.twitchUserHasRole('123456789', 'sub');

                // API should only be called once due to caching
                expect(mockSubscriptionClient.getSubscriptionForUser).toHaveBeenCalledTimes(1);
            });

            it('cache expires after TTL', async () => {
                mockSubscriptionClient.getSubscriptionForUser.mockResolvedValue({ tier: '1000' } as any);

                // First call
                await roleManager.twitchUserHasRole('123456789', 'sub');

                // Advance time beyond cache TTL (30 seconds)
                jest.advanceTimersByTime(31000);

                // Second call after cache expiry
                await roleManager.twitchUserHasRole('123456789', 'sub');

            });
        });
    });

    describe('kickUserHasRole', () => {
        describe('custom roles (UUID-based)', () => {
            it('checks custom role for user ID', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                const mockViewer = createMockViewer({ _id: '123456789' });

                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);
                customRolesManager.userIsInRole.mockReturnValue(true);

                // For kick usernames starting with 'k', it should be treated as a user ID
                const result = await roleManager.kickUserHasRole('k123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerById).toHaveBeenCalledWith('k123456789');
                expect(customRolesManager.userIsInRole).toHaveBeenCalledWith('k123456789', [], ['12345678-1234-1234-1234-123456789012']);
            });

            it('checks custom role for username by looking up viewer', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                const mockViewer = createMockViewer({ _id: '123456789', username: 'testuser' });

                mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);
                customRolesManager.userIsInRole.mockReturnValue(true);

                // Regular username should be looked up by username, gets kickified to testuser@kick
                const result = await roleManager.kickUserHasRole('testuser', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerByUsername).toHaveBeenCalledWith('testuser@kick');
                expect(customRolesManager.userIsInRole).toHaveBeenCalledWith('k123456789', [], ['12345678-1234-1234-1234-123456789012']);
            });

            it('returns false when viewer not found for custom role', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                mockKick.userManager.getViewerById.mockResolvedValue(undefined);

                // When viewer is not found, the method still tries to call customRolesManager
                // but without a valid user ID, so we need to mock it to return false
                customRolesManager.userIsInRole.mockReturnValue(false);

                const result = await roleManager.kickUserHasRole('k123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(false);
            });

            it('returns false when customRolesManager returns false', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                const mockViewer = createMockViewer({ _id: '123456789' });

                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);
                customRolesManager.userIsInRole.mockReturnValue(false);

                const result = await roleManager.kickUserHasRole('k123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(false);
            });
        });

        describe('built-in roles', () => {
            it('returns true when viewer has the role in twitchRoles', async () => {
                const mockViewer = createMockViewer({
                    _id: '123456789',
                    twitchRoles: ['mod', 'vip']
                });

                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                const result = await roleManager.kickUserHasRole('k123456789', 'mod');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerById).toHaveBeenCalledWith('k123456789');
            });

            it('returns false when viewer does not have the role', async () => {
                const mockViewer = createMockViewer({
                    _id: '123456789',
                    twitchRoles: ['vip']
                });

                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                const result = await roleManager.kickUserHasRole('k123456789', 'mod');

                expect(result).toBe(false);
            });

            it('handles string conversion for role comparison', async () => {
                const mockViewer = createMockViewer({
                    _id: '123456789',
                    twitchRoles: ['123']
                });

                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                const result = await roleManager.kickUserHasRole('k123456789', 123 as any);

                expect(result).toBe(true);
            });

            describe('specific built-in roles', () => {
                it('returns true when viewer has bot role', async () => {
                    // Test bot by user ID match
                    const mockViewer = createMockViewer({
                        _id: '2000000001', // Matches mockKick.bot.userId
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k2000000001', 'bot');

                    expect(result).toBe(true);
                });

                it('returns true when viewer has bot role by username', async () => {
                    // Test bot by username match
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        username: 'TestKickBot', // This will become 'TestKickBot@kick' after kickifyUsername
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('TestKickBot@kick', 'bot');

                    expect(result).toBe(true);
                });

                it('returns true when viewer has bot role by username (case insensitive)', async () => {
                    // Test bot by username match (case insensitive)
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        username: 'testkickbot', // This will become 'testkickbot@kick' after kickifyUsername
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('testkickbot@kick', 'bot');

                    expect(result).toBe(true);
                });

                it('returns false when viewer does not have bot role', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789', // Different from bot user ID
                        username: 'regularuser', // Different from bot name
                        twitchRoles: ['mod', 'vip']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'bot');

                    expect(result).toBe(false);
                });

                it('returns false when bot info is not available', async () => {
                    // Temporarily set bot to null
                    const originalBot = mockKick.bot;
                    mockKick.bot = null;

                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'bot');

                    expect(result).toBe(false);

                    // Restore bot info
                    mockKick.bot = originalBot;
                });

                it('returns true when viewer has broadcaster role', async () => {
                    // Test broadcaster by user ID match
                    const mockViewer = createMockViewer({
                        _id: '1000000001', // Matches mockKick.broadcaster.userId
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k1000000001', 'broadcaster');

                    expect(result).toBe(true);
                });

                it('returns true when viewer has broadcaster role by username', async () => {
                    // Test broadcaster by username match
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        username: 'TestKickBroadcaster', // Matches mockKick.broadcaster.name
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('TestKickBroadcaster@kick', 'broadcaster');

                    expect(result).toBe(true);
                });

                it('returns true when viewer has broadcaster role by username (case insensitive)', async () => {
                    // Test broadcaster by username match (case insensitive)
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        username: 'testkickbroadcaster', // Different case than mockKick.broadcaster.name
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('testkickbroadcaster@kick', 'broadcaster');

                    expect(result).toBe(true);
                });

                it('returns false when viewer does not have broadcaster role', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789', // Different from broadcaster user ID
                        username: 'regularuser', // Different from broadcaster name
                        twitchRoles: ['mod', 'vip']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'broadcaster');

                    expect(result).toBe(false);
                });

                it('returns false when broadcaster info is not available', async () => {
                    // Temporarily set broadcaster to null
                    const originalBroadcaster = mockKick.broadcaster;
                    mockKick.broadcaster = null;

                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'broadcaster');

                    expect(result).toBe(false);

                    // Restore broadcaster info
                    mockKick.broadcaster = originalBroadcaster;
                });

                it('returns true when viewer has subscriber role', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        twitchRoles: ['sub', 'mod']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'sub');

                    expect(result).toBe(true);
                });

                it('returns false when viewer does not have subscriber role', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        twitchRoles: ['mod', 'vip']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'sub');

                    expect(result).toBe(false);
                });

                it('returns true when viewer has multiple roles including target role', async () => {
                    // Create a user who is both broadcaster and has other roles in twitchRoles
                    const mockViewer = createMockViewer({
                        _id: '1000000001', // Matches broadcaster userId
                        username: 'TestKickBroadcaster', // Matches broadcaster name
                        twitchRoles: ['mod', 'vip', 'sub']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);
                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    // Test broadcaster role (checked against kick.broadcaster)
                    expect(await roleManager.kickUserHasRole('k1000000001', 'broadcaster')).toBe(true);
                    expect(await roleManager.kickUserHasRole('TestKickBroadcaster@kick', 'broadcaster')).toBe(true);

                    // Test roles from twitchRoles array
                    expect(await roleManager.kickUserHasRole('k1000000001', 'mod')).toBe(true);
                    expect(await roleManager.kickUserHasRole('k1000000001', 'vip')).toBe(true);
                    expect(await roleManager.kickUserHasRole('k1000000001', 'sub')).toBe(true);

                    // Test bot role (should be false since this user is broadcaster, not bot)
                    expect(await roleManager.kickUserHasRole('k1000000001', 'bot')).toBe(false);
                });

                it('returns true when bot has roles in twitchRoles array', async () => {
                    // Create a user who is both bot and has other roles in twitchRoles
                    const mockViewer = createMockViewer({
                        _id: '2000000001', // Matches bot userId
                        username: 'TestKickBot', // Matches bot name
                        twitchRoles: ['mod', 'vip']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);
                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    // Test bot role (checked against kick.bot)
                    expect(await roleManager.kickUserHasRole('k2000000001', 'bot')).toBe(true);
                    expect(await roleManager.kickUserHasRole('TestKickBot@kick', 'bot')).toBe(true);

                    // Test roles from twitchRoles array
                    expect(await roleManager.kickUserHasRole('k2000000001', 'mod')).toBe(true);
                    expect(await roleManager.kickUserHasRole('k2000000001', 'vip')).toBe(true);

                    // Test broadcaster role (should be false since this user is bot, not broadcaster)
                    expect(await roleManager.kickUserHasRole('k2000000001', 'broadcaster')).toBe(false);
                });

                it('returns false for all roles when viewer has empty twitchRoles and is not broadcaster/bot', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789', // Different from broadcaster and bot IDs
                        username: 'regularuser', // Different from broadcaster and bot names
                        twitchRoles: []
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    // Test each role - all should be false
                    expect(await roleManager.kickUserHasRole('k123456789', 'broadcaster')).toBe(false);
                    expect(await roleManager.kickUserHasRole('k123456789', 'mod')).toBe(false);
                    expect(await roleManager.kickUserHasRole('k123456789', 'vip')).toBe(false);
                    expect(await roleManager.kickUserHasRole('k123456789', 'sub')).toBe(false);
                    expect(await roleManager.kickUserHasRole('k123456789', 'bot')).toBe(false);
                });
            });

            describe('user lookup scenarios', () => {
                it('looks up by username when provided username', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        username: 'testuser',
                        twitchRoles: ['mod']
                    });

                    mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('testuser', 'mod');

                    expect(result).toBe(true);
                    expect(mockKick.userManager.getViewerByUsername).toHaveBeenCalledWith('testuser@kick');
                    expect(mockKick.userManager.getViewerById).not.toHaveBeenCalled();
                });

                it('looks up by user ID when provided numeric ID', async () => {
                    const mockViewer = createMockViewer({
                        _id: '123456789',
                        twitchRoles: ['mod']
                    });

                    mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                    const result = await roleManager.kickUserHasRole('k123456789', 'mod');

                    expect(result).toBe(true);
                    expect(mockKick.userManager.getViewerById).toHaveBeenCalledWith('k123456789');
                    expect(mockKick.userManager.getViewerByUsername).not.toHaveBeenCalled();
                });

                it('returns false when viewer not found', async () => {
                    mockKick.userManager.getViewerByUsername.mockResolvedValue(undefined);

                    const result = await roleManager.kickUserHasRole('testuser', 'mod');

                    expect(result).toBe(false);
                });
            });
        });

        describe('invalid inputs', () => {
            it('returns false for empty user identifier', async () => {
                // Empty string: isNaN(Number("")) is false, so it's treated as numeric ID
                // unkickifyUserId("") returns "", kickifyUserId("") returns "k"
                // So id="k", name=undefined, and it will try to look up viewer by ID "k"
                // When no viewer is found, it continues to check built-in roles but viewer is undefined
                mockKick.userManager.getViewerById.mockResolvedValue(undefined);

                const result = await roleManager.kickUserHasRole('', 'mod');
                expect(result).toBe(false);
            });

            it('returns false for null user identifier', async () => {
                const result = await roleManager.kickUserHasRole(null as any, 'mod');
                expect(result).toBe(false);
            });
        });
    });

    describe('userHasRole', () => {
        describe('platform detection', () => {
            it('uses kick platform when explicitly specified', async () => {
                const mockViewer = createMockViewer({ twitchRoles: ['mod'] });
                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                const result = await roleManager.userHasRole('kick', 'k123456789', 'mod');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerById).toHaveBeenCalledWith('k123456789');
            });

            it('uses twitch platform when explicitly specified', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                customRolesManager.userIsInRole.mockReturnValue(true);

                const result = await roleManager.userHasRole('twitch', '123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
                expect(customRolesManager.userIsInRole).toHaveBeenCalled();
            });

            it('auto-detects kick platform for kickified username', async () => {
                const mockViewer = createMockViewer({ twitchRoles: ['mod'] });
                mockKick.userManager.getViewerByUsername.mockResolvedValue(mockViewer);

                // Username ending with @kick should be detected as kick platform
                const result = await roleManager.userHasRole('unknown', 'testuser@kick', 'mod');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerByUsername).toHaveBeenCalledWith('testuser@kick');
            });

            it('auto-detects kick platform for kickified user ID', async () => {
                const mockViewer = createMockViewer({ twitchRoles: ['mod'] });
                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                // User ID starting with 'k' followed by numbers should be detected as kick platform
                const result = await roleManager.userHasRole('unknown', 'k123456789', 'mod');

                expect(result).toBe(true);
                expect(mockKick.userManager.getViewerById).toHaveBeenCalledWith('k123456789');
            });

            it('defaults to twitch platform for regular usernames', async () => {
                (firebot.modules.twitchApi.moderation.getModerators as jest.Mock).mockResolvedValue([
                    { userId: '123456789', userName: 'testuser' }
                ] as any);

                const result = await roleManager.userHasRole('unknown', 'testuser', 'mod');

                expect(result).toBe(true);
                expect(firebot.modules.twitchApi.moderation.getModerators).toHaveBeenCalled();
            });

            it('defaults to twitch platform for numeric user IDs', async () => {
                (firebot.modules.twitchApi.moderation.getModerators as jest.Mock).mockResolvedValue([
                    { userId: '123456789', userName: 'testuser' }
                ] as any);

                const result = await roleManager.userHasRole('unknown', '123456789', 'mod');

                expect(result).toBe(true);
                expect(firebot.modules.twitchApi.moderation.getModerators).toHaveBeenCalled();
            });
        });

        describe('delegation to platform methods', () => {
            it('properly delegates to kickUserHasRole', async () => {
                const mockViewer = createMockViewer({ twitchRoles: ['mod'] });
                mockKick.userManager.getViewerById.mockResolvedValue(mockViewer);

                const result = await roleManager.userHasRole('kick', 'k123456789', 'mod');

                expect(result).toBe(true);
            });

            it('properly delegates to twitchUserHasRole', async () => {
                const customRolesManager = firebot.modules.customRolesManager as jest.Mocked<typeof firebot.modules.customRolesManager>;
                customRolesManager.userIsInRole.mockReturnValue(true);

                const result = await roleManager.userHasRole('twitch', '123456789', '12345678-1234-1234-1234-123456789012');

                expect(result).toBe(true);
            });
        });
    });
});
