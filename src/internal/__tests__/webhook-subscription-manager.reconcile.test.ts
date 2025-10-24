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

describe('WebhookSubscriptionManager.reconcileSubscriptions', () => {
    let manager: WebhookSubscriptionManager;
    let reconcile: (current: any[]) => any;

    beforeEach(() => {
        const kick = {} as any;
        manager = new WebhookSubscriptionManager(kick);
        reconcile = (current: any[]) => (manager as any).reconcileSubscriptions(current);
    });

    it('creates all when none exist', () => {
        const result = reconcile([]);
        expect(result.create.length).toBe(9);
        expect(result.delete).toEqual([]);
    });

    it('preserves one of each, deletes extras', () => {
        const current = [
            { id: '1', event: 'chat.message.sent', version: 1 },
            { id: '2', event: 'chat.message.sent', version: 1 }, // duplicate
            { id: '3', event: 'channel.followed', version: 1 },
            { id: '4', event: 'channel.subscription.gifts', version: 1 },
            { id: '5', event: 'not-needed', version: 1 }
        ];
        const result = reconcile(current);
        expect(result.create.length).toBe(6); // 9 total - 3 present
        expect(result.delete).toContain('2'); // duplicate
        expect(result.delete).toContain('5'); // not-needed
        expect(result.create.some((e: any) => e.name === 'livestream.metadata.updated')).toBe(true);
    });

    it('deletes all if none are needed', () => {
        const current = [
            { id: '1', event: 'foo', version: 1 },
            { id: '2', event: 'bar', version: 1 }
        ];
        const result = reconcile(current);
        expect(result.create.length).toBe(9);
        expect(result.delete).toEqual(['1', '2']);
    });

    it('preserves correct subscriptions, creates and deletes as needed', () => {
        const current = [
            { id: '1', event: 'chat.message.sent', version: 1 },
            { id: '2', event: 'channel.followed', version: 1 },
            { id: '3', event: 'channel.subscription.gifts', version: 1 },
            { id: '4', event: 'extra', version: 1 }
        ];
        const result = reconcile(current);
        expect(result.create.length).toBe(6); // 9 total - 3 present
        expect(result.delete).toContain('4'); // extra
        expect(result.create.some((e: any) => e.name === 'livestream.status.updated')).toBe(true);
    });

    it('handles empty id fields gracefully', () => {
        const current = [
            { id: undefined, event: 'chat.message.sent', version: 1 },
            { id: null, event: 'channel.followed', version: 1 }
        ];
        const result = reconcile(current);
        expect(result.create.length).toBe(7); // 9 total - 2 present
        expect(result.delete).toEqual([]); // no duplicates or extras with id
    });

    it('returns no create or delete when all subscriptions are present and unique', () => {
        const current = [
            { id: '1', event: 'chat.message.sent', version: 1 },
            { id: '2', event: 'channel.followed', version: 1 },
            { id: '3', event: 'livestream.metadata.updated', version: 1 },
            { id: '4', event: 'livestream.status.updated', version: 1 },
            { id: '5', event: 'channel.subscription.renewal', version: 1 },
            { id: '6', event: 'channel.subscription.gifts', version: 1 },
            { id: '7', event: 'channel.subscription.new', version: 1 },
            { id: '8', event: 'moderation.banned', version: 1 },
            { id: '9', event: 'kicks.gifted', version: 1 }
        ];
        const result = reconcile(current);
        expect(result.create).toEqual([]);
        expect(result.delete).toEqual([]);
    });

    it('returns all subscriptions to create and all current to delete when kick is broken', () => {
        // Set kickIsBroken to true
        (manager as any).kickIsBroken = true;

        const current = [
            { id: '1', event: 'chat.message.sent', version: 1 },
            { id: '2', event: 'channel.followed', version: 1 },
            { id: '3', event: 'some.other.event', version: 1 }
        ];

        const result = reconcile(current);

        // Should create all 9 subscriptions
        expect(result.create.length).toBe(9);
        expect(result.create).toEqual([
            { name: 'chat.message.sent', version: 1 },
            { name: 'channel.followed', version: 1 },
            { name: 'livestream.metadata.updated', version: 1 },
            { name: 'livestream.status.updated', version: 1 },
            { name: 'channel.subscription.renewal', version: 1 },
            { name: 'channel.subscription.gifts', version: 1 },
            { name: 'channel.subscription.new', version: 1 },
            { name: 'moderation.banned', version: 1 },
            { name: 'kicks.gifted', version: 1 }
        ]);

        // Should delete all current subscriptions
        expect(result.delete).toEqual(['1', '2', '3']);
    });
});
