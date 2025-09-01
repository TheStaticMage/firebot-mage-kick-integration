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
            '/public/v1/events/subscriptions?id=sub1',
            'DELETE'
        );
        expect(kick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/events/subscriptions?id=sub2',
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
