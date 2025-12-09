import { kickRewardIdVariable } from '../reward-id';

describe('kickRewardIdVariable.evaluator', () => {
    const makeTrigger = (rewardId: any) => ({
        type: "event" as const,
        metadata: rewardId !== undefined ? { rewardId, username: 'testuser' } : { username: 'testuser' }
    });

    it('returns the rewardId if present', async () => {
        expect(await kickRewardIdVariable.evaluator(makeTrigger('reward-123'))).toBe('reward-123');
        expect(await kickRewardIdVariable.evaluator(makeTrigger('abc-def-ghi'))).toBe('abc-def-ghi');
    });

    it('returns empty string if rewardId is missing', async () => {
        expect(await kickRewardIdVariable.evaluator(makeTrigger(undefined))).toBe('');
        expect(await kickRewardIdVariable.evaluator({ type: "event", metadata: {} } as any)).toBe('');
    });

    it('returns empty string if metadata is missing', async () => {
        expect(await kickRewardIdVariable.evaluator({ type: "event", metadata: { username: 'testuser' } } as any)).toBe('');
    });
});
