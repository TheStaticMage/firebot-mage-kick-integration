import { kickUnbanTypeVariable } from '../unban-type';

describe('kickUnbanTypeVariable.evaluator', () => {
    const makeTrigger = (banType: any) => ({
        type: "event" as const,
        metadata: {
            username: 'testuser',
            eventData: banType !== undefined ? { banType } : undefined
        }
    });

    it('returns the banType if present', () => {
        expect(kickUnbanTypeVariable.evaluator(makeTrigger('timeout'))).toBe('timeout');
        expect(kickUnbanTypeVariable.evaluator(makeTrigger('permanent'))).toBe('permanent');
        expect(kickUnbanTypeVariable.evaluator(makeTrigger('other'))).toBe('permanent');
    });

    it('returns empty string if eventData is missing', () => {
        expect(kickUnbanTypeVariable.evaluator(makeTrigger(undefined))).toBe('');
        expect(kickUnbanTypeVariable.evaluator({ type: "event", metadata: { username: 'testuser' } } as any)).toBe('');
        expect(kickUnbanTypeVariable.evaluator({ type: "event", metadata: {} } as any)).toBe('');
    });
});
