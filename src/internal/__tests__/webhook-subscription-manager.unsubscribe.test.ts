import { WebhookSubscriptionManager } from '../webhook-subscription-manager';

jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

describe('WebhookSubscriptionManager.unsubscribeFromEvents', () => {
    let manager: WebhookSubscriptionManager;
    let kick: any;

    beforeEach(() => {
        kick = {
            httpCallWithTimeout: jest.fn()
        };
        manager = new WebhookSubscriptionManager(kick);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('unsubscribes from all subscriptions', async () => {
        const subs = [
            { id: '1', event: 'foo', version: 1 },
            { id: '2', event: 'bar', version: 1 }
        ];
        jest.spyOn(manager as any, 'getSubscriptions').mockResolvedValue(subs);
        kick.httpCallWithTimeout.mockResolvedValue({});
        await expect(manager.unsubscribeFromEvents()).resolves.toBeUndefined();
        expect(kick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/events/subscriptions?id=1',
            'DELETE'
        );
        expect(kick.httpCallWithTimeout).toHaveBeenCalledWith(
            '/public/v1/events/subscriptions?id=2',
            'DELETE'
        );
    });

    it('logs error if unsubscribe fails', async () => {
        jest.spyOn(manager as any, 'getSubscriptions').mockRejectedValue(new Error('fail'));
        await manager.unsubscribeFromEvents();
    });
});
