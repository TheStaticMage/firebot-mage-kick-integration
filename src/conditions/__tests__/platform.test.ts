import { Trigger } from "@crowbartools/firebot-custom-scripts-types/types/triggers";
import { platformCondition } from '../platform';

describe('platformCondition.predicate', () => {
    const baseTrigger: Trigger = {
        type: 'event',
        metadata: {
            username: '',
            eventData: {},
            platform: undefined,
            chatMessage: undefined
        }
    };

    const kickTrigger: Trigger = {
        ...baseTrigger,
        metadata: {
            ...baseTrigger.metadata,
            platform: 'kick'
        }
    };

    const twitchTrigger: Trigger = {
        ...baseTrigger,
        metadata: {
            ...baseTrigger.metadata,
            platform: 'twitch'
        }
    };

    it('resolves true when comparison is "is" and platform matches', () => {
        expect(platformCondition.predicate({ type: "is", comparisonType: "is", leftSideValue: "", rightSideValue: "kick" }, kickTrigger)).toBe(true);
    });

    it('resolves true when comparison is "is" and platform does not match', () => {
        expect(platformCondition.predicate({ type: "is", comparisonType: "is", leftSideValue: "", rightSideValue: "kick" }, twitchTrigger)).toBe(false);
    });

    it('resolves true when comparison is "is" and platform is "any" and currentPlatform is kick', async () => {
        expect(platformCondition.predicate({ type: "is", comparisonType: "is", leftSideValue: "", rightSideValue: "any" }, kickTrigger)).toBe(true);
    });

    it('resolves true when comparison is "is" and platform is "any" and currentPlatform is twitch', async () => {
        expect(platformCondition.predicate({ type: "is", comparisonType: "is", leftSideValue: "", rightSideValue: "any" }, twitchTrigger)).toBe(true);
    });

    it('resolves true when comparison is "is" and platform is "any" and currentPlatform is unknown', async () => {
        expect(platformCondition.predicate({ type: "is", comparisonType: "is", leftSideValue: "", rightSideValue: "any" }, baseTrigger)).toBe(false);
    });

    it('resolves true when comparison is "isNot" and platform is "unknown" and currentPlatform is not unknown', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "unknown" }, kickTrigger)).toBe(true);
    });

    it('resolves true when comparison is "isNot" and platform is "any" and currentPlatform is unknown', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "any" }, baseTrigger)).toBe(true);
    });

    it('resolves false when comparison is "isNot" and platform is "any" and currentPlatform is kick', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "any" }, kickTrigger)).toBe(false);
    });

    it('resolves false when comparison is "isNot" and platform is "any" and currentPlatform is twitch', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "any" }, twitchTrigger)).toBe(false);
    });

    it('resolves true when comparison is "isNot" and platform does not match', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "twitch" }, kickTrigger)).toBe(true);
    });

    it('resolves false when comparison is "isNot" and platform matches', async () => {
        expect(platformCondition.predicate({ type: "isNot", comparisonType: "isNot", leftSideValue: "", rightSideValue: "twitch" }, twitchTrigger)).toBe(false);
    });
});
