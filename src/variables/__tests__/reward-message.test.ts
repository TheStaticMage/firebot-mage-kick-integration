import { kickRewardMessageVariable } from '../reward-message';

describe('kickRewardMessageVariable.evaluator', () => {
    const makeTrigger = (messageText: any) => ({
        type: "event" as const,
        metadata: messageText !== undefined ? { messageText, username: 'testuser' } : { username: 'testuser' }
    });

    it('returns the messageText if present', async () => {
        expect(await kickRewardMessageVariable.evaluator(makeTrigger('Hello world'))).toBe('Hello world');
        expect(await kickRewardMessageVariable.evaluator(makeTrigger('Multi word message'))).toBe('Multi word message');
        expect(await kickRewardMessageVariable.evaluator(makeTrigger(''))).toBe('');
    });

    it('returns empty string if messageText is missing', async () => {
        expect(await kickRewardMessageVariable.evaluator(makeTrigger(undefined))).toBe('');
        expect(await kickRewardMessageVariable.evaluator({ type: "event", metadata: {} } as any)).toBe('');
    });

    it('returns empty string if metadata is missing', async () => {
        expect(await kickRewardMessageVariable.evaluator({ type: "event", metadata: { username: 'testuser' } } as any)).toBe('');
    });
});
