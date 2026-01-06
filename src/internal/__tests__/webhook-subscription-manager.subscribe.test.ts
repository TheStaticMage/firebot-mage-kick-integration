/* eslint-disable camelcase */
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

describe('WebhookSubscriptionManager.initialize', () => {
    let manager: WebhookSubscriptionManager;
    let kick: any;

    beforeEach(() => {
        kick = {
            broadcaster: { userId: 42 },
            httpCallWithTimeout: jest.fn()
        };
        manager = new WebhookSubscriptionManager(kick);
    });

    afterEach(() => {
        manager.shutdown();
        jest.restoreAllMocks();
    });

    it('creates subscriptions if needed', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([]);
        kick.httpCallWithTimeout.mockResolvedValue({ data: [{ subscription_id: 'sub1' }], message: 'ok' });
        await expect(manager.initialize()).resolves.toBeUndefined();
        expect(kick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/events/subscriptions',
            'POST',
            expect.stringContaining('chat.message.sent')
        );
    });

    it('deletes subscriptions if needed', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([]);
        // Simulate a reconciliation with delete
        jest.spyOn(manager as any, 'reconcileSubscriptions').mockReturnValue({ create: [], delete: ['sub1', 'sub2'] });
        kick.httpCallWithTimeout.mockResolvedValue({});
        await expect(manager.initialize()).resolves.toBeUndefined();
        expect(kick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/events/subscriptions?id=sub1&id=sub2',
            'DELETE'
        );
    });

    it('does nothing if no create or delete needed', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([]);
        jest.spyOn(manager as any, 'reconcileSubscriptions').mockReturnValue({ create: [], delete: [] });
        await expect(manager.initialize()).resolves.toBeUndefined();
        expect(kick.httpCallWithTimeout).not.toHaveBeenCalled();
    });

    it('logs and rejects on error', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([]);
        jest.spyOn(manager as any, 'reconcileSubscriptions').mockReturnValue({ create: [{ name: 'foo', version: 1 }], delete: [] });
        kick.httpCallWithTimeout.mockRejectedValue(new Error('fail'));
        await expect(manager.initialize()).rejects.toThrow('fail');
    });
});

describe('WebhookSubscriptionManager.resetWebhookSubscriptions', () => {
    let manager: WebhookSubscriptionManager;
    let kick: any;

    beforeEach(() => {
        kick = {
            broadcaster: { userId: 42 },
            httpCallWithTimeout: jest.fn()
        };
        manager = new WebhookSubscriptionManager(kick);
    });

    afterEach(() => {
        manager.shutdown();
        jest.restoreAllMocks();
    });

    it('filters out undefined/null subscription IDs', async () => {
        // Mock subscriptions with some undefined/null IDs
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([
            { id: 'sub1', event: 'event1', version: 1 },
            { id: undefined, event: 'event2', version: 1 },
            { id: 'sub3', event: 'event3', version: 1 },
            { id: null, event: 'event4', version: 1 },
            { id: '', event: 'event5', version: 1 }, // empty string should also be filtered
            { id: 'sub6', event: 'event6', version: 1 }
        ]);

        // Mock successful delete response
        kick.httpCallWithTimeout.mockResolvedValue({});

        // Spy on subscribeToEvents to check what gets passed to it
        const subscribeToEventsSpy = jest.spyOn(manager as any, 'subscribeToEvents').mockResolvedValue(undefined);

        await manager.resetWebhookSubscriptions();

        // Check that only valid IDs are passed to delete
        expect(subscribeToEventsSpy).toHaveBeenCalledWith({
            create: [],
            delete: ['sub1', 'sub3', 'sub6'] // Only valid IDs
        });
    });

    it('handles empty subscriptions list', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue([]);
        const subscribeToEventsSpy = jest.spyOn(manager as any, 'subscribeToEvents').mockResolvedValue(undefined);

        await manager.resetWebhookSubscriptions();

        expect(subscribeToEventsSpy).toHaveBeenCalledWith({
            create: [],
            delete: []
        });
    });
});
