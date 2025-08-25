import { KickPusher } from '../pusher';
import { handleChatMessageSentEvent } from '../../../events/chat-message-sent';
import { handleRewardRedeemedEvent } from '../../../events/reward-redeemed-event';

jest.mock('../../../events/chat-message-sent', () => ({
    handleChatMessageSentEvent: jest.fn()
}));

jest.mock('../../../events/reward-redeemed-event', () => ({
    handleRewardRedeemedEvent: jest.fn()
}));

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

    it('calls handleChatMessageSentEvent for App\\Events\\ChatMessageEvent', async () => {
        const spy = jest.spyOn<any, any>(pusher, 'parseChatMessageEvent').mockReturnValue('parsed');
        await (pusher as any).dispatchChatroomEvent('App\\Events\\ChatMessageEvent', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith({ foo: 'bar' });
        expect(handleChatMessageSentEvent).toHaveBeenCalledWith('parsed', 2);
    });

    it('calls handleRewardRedeemedEvent for RewardRedeemedEvent', async () => {
        const spy = jest.spyOn<any, any>(pusher, 'parseRewardRedeemedEvent').mockReturnValue('parsedReward');
        await (pusher as any).dispatchChatroomEvent('RewardRedeemedEvent', { foo: 'bar' });
        expect(spy).toHaveBeenCalledWith({ foo: 'bar' });
        expect(handleRewardRedeemedEvent).toHaveBeenCalledWith('parsedReward');
    });

    it('handles pusher:subscription_succeeded', async () => {
        await (pusher as any).dispatchChatroomEvent('pusher:subscription_succeeded', {});
    });

    it('throws for unknown event', async () => {
        await expect((pusher as any).dispatchChatroomEvent('UnknownEvent', {})).resolves.toBeUndefined();
    });
});

