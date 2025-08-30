import { kickModeratorVariable } from '../moderator';

describe('kickModeratorVariable.evaluator', () => {
    const makeTrigger = (eventData: any): any => ({
        type: "event" as const,
        metadata: {
            username: 'testuser',
            eventData
        }
    });

    it('returns unkickified moderator if moderator is present', () => {
        expect(kickModeratorVariable.evaluator(makeTrigger({ moderator: 'mod2@kick' }))).toBe('mod2@kick');
        expect(kickModeratorVariable.evaluator(makeTrigger({ moderator: 'mod3' }))).toBe('mod3');
    });

    it('returns unkickified moderatorUsername if moderatorUsername is present', () => {
        expect(kickModeratorVariable.evaluator(makeTrigger({ moderatorUsername: 'mod4@kick' }))).toBe('mod4@kick');
        expect(kickModeratorVariable.evaluator(makeTrigger({ moderatorUsername: 'mod5' }))).toBe('mod5');
    });

    it('returns empty string if no moderator fields are present', () => {
        expect(kickModeratorVariable.evaluator(makeTrigger({}))).toBe('');
        expect(kickModeratorVariable.evaluator({ type: "event", metadata: { username: 'testuser' } } as any)).toBe('');
        expect(kickModeratorVariable.evaluator({ type: "event", metadata: {} } as any)).toBe('');
    });
});
