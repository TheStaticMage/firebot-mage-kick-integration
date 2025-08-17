
import { Effects } from '@crowbartools/firebot-custom-scripts-types/types/effects';
import { platformRestriction } from '../platform';

describe('platformRestriction.predicate', () => {
    const baseTrigger: Effects.Trigger = {
        type: 'event',
        metadata: {
            username: '',
            eventData: {},
            platform: undefined,
            chatMessage: undefined
        }
    };

    const kickTrigger: Effects.Trigger = {
        ...baseTrigger,
        metadata: {
            ...baseTrigger.metadata,
            platform: 'kick'
        }
    };

    it('resolves true when comparison is "is" and platform matches', async () => {
        await expect(platformRestriction.predicate(kickTrigger, { comparison: 'is', platform: 'kick' })).resolves.toBe(true);
    });

    it('resolves true when comparison is "is" and platform is "any" and currentPlatform is not unknown', async () => {
        await expect(platformRestriction.predicate(kickTrigger, { comparison: 'is', platform: 'any' })).resolves.toBe(true);
    });

    it('resolves true when comparison is "is" and platform is "unknown" and currentPlatform is unknown', async () => {
        const unknownTrigger: Effects.Trigger = { ...baseTrigger, metadata: { ...baseTrigger.metadata } };
        await expect(platformRestriction.predicate(unknownTrigger, { comparison: 'is', platform: 'unknown' })).resolves.toBe(true);
    });

    it('resolves true when comparison is "isNot" and platform is "unknown" and currentPlatform is not unknown', async () => {
        await expect(platformRestriction.predicate(kickTrigger, { comparison: 'isNot', platform: 'unknown' })).resolves.toBe(true);
    });

    it('resolves true when comparison is "isNot" and platform is "any" and currentPlatform is unknown', async () => {
        const unknownTrigger: Effects.Trigger = { ...baseTrigger, metadata: { ...baseTrigger.metadata } };
        await expect(platformRestriction.predicate(unknownTrigger, { comparison: 'isNot', platform: 'any' })).resolves.toBe(true);
    });

    it('resolves true when comparison is "isNot" and platform does not match', async () => {
        await expect(platformRestriction.predicate(kickTrigger, { comparison: 'isNot', platform: 'twitch' })).resolves.toBe(true);
    });

    it('rejects when none of the conditions are met', async () => {
        const twitchTrigger: Effects.Trigger = { ...baseTrigger, metadata: { ...baseTrigger.metadata, eventSource: { id: 'twitch', name: 'twitch' } } };
        await expect(platformRestriction.predicate(twitchTrigger, { comparison: 'is', platform: 'kick' })).rejects.toThrow('Platform restriction failed');
    });
});