describe('KickPusher.parseChatMessageEvent', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    it('parses a message that is a reply', () => {
        const jsonInput = `{"id":"b776e9d4-a30e-4154-8747-f8f02c2818a6","chatroom_id":2346570,"content":"Test 7","type":"reply","created_at":"2025-08-20T07:05:42+00:00","sender":{"id":2408714,"username":"TheStaticMage","slug":"thestaticmage","identity":{"color":"#DEB2FF","badges":[{"type":"broadcaster","text":"Broadcaster"}]}},"metadata":{"original_sender":{"id":72805522,"username":"thestaticmagetest"},"original_message":{"id":"f08e9286-3390-4720-a292-266b7f80ab39","content":"Test 6"},"message_ref":"1755673542051"}}`;

        const result = (pusher as any).parseChatMessageEvent(JSON.parse(jsonInput));

        expect(result).toEqual({
            messageId: 'b776e9d4-a30e-4154-8747-f8f02c2818a6',
            broadcaster: {
                userId: '123',
                username: 'broadcasterUser',
                displayName: 'broadcasterUser',
                profilePicture: 'pic_url',
                isVerified: false,
                channelSlug: 'broadcasterUser'
            },
            sender: {
                userId: '2408714',
                username: 'TheStaticMage',
                displayName: 'TheStaticMage',
                profilePicture: '',
                isVerified: false,
                channelSlug: 'thestaticmage',
                identity: {
                    usernameColor: '#DEB2FF',
                    badges: [
                        { text: 'Broadcaster', type: 'broadcaster', count: undefined }
                    ]
                }
            },
            content: 'Test 7',
            createdAt: new Date('2025-08-20T07:05:42+00:00'),
            repliesTo: {
                messageId: 'f08e9286-3390-4720-a292-266b7f80ab39',
                content: 'Test 6',
                sender: {
                    userId: '72805522',
                    username: 'thestaticmagetest',
                    displayName: 'thestaticmagetest',
                    profilePicture: '',
                    isVerified: false,
                    channelSlug: ''
                }
            }
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.createdAt.toISOString()).toBe('2025-08-20T07:05:42.000Z');
    });

    it('parses a message that is not a reply', () => {
        const jsonInput = `{"id":"306a5724-94a2-4053-85d3-0d0c4af40806","chatroom_id":2346570,"content":"Test 8","type":"message","created_at":"2025-08-20T07:07:44+00:00","sender":{"id":2408714,"username":"TheStaticMage","slug":"thestaticmage","identity":{"color":"#DEB2FF","badges":[{"type":"broadcaster","text":"Broadcaster"}]}},"metadata":{"message_ref":"1755673663786"}}`;

        const result = (pusher as any).parseChatMessageEvent(JSON.parse(jsonInput));

        expect(result).toEqual({
            messageId: '306a5724-94a2-4053-85d3-0d0c4af40806',
            broadcaster: {
                userId: '123',
                username: 'broadcasterUser',
                displayName: 'broadcasterUser',
                profilePicture: 'pic_url',
                isVerified: false,
                channelSlug: 'broadcasterUser'
            },
            sender: {
                userId: '2408714',
                username: 'TheStaticMage',
                displayName: 'TheStaticMage',
                profilePicture: '',
                isVerified: false,
                channelSlug: 'thestaticmage',
                identity: {
                    usernameColor: '#DEB2FF',
                    badges: [
                        { text: 'Broadcaster', type: 'broadcaster', count: undefined }
                    ]
                }
            },
            content: 'Test 8',
            createdAt: new Date('2025-08-20T07:07:44+00:00'),
            repliesTo: undefined
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.createdAt.toISOString()).toBe('2025-08-20T07:07:44.000Z');
    });

    it('parses a message with no metadata', () => {
        const jsonInput = `{"id":"59778b1e-9c4d-42e3-a1c7-8cf6de3eee79","chatroom_id":2346570,"content":"Message sent as bot","type":"message","created_at":"2025-08-21T07:20:31+00:00","sender":{"id":72805522,"username":"thestaticmagetest","slug":"thestaticmagetest","identity":{"color":"#31D6C2","badges":[]}}}`;

        const result = (pusher as any).parseChatMessageEvent(JSON.parse(jsonInput));

        expect(result).toEqual({
            messageId: '59778b1e-9c4d-42e3-a1c7-8cf6de3eee79',
            broadcaster: {
                userId: '123',
                username: 'broadcasterUser',
                displayName: 'broadcasterUser',
                profilePicture: 'pic_url',
                isVerified: false,
                channelSlug: 'broadcasterUser'
            },
            sender: {
                userId: '72805522',
                username: 'thestaticmagetest',
                displayName: 'thestaticmagetest',
                profilePicture: '',
                isVerified: false,
                channelSlug: 'thestaticmagetest',
                identity: {
                    usernameColor: '#31D6C2',
                    badges: []
                }
            },
            content: 'Message sent as bot',
            createdAt: new Date('2025-08-21T07:20:31.000Z'),
            repliesTo: undefined
        });
        expect(result.createdAt).toBeInstanceOf(Date);
        expect(result.createdAt.toISOString()).toBe('2025-08-21T07:20:31.000Z');
    });
});

describe('KickPusher.parseRewardRedeemedEvent', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    it('parses a reward redeemed event', () => {
        const jsonInput = `{"reward_title":"Test Reward","user_id":2408714,"channel_id":2346570,"username":"TheStaticMage","user_input":"Some input","reward_background_color":"#DEB2FF"}`;
        const result = (pusher as any).parseRewardRedeemedEvent(JSON.parse(jsonInput));
        expect(result).toEqual({
            rewardTitle: 'Test Reward',
            userId: 2408714,
            channelId: 2346570,
            username: 'TheStaticMage',
            userInput: 'Some input',
            rewardBackgroundColor: '#DEB2FF'
        });
    });
});

describe('KickPusher.parseStreamHostedEvent', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    it('parses a StreamHostedEvent payload', () => {
        const jsonInput = `{"message":{"id":"d251ef14-5f5c-4593-8f7d-f5cc0aa52571","numberOfViewers":32,"optionalMessage":"","createdAt":"2025-08-20T20:26:31.231698Z"},"user":{"id":1234567,"username":"Kicker","isSuperAdmin":false,"verified":{"id":12345,"channel_id":7654321,"created_at":"2025-05-12T14:00:00.000000Z","updated_at":"2025-05-12T14:00:00.000000Z"}}}`;
        const result = (pusher as any).parseStreamHostedEvent(JSON.parse(jsonInput));
        expect(result).toEqual({
            user: {
                userId: "1234567",
                username: "Kicker",
                displayName: "Kicker",
                profilePicture: "",
                isVerified: true,
                channelSlug: ""
            },
            numberOfViewers: 32,
            optionalMessage: "",
            createdAt: new Date("2025-08-20T20:26:31.231698Z")
        });
    });
});
