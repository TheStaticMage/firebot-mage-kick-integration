/* eslint-disable @typescript-eslint/unbound-method */
import { FirebotViewer } from "@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database";
import { IntegrationConstants } from '../../constants';
import { viewerRolesCondition } from '../viewer-roles';

// Mock the integration singleton
jest.mock('../../integration-singleton', () => ({
    integration: {
        kick: {
            userManager: {
                getViewerById: jest.fn(),
                getViewerByUsername: jest.fn()
            }
        }
    }
}));

// Mock the platform variable
jest.mock('../../variables/platform', () => ({
    platformVariable: {
        evaluator: jest.fn()
    }
}));

// Mock the main module
jest.mock('../../main', () => ({
    firebot: {
        modules: {
            viewerDatabase: {
                getViewerById: jest.fn(),
                getViewerByUsername: jest.fn()
            },
            customRolesManager: {
                userIsInRole: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

// Mock utility functions
jest.mock('../../internal/util', () => ({
    kickifyUserId: jest.fn(id => `k${id}`),
    unkickifyUserId: jest.fn(id => (id.startsWith('k') ? id.slice(1) : id)),
    unkickifyUsername: jest.fn(username => (username.endsWith('@kick') ? username.slice(0, -5) : username))
}));

// Import the mocked modules after setting up the mocks
import { integration } from '../../integration-singleton';
import { firebot } from '../../main';
import { platformVariable } from '../../variables/platform';

describe('viewerRolesCondition.predicate', () => {
    const mockKickGetViewerById = jest.mocked(integration.kick.userManager.getViewerById);
    const mockKickGetViewerByUsername = jest.mocked(integration.kick.userManager.getViewerByUsername);
    const mockTwitchGetViewerById = jest.mocked(firebot.modules.viewerDatabase.getViewerById);
    const mockTwitchGetViewerByUsername = jest.mocked(firebot.modules.viewerDatabase.getViewerByUsername);
    const mockCustomRolesManager = jest.mocked(firebot.modules.customRolesManager.userIsInRole);
    const mockPlatformEvaluator = jest.mocked(platformVariable.evaluator);

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

    // Helper function to create trigger metadata
    const createTrigger = (metadata: any = {}) => ({
        type: 'channel' as any,
        metadata: metadata
    });

    // Helper function to create condition settings
    const createConditionSettings = (comparisonType: string, leftSideValue: any, rightSideValue: any) => ({
        type: `${IntegrationConstants.INTEGRATION_ID}:viewerroles`,
        comparisonType,
        leftSideValue,
        rightSideValue
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('platform detection', () => {
        it('uses platform from platformVariable when available', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' });

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('testuser');
        });

        it('guesses kick platform for kickified usernames', async () => {
            mockPlatformEvaluator.mockReturnValue('unknown');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser@kick', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('testuser@kick');
        });

        it('guesses kick platform for kickified userIds', async () => {
            mockPlatformEvaluator.mockReturnValue('');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerById.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'k12345', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerById).toHaveBeenCalledWith('12345');
        });

        it('defaults to twitch platform for regular usernames', async () => {
            mockPlatformEvaluator.mockReturnValue('unknown');
            const mockViewer = createMockViewer(['mod']);
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockTwitchGetViewerByUsername).toHaveBeenCalledWith('testuser');
        });

        it('handles platform evaluation errors gracefully', async () => {
            mockPlatformEvaluator.mockImplementation(() => {
                throw new Error('Platform evaluation failed');
            });
            const mockViewer = createMockViewer(['mod']);
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockTwitchGetViewerByUsername).toHaveBeenCalledWith('testuser');
        });
    });

    describe('username/userId lookup', () => {
        it('uses leftSideValue when provided', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'specificuser', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' });

            await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('specificuser');
        });

        it('falls back to trigger.metadata.username when leftSideValue is empty', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', '', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' });

            await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('triggeruser');
        });

        it('falls back to trigger.metadata.username when leftSideValue is null', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', null, 'mod');
            const trigger = createTrigger({ username: 'triggeruser' });

            await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('triggeruser');
        });
    });

    describe('Kick platform lookups', () => {
        beforeEach(() => {
            mockPlatformEvaluator.mockReturnValue('kick');
        });

        it('looks up by username for non-numeric strings', async () => {
            const mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerByUsername).toHaveBeenCalledWith('testuser');
            expect(mockKickGetViewerById).not.toHaveBeenCalled();
        });

        it('looks up by userId for numeric strings', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockKickGetViewerById.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', '12345', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerById).toHaveBeenCalledWith('12345');
            expect(mockKickGetViewerByUsername).not.toHaveBeenCalled();
        });

        it('looks up by userId for kickified userIds', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockKickGetViewerById.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'k12345', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockKickGetViewerById).toHaveBeenCalledWith('12345');
        });

        it('returns false when Kick viewer not found', async () => {
            mockKickGetViewerByUsername.mockResolvedValue(undefined);

            const conditionSettings = createConditionSettings('has role', 'nonexistentuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });

        it('handles Kick lookup errors gracefully', async () => {
            mockKickGetViewerByUsername.mockRejectedValue(new Error('Database error'));

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });
    });

    describe('Twitch platform lookups', () => {
        beforeEach(() => {
            mockPlatformEvaluator.mockReturnValue('twitch');
        });

        it('looks up by username for non-numeric strings', async () => {
            const mockViewer = createMockViewer(['mod']);
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockTwitchGetViewerByUsername).toHaveBeenCalledWith('testuser');
            expect(mockTwitchGetViewerById).not.toHaveBeenCalled();
        });

        it('looks up by userId for numeric strings', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockTwitchGetViewerById.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', '12345', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockTwitchGetViewerById).toHaveBeenCalledWith('12345');
            expect(mockTwitchGetViewerByUsername).not.toHaveBeenCalled();
        });

        it('returns false when Twitch viewer not found', async () => {
            mockTwitchGetViewerByUsername.mockResolvedValue(undefined);

            const conditionSettings = createConditionSettings('has role', 'nonexistentuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });

        it('handles Twitch lookup errors gracefully', async () => {
            mockTwitchGetViewerByUsername.mockRejectedValue(new Error('Database error'));

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });
    });

    describe('custom roles (UUID-based)', () => {
        beforeEach(() => {
            mockPlatformEvaluator.mockReturnValue('twitch');
        });

        it('uses customRolesManager for UUID-based roles', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);
            mockCustomRolesManager.mockReturnValue(true);

            const uuidRole = '550e8400-e29b-41d4-a716-446655440000'; // 36 character UUID
            const conditionSettings = createConditionSettings('has role', 'testuser', uuidRole);
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
            expect(mockCustomRolesManager).toHaveBeenCalledWith('12345', [], [uuidRole]);
        });

        it('returns false when customRolesManager returns false', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);
            mockCustomRolesManager.mockReturnValue(false);

            const uuidRole = '550e8400-e29b-41d4-a716-446655440000';
            const conditionSettings = createConditionSettings('has role', 'testuser', uuidRole);
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });

        it('handles customRolesManager errors gracefully', async () => {
            const mockViewer = createMockViewer(['mod'], 'testuser', '12345');
            mockTwitchGetViewerByUsername.mockResolvedValue(mockViewer);
            mockCustomRolesManager.mockImplementation(() => {
                throw new Error('Custom roles error');
            });

            const uuidRole = '550e8400-e29b-41d4-a716-446655440000';
            const conditionSettings = createConditionSettings('has role', 'testuser', uuidRole);
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });
    });

    describe('built-in roles', () => {
        beforeEach(() => {
            mockPlatformEvaluator.mockReturnValue('kick');
        });

        it('checks twitchRoles for non-UUID roles', async () => {
            const mockViewer = createMockViewer(['broadcaster', 'mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'broadcaster');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
        });

        it('converts rightSideValue to string for role comparison', async () => {
            const mockViewer = createMockViewer(['123']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 123);
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(true);
        });

        it('returns false when viewer does not have the role', async () => {
            const mockViewer = createMockViewer(['vip']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'broadcaster');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });
    });

    describe('comparison types', () => {
        let mockViewer: FirebotViewer;

        beforeEach(() => {
            mockPlatformEvaluator.mockReturnValue('kick');
            mockViewer = createMockViewer(['mod']);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);
        });

        describe('positive comparisons (has role)', () => {
            it('returns true for "has role" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('returns true for "is in role" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('is in role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('returns true for "include" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('include', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('returns false for positive comparisons when viewer does not have the role', async () => {
                const conditionSettings = createConditionSettings('has role', 'testuser', 'broadcaster');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });
        });

        describe('negative comparisons (doesn\'t have role)', () => {
            it('returns false for "doesn\'t have role" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('doesn\'t have role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });

            it('returns false for "isn\'t in role" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('isn\'t in role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });

            it('returns false for "doesn\'t include" when viewer has the role', async () => {
                const conditionSettings = createConditionSettings('doesn\'t include', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });

            it('returns true for negative comparisons when viewer does not have the role', async () => {
                const conditionSettings = createConditionSettings('doesn\'t have role', 'testuser', 'broadcaster');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });
        });

        describe('unknown comparison types', () => {
            it('returns false for unknown comparison type', async () => {
                const conditionSettings = createConditionSettings('unknown_comparison', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });
        });
    });

    describe('edge cases', () => {
        it('handles empty viewer roles array', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            const mockViewer = createMockViewer([]);
            mockKickGetViewerByUsername.mockResolvedValue(mockViewer);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });

        it('handles null viewer gracefully', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            mockKickGetViewerByUsername.mockResolvedValue(null as any);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false);
        });

        it('handles missing trigger metadata', async () => {
            mockPlatformEvaluator.mockReturnValue('kick');
            // When no user identifier is available, the condition should return false
            mockKickGetViewerByUsername.mockResolvedValue(undefined);
            mockKickGetViewerById.mockResolvedValue(undefined);

            const conditionSettings = createConditionSettings('has role', '', 'mod');
            const trigger = createTrigger(); // No username in metadata

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
            expect(result).toBe(false); // Should return false when no user can be identified
        });
    });
});
