import { kickRewardNameVariable } from '../reward-name';

describe('kickRewardNameVariable.evaluator', () => {
    const makeTrigger = (rewardName: any) => ({
        type: "event" as const,
        metadata: rewardName !== undefined ? { rewardName, username: 'testuser' } : { username: 'testuser' }
    });

    it('returns the rewardName if present', async () => {
        expect(await kickRewardNameVariable.evaluator(makeTrigger('Free Hydration'))).toBe('Free Hydration');
        expect(await kickRewardNameVariable.evaluator(makeTrigger('Highlight My Message'))).toBe('Highlight My Message');
    });

    it('returns empty string if rewardName is missing', async () => {
        expect(await kickRewardNameVariable.evaluator(makeTrigger(undefined))).toBe('');
        expect(await kickRewardNameVariable.evaluator({ type: "event", metadata: {} } as any)).toBe('');
    });

    it('returns empty string if metadata is missing', async () => {
        expect(await kickRewardNameVariable.evaluator({ type: "event", metadata: { username: 'testuser' } } as any)).toBe('');
    });
});
