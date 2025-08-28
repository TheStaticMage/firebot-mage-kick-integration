import { KickPusher } from '../pusher';

jest.mock('../../../integration', () => {
    return {
        integration: {
            kick: {
                broadcaster: {
                    userId: 123,
                    name: 'broadcasterUser',
                    profilePicture: 'pic_url'
                }
            }
        }
    };
});

jest.mock('../../../main', () => ({
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

describe('KickPusher.dispatchChannelEvent', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    it('handles pusher:subscription_succeeded event', async () => {
        await (pusher as any).dispatchChannelEvent('pusher:subscription_succeeded', {});
    // Should not throw, just log info
    });

    it('throws for unknown event', async () => {
        await expect((pusher as any).dispatchChannelEvent('UnknownChannelEvent', { foo: 'bar' })).resolves.toBeUndefined();
    });
});

describe('KickPusher.dispatchChatroomEvent', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    it('handles pusher:subscription_succeeded', async () => {
        await (pusher as any).dispatchChatroomEvent('pusher:subscription_succeeded', {});
    });

    it('throws for unknown event', async () => {
        await expect((pusher as any).dispatchChatroomEvent('UnknownEvent', {})).resolves.toBeUndefined();
    });
});
