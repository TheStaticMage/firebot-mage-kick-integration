import { KickRewardsState } from '../kick-rewards-state';
import { KickRewardManagementData } from '../../shared/types';

jest.mock('../../main', () => ({
    firebot: {
        modules: {
            fs: {
                existsSync: jest.fn(),
                readFileSync: jest.fn(),
                writeFileSync: jest.fn()
            }
        }
    },
    logger: {
        debug: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../util/datafile', () => ({
    getDataFilePath: jest.fn()
}));

const { firebot, logger } = require('../../main');
const { getDataFilePath } = require('../../util/datafile');

const mockFs = firebot.modules.fs;
const mockLogger = logger;
const mockGetDataFilePath = getDataFilePath;

describe('KickRewardsState', () => {
    let state: KickRewardsState;

    beforeEach(() => {
        jest.clearAllMocks();
        state = new KickRewardsState();
        mockGetDataFilePath.mockReturnValue('/data/kick-rewards-management.json');
    });

    describe('loadManagementState', () => {
        it('initializes empty state when file does not exist', () => {
            mockFs.existsSync.mockReturnValue(false);

            state.loadManagementState();

            expect(mockFs.existsSync).toHaveBeenCalledWith('/data/kick-rewards-management.json');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('not found'));
            expect(state.getAllManagementData()).toEqual({});
        });

        it('loads state from file when it exists', () => {
            const savedState = {
                'reward-1': {
                    managedOnKick: true,
                    kickRewardId: 'kick-123',
                    firebotRewardTitle: 'Test Reward',
                    overrides: { cost: 100, skipQueue: false, enabled: true }
                }
            };

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify(savedState));

            state.loadManagementState();

            expect(mockFs.readFileSync).toHaveBeenCalledWith('/data/kick-rewards-management.json', 'utf-8');
            expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('1 rewards managed'));
            expect(state.getAllManagementData()).toEqual(savedState);
        });

        it('initializes empty state on parse error', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue('invalid json');

            state.loadManagementState();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load'));
            expect(state.getAllManagementData()).toEqual({});
        });

        it('initializes empty state on read error', () => {
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockImplementation(() => {
                throw new Error('Read error');
            });

            state.loadManagementState();

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to load'));
            expect(state.getAllManagementData()).toEqual({});
        });
    });

    describe('saveManagementState', () => {
        it('saves state to file', () => {
            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);

            expect(mockFs.writeFileSync).toHaveBeenCalledWith(
                '/data/kick-rewards-management.json',
                expect.stringContaining('reward-1')
            );
        });

        it('logs error on write failure', () => {
            mockFs.writeFileSync.mockImplementation(() => {
                throw new Error('Write error');
            });

            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);

            expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to save'));
        });
    });

    describe('getManagementData', () => {
        it('returns management data for existing reward', () => {
            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);

            expect(state.getManagementData('reward-1')).toEqual(data);
        });

        it('returns undefined for non-existent reward', () => {
            expect(state.getManagementData('non-existent')).toBeUndefined();
        });
    });

    describe('setManagementData', () => {
        it('sets and saves management data', () => {
            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);

            expect(state.getManagementData('reward-1')).toEqual(data);
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('updates existing management data', () => {
            const data1: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            const data2: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-456',
                firebotRewardTitle: 'Updated Reward',
                overrides: { cost: 200, skipQueue: true, enabled: false }
            };

            state.setManagementData('reward-1', data1);
            state.setManagementData('reward-1', data2);

            expect(state.getManagementData('reward-1')).toEqual(data2);
        });
    });

    describe('removeManagementData', () => {
        it('removes existing management data', () => {
            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);
            expect(state.getManagementData('reward-1')).toEqual(data);

            state.removeManagementData('reward-1');

            expect(state.getManagementData('reward-1')).toBeUndefined();
            expect(mockFs.writeFileSync).toHaveBeenCalled();
        });

        it('does nothing for non-existent reward', () => {
            mockFs.writeFileSync.mockClear();

            state.removeManagementData('non-existent');

            expect(mockFs.writeFileSync).not.toHaveBeenCalled();
        });
    });

    describe('getManagedCount', () => {
        it('returns 0 for empty state', () => {
            expect(state.getManagedCount()).toBe(0);
        });

        it('counts only managed rewards', () => {
            state.setManagementData('reward-1', {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Reward 1',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            });

            state.setManagementData('reward-2', {
                managedOnKick: false,
                firebotRewardTitle: 'Reward 2',
                overrides: { cost: 200, skipQueue: false, enabled: true }
            });

            state.setManagementData('reward-3', {
                managedOnKick: true,
                kickRewardId: 'kick-456',
                firebotRewardTitle: 'Reward 3',
                overrides: { cost: 300, skipQueue: false, enabled: true }
            });

            expect(state.getManagedCount()).toBe(2);
        });
    });

    describe('canManageMore', () => {
        it('returns true when under 15 reward limit', async () => {
            const getTotalKickRewards = jest.fn().mockResolvedValue(10);

            const result = await state.canManageMore(getTotalKickRewards);

            expect(result).toBe(true);
            expect(getTotalKickRewards).toHaveBeenCalled();
        });

        it('returns false when at 15 reward limit', async () => {
            const getTotalKickRewards = jest.fn().mockResolvedValue(15);

            const result = await state.canManageMore(getTotalKickRewards);

            expect(result).toBe(false);
        });

        it('returns false when over 15 reward limit', async () => {
            const getTotalKickRewards = jest.fn().mockResolvedValue(20);

            const result = await state.canManageMore(getTotalKickRewards);

            expect(result).toBe(false);
        });

        it('returns true when exactly 14 rewards', async () => {
            const getTotalKickRewards = jest.fn().mockResolvedValue(14);

            const result = await state.canManageMore(getTotalKickRewards);

            expect(result).toBe(true);
        });
    });

    describe('getAllManagementData', () => {
        it('returns copy of empty state', () => {
            const result = state.getAllManagementData();

            expect(result).toEqual({});
            expect(result).not.toBe(state['managementState']);
        });

        it('returns copy of state with data', () => {
            const data: KickRewardManagementData = {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Test Reward',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            };

            state.setManagementData('reward-1', data);

            const result = state.getAllManagementData();

            expect(result).toEqual({ 'reward-1': data });
            expect(result).not.toBe(state['managementState']);
        });
    });

    describe('clearState', () => {
        it('clears all state', () => {
            state.setManagementData('reward-1', {
                managedOnKick: true,
                kickRewardId: 'kick-123',
                firebotRewardTitle: 'Reward 1',
                overrides: { cost: 100, skipQueue: false, enabled: true }
            });

            state.setManagementData('reward-2', {
                managedOnKick: true,
                kickRewardId: 'kick-456',
                firebotRewardTitle: 'Reward 2',
                overrides: { cost: 200, skipQueue: false, enabled: true }
            });

            state.clearState();

            expect(state.getAllManagementData()).toEqual({});
            expect(state.getManagedCount()).toBe(0);
        });
    });
});
