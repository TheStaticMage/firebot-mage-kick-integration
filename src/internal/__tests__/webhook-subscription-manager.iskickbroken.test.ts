jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

jest.mock('../../integration', () => ({
    integration: {
        sendCriticalErrorNotification: jest.fn()
    }
}));

import { WebhookSubscriptionManager } from '../webhook-subscription-manager';

describe('WebhookSubscriptionManager.isKickBroken', () => {
    let manager: WebhookSubscriptionManager;
    let isKickBroken: (subscriptions: any[], referenceSubscriptions: any[]) => boolean;

    beforeEach(() => {
        const kick = {} as any;
        manager = new WebhookSubscriptionManager(kick);
        isKickBroken = (subscriptions: any[], referenceSubscriptions: any[]) =>
            (manager as any).isKickBroken(subscriptions, referenceSubscriptions);
    });

    const referenceSubscriptions = [
        { name: "chat.message.sent", version: 1 },
        { name: "channel.followed", version: 1 },
        { name: "livestream.status.updated", version: 1 }
    ];

    describe('valid subscriptions', () => {
        it('returns false when all subscriptions are valid and unique', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'channel.followed', version: 1 },
                { id: '3', event: 'livestream.status.updated', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(false);
        });

        it('returns false when subscriptions are empty', () => {
            const result = isKickBroken([], referenceSubscriptions);
            expect(result).toBe(false);
        });

        it('returns false when subscriptions are a subset of valid subscriptions', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(false);
        });

        it('returns false with empty reference subscriptions and empty subscriptions', () => {
            const result = isKickBroken([], []);
            expect(result).toBe(false);
        });
    });

    describe('duplicate subscriptions', () => {
        it('returns true when duplicate subscriptions exist', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'chat.message.sent', version: 1 }, // duplicate
                { id: '3', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('returns true when multiple duplicates exist', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'chat.message.sent', version: 1 }, // duplicate
                { id: '3', event: 'channel.followed', version: 1 },
                { id: '4', event: 'channel.followed', version: 1 } // duplicate
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('returns true when three or more duplicates exist', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'chat.message.sent', version: 1 }, // duplicate
                { id: '3', event: 'chat.message.sent', version: 1 } // duplicate
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('considers different versions as different events (no duplicates)', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'chat.message.sent', version: 2 }
            ];

            const referenceWithMultipleVersions = [
                { name: "chat.message.sent", version: 1 },
                { name: "chat.message.sent", version: 2 }
            ];

            const result = isKickBroken(subscriptions, referenceWithMultipleVersions);
            expect(result).toBe(false);
        });
    });

    describe('unknown subscriptions', () => {
        it('returns true when unknown event exists', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'unknown.event', version: 1 }, // unknown event
                { id: '3', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('returns true when known event has unknown version', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'channel.followed', version: 2 }, // unknown version
                { id: '3', event: 'livestream.status.updated', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('returns true when multiple unknown subscriptions exist', () => {
            const subscriptions = [
                { id: '1', event: 'unknown.event.one', version: 1 }, // unknown
                { id: '2', event: 'unknown.event.two', version: 1 }, // unknown
                { id: '3', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });
    });
    describe('complex validation scenarios', () => {
        it('returns true when both duplicates and unknown subscriptions exist', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 1 },
                { id: '2', event: 'chat.message.sent', version: 1 }, // duplicate
                { id: '3', event: 'unknown.event', version: 1 }, // unknown
                { id: '4', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('handles edge case with empty event name', () => {
            const subscriptions = [
                { id: '1', event: '', version: 1 }, // empty event name
                { id: '2', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('handles edge case with zero version', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: 0 }, // version 0
                { id: '2', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });

        it('handles edge case with negative version', () => {
            const subscriptions = [
                { id: '1', event: 'chat.message.sent', version: -1 }, // negative version
                { id: '2', event: 'channel.followed', version: 1 }
            ];

            const result = isKickBroken(subscriptions, referenceSubscriptions);
            expect(result).toBe(true);
        });
    });
});
