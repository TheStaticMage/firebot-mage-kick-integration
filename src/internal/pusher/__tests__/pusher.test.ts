/* eslint-disable camelcase */
import { KickPusher } from '../pusher';
import { handleMessageDeletedEvent } from '../../../events/message-deleted';

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

jest.mock('../../../events/message-deleted', () => ({
    handleMessageDeletedEvent: jest.fn()
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

    it('handles chat message event when broadcaster is null', async () => {
        // Temporarily override the integration mock to have null broadcaster
        const originalModule = jest.requireActual('../../../integration');
        jest.doMock('../../../integration', () => ({
            integration: {
                kick: {
                    broadcaster: null
                }
            }
        }));

        // Clear module cache and re-import
        jest.resetModules();
        const { KickPusher } = require('../pusher');
        const { logger } = require('../../../main');

        const pusherWithNullBroadcaster = new KickPusher();

        // Test that chat message event is handled gracefully when broadcaster is null
        await (pusherWithNullBroadcaster).dispatchChatroomEvent('App\\Events\\ChatMessageEvent', {
            id: 'b776e9d4-a30e-4154-8747-f8f02c2818a6',
            chatroom_id: 2346570,
            content: 'test message',
            type: 'message',
            created_at: '2025-08-20T07:05:42+00:00',
            sender: {
                id: 2408714,
                username: 'testuser',
                slug: 'testuser',
                identity: { color: '#DEB2FF', badges: [] }
            }
        });

        // Verify that a warning was logged
        expect(logger.warn).toHaveBeenCalledWith("Skipping chat message event: broadcaster information not available");

        // Restore original mock
        jest.doMock('../../../integration', () => originalModule);
        jest.resetModules();
    });

    it('parses and forwards message deleted events (string payload)', async () => {
        const payload = {
            event: 'App\\Events\\MessageDeletedEvent',
            data: '{"id":"94bbd762-ae08-40cd-aec8-27956f9bbc11","message":{"id":"8a5db04a-149c-489b-afec-7a2d8ff4084d"},"aiModerated":false,"violatedRules":[]}',
            channel: 'chatrooms.2346570.v2'
        };

        await (pusher as any).dispatchChatroomEvent(payload.event, payload.data);

        expect(handleMessageDeletedEvent).toHaveBeenCalledWith({
            id: '94bbd762-ae08-40cd-aec8-27956f9bbc11',
            message: { id: '8a5db04a-149c-489b-afec-7a2d8ff4084d' },
            aiModerated: false,
            violatedRules: []
        });
    });
});
