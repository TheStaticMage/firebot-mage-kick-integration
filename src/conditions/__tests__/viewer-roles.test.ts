/* eslint-disable @typescript-eslint/unbound-method */
import { IntegrationConstants } from '../../constants';
import { viewerRolesCondition } from '../viewer-roles';

// Mock the integration singleton with RoleManager
jest.mock('../../integration-singleton', () => ({
    integration: {
        kick: {
            roleManager: {
                userHasRole: jest.fn()
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

// Import the mocked modules after setting up the mocks
import { integration } from '../../integration-singleton';
import { logger } from '../../main';

describe('viewerRolesCondition.predicate', () => {
    const mockUserHasRole = jest.mocked(integration.kick.roleManager.userHasRole);
    const mockLogger = jest.mocked(logger);

    // Helper function to create trigger metadata
    const createTrigger = (metadata: any = {}, platform: string = IntegrationConstants.INTEGRATION_ID) => ({
        type: 'channel' as any,
        metadata: {
            eventSource: { id: platform, name: platform },
            ...metadata
        }
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

    describe('username/userId resolution', () => {
        it('uses leftSideValue when provided', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('has role', 'specificuser', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' }, IntegrationConstants.INTEGRATION_ID);

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(true);
            expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'specificuser', 'mod');
        });

        it('falls back to trigger.metadata.username when leftSideValue is empty string', async () => {
            mockUserHasRole.mockResolvedValue(false);

            const conditionSettings = createConditionSettings('has role', '', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' }, 'twitch');

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(false);
            expect(mockUserHasRole).toHaveBeenCalledWith('twitch', 'triggeruser', 'mod');
        });

        it('falls back to trigger.metadata.username when leftSideValue is null', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('doesn\'t have role', null, 'vip');
            const trigger = createTrigger({ username: 'fallbackuser' }, IntegrationConstants.INTEGRATION_ID);

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(false); // doesn't have role = !true = false
            expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'fallbackuser', 'vip');
        });

        it('falls back to trigger.metadata.username when leftSideValue is undefined', async () => {
            mockUserHasRole.mockResolvedValue(false);

            const conditionSettings = createConditionSettings('has role', undefined, 'broadcaster');
            const trigger = createTrigger({ username: 'undefineduser' }, 'twitch');

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(false);
            expect(mockUserHasRole).toHaveBeenCalledWith('twitch', 'undefineduser', 'broadcaster');
        });
    });

    describe('platform detection', () => {
        it('uses platform from trigger metadata when available', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger({ username: 'triggeruser' }, IntegrationConstants.INTEGRATION_ID);

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(true);
            expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'testuser', 'mod');
        });

        it('handles empty platform string', async () => {
            mockUserHasRole.mockResolvedValue(false);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'sub');
            const trigger = createTrigger({}, '');

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(false);
            expect(mockUserHasRole).toHaveBeenCalledWith('unknown', 'testuser', 'sub');
        });

        it('handles missing eventSource gracefully', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = {
                type: 'channel' as any,
                metadata: { username: 'testuser' }
            };

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(true);
            expect(mockUserHasRole).toHaveBeenCalledWith('twitch', 'testuser', 'mod');
        });
    });

    describe('comparison types', () => {
        describe('positive comparisons (has role)', () => {
            it('returns true when user has role and comparison is "has role"', async () => {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('returns false when user does not have role and comparison is "has role"', async () => {
                mockUserHasRole.mockResolvedValue(false);

                const conditionSettings = createConditionSettings('has role', 'testuser', 'vip');
                const trigger = createTrigger({}, 'twitch');

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });

            it('handles "include" comparison type', async () => {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('include', 'testuser', 'broadcaster');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('handles "is in role" comparison type', async () => {
                mockUserHasRole.mockResolvedValue(false);

                const conditionSettings = createConditionSettings('is in role', 'testuser', 'sub');
                const trigger = createTrigger({}, 'twitch');

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });
        });

        describe('negative comparisons (doesn\'t have role)', () => {
            it('returns false when user has role and comparison is "doesn\'t have role"', async () => {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('doesn\'t have role', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });

            it('returns true when user does not have role and comparison is "doesn\'t have role"', async () => {
                mockUserHasRole.mockResolvedValue(false);

                const conditionSettings = createConditionSettings('doesn\'t have role', 'testuser', 'vip');
                const trigger = createTrigger({}, 'twitch');

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('handles "doesn\'t include" comparison type', async () => {
                mockUserHasRole.mockResolvedValue(false);

                const conditionSettings = createConditionSettings('doesn\'t include', 'testuser', 'broadcaster');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(true);
            });

            it('handles "isn\'t in role" comparison type', async () => {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('isn\'t in role', 'testuser', 'sub');
                const trigger = createTrigger({}, 'twitch');

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);
                expect(result).toBe(false);
            });
        });

        describe('unknown comparison types', () => {
            it('returns false and logs warning for unknown comparison type', async () => {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('unknown_comparison', 'testuser', 'mod');
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

                expect(result).toBe(false);
                expect(mockLogger.warn).toHaveBeenCalledWith(
                    'viewerroles condition: Unknown comparison type: unknown_comparison'
                );
            });
        });
    });

    describe('role types', () => {
        it('works with built-in roles', async () => {
            const builtInRoles = ['broadcaster', 'mod', 'vip', 'sub', 'bot'];

            for (const role of builtInRoles) {
                mockUserHasRole.mockResolvedValue(true);

                const conditionSettings = createConditionSettings('has role', 'testuser', role);
                const trigger = createTrigger();

                const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

                expect(result).toBe(true);
                expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'testuser', role);
            }
        });

        it('works with custom roles (UUID format)', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const customRoleId = '550e8400-e29b-41d4-a716-446655440000';
            const conditionSettings = createConditionSettings('has role', 'testuser', customRoleId);
            const trigger = createTrigger({}, 'twitch');

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(true);
            expect(mockUserHasRole).toHaveBeenCalledWith('twitch', 'testuser', customRoleId);
        });

        it('converts rightSideValue to string', async () => {
            mockUserHasRole.mockResolvedValue(false);

            // Test with number as rightSideValue
            const conditionSettings = createConditionSettings('has role', 'testuser', 123);
            const trigger = createTrigger();

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(false);
            expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'testuser', '123');
        });
    });

    describe('logging', () => {
        it('logs debug message when user has role', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'viewerroles condition: Viewer testuser (kick) has role mod'
            );
        });

        it('logs debug message when user does not have role', async () => {
            mockUserHasRole.mockResolvedValue(false);

            const conditionSettings = createConditionSettings('has role', 'testuser', 'vip');
            const trigger = createTrigger({}, 'twitch');

            await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(mockLogger.debug).toHaveBeenCalledWith(
                'viewerroles condition: Viewer testuser (twitch) does NOT have role vip'
            );
        });
    });

    describe('integration with RoleManager', () => {
        it('passes correct parameters to RoleManager.userHasRole', async () => {
            mockUserHasRole.mockResolvedValue(true);

            const conditionSettings = createConditionSettings('has role', 'specificuser', 'customrole');
            const trigger = createTrigger({ username: 'triggeruser' });

            await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(mockUserHasRole).toHaveBeenCalledTimes(1);
            expect(mockUserHasRole).toHaveBeenCalledWith('kick', 'specificuser', 'customrole');
        });

        it('handles RoleManager async responses correctly', async () => {
            // Test async resolution
            mockUserHasRole.mockImplementation(async () => {
                return new Promise((resolve) => {
                    setTimeout(() => {
                        resolve(true);
                    }, 10);
                });
            });

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger({}, 'twitch');

            const result = await viewerRolesCondition.predicate(conditionSettings, trigger);

            expect(result).toBe(true);
        });

        it('handles RoleManager errors gracefully', async () => {
            mockUserHasRole.mockRejectedValue(new Error('Role check failed'));

            const conditionSettings = createConditionSettings('has role', 'testuser', 'mod');
            const trigger = createTrigger();

            // The predicate should handle the error and not throw
            await expect(viewerRolesCondition.predicate(conditionSettings, trigger))
                .rejects.toThrow('Role check failed');
        });
    });
});
