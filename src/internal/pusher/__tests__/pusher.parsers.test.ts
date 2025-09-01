import { KickUser } from "../../../shared/types";
import { parseChatMessageEvent, parseChatMoveToSupportedChannelEvent, parseRewardRedeemedEvent, parseStreamHostedEvent, parseViewerBannedOrTimedOutEvent, parseViewerUnbannedEvent } from "../pusher-parsers";

describe('parseViewerUnbannedEvent', () => {
    it('parses a permanent unban event correctly', () => {
        const jsonInput = `{"user":{"id":111,"username":"unbanneduser"},"unbanned_by":{"id":222,"username":"moduser"},"permanent":true}`;
        const input = JSON.parse(jsonInput);
        const result = parseViewerUnbannedEvent(input);
        expect(result).toEqual({
            user: {
                userId: "k111",
                username: "unbanneduser@kick",
                displayName: "unbanneduser",
                profilePicture: '',
                isVerified: false,
                channelSlug: ''
            },
            moderator: {
                userId: "k222",
                username: "moduser@kick",
                displayName: "moduser",
                profilePicture: '',
                isVerified: false,
                channelSlug: ''
            },
            banType: "permanent"
        });
    });

    it('parses a timeout unban event correctly', () => {
        const jsonInput = `{"user":{"id":333,"username":"timeoutuser"},"unbanned_by":{"id":444,"username":"mod2"},"permanent":false}`;
        const input = JSON.parse(jsonInput);
        const result = parseViewerUnbannedEvent(input);
        expect(result).toEqual({
            user: {
                userId: "k333",
                username: "timeoutuser@kick",
                displayName: "timeoutuser",
                profilePicture: '',
                isVerified: false,
                channelSlug: ''
            },
            moderator: {
                userId: "k444",
                username: "mod2@kick",
                displayName: "mod2",
                profilePicture: '',
                isVerified: false,
                channelSlug: ''
            },
            banType: "timeout"
        });
    });
});

describe('KickPusher.parseChatMessageEvent', () => {
    const broadcaster: KickUser = {
        userId: '123',
        username: 'broadcasterUser',
        displayName: 'broadcasterUser',
        profilePicture: 'pic_url',
        isVerified: false,
        channelSlug: 'broadcasterUser'
    };

    it('parses a message that is a reply', () => {
        const jsonInput = `{"id":"b776e9d4-a30e-4154-8747-f8f02c2818a6","chatroom_id":2346570,"content":"Test 7","type":"reply","created_at":"2025-08-20T07:05:42+00:00","sender":{"id":2408714,"username":"TheStaticMage","slug":"thestaticmage","identity":{"color":"#DEB2FF","badges":[{"type":"broadcaster","text":"Broadcaster"}]}},"metadata":{"original_sender":{"id":72805522,"username":"thestaticmagetest"},"original_message":{"id":"f08e9286-3390-4720-a292-266b7f80ab39","content":"Test 6"},"message_ref":"1755673542051"}}`;

        const result = parseChatMessageEvent(JSON.parse(jsonInput), broadcaster);

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
        expect(result.createdAt).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        if (result.createdAt) {
            expect(result.createdAt.toISOString()).toBe('2025-08-20T07:05:42.000Z');
        }
    });

    it('parses a message that is not a reply', () => {
        const jsonInput = `{"id":"306a5724-94a2-4053-85d3-0d0c4af40806","chatroom_id":2346570,"content":"Test 8","type":"message","created_at":"2025-08-20T07:07:44+00:00","sender":{"id":2408714,"username":"TheStaticMage","slug":"thestaticmage","identity":{"color":"#DEB2FF","badges":[{"type":"broadcaster","text":"Broadcaster"}]}},"metadata":{"message_ref":"1755673663786"}}`;

        const result = parseChatMessageEvent(JSON.parse(jsonInput), broadcaster);

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
        expect(result.createdAt).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        if (result.createdAt) {
            expect(result.createdAt.toISOString()).toBe('2025-08-20T07:07:44.000Z');
        }
    });

    it('parses a message with no metadata', () => {
        const jsonInput = `{"id":"59778b1e-9c4d-42e3-a1c7-8cf6de3eee79","chatroom_id":2346570,"content":"Message sent as bot","type":"message","created_at":"2025-08-21T07:20:31+00:00","sender":{"id":72805522,"username":"thestaticmagetest","slug":"thestaticmagetest","identity":{"color":"#31D6C2","badges":[]}}}`;

        const result = parseChatMessageEvent(JSON.parse(jsonInput), broadcaster);

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
        expect(result.createdAt).toBeDefined();
        expect(result.createdAt).toBeInstanceOf(Date);
        if (result.createdAt) {
            expect(result.createdAt.toISOString()).toBe('2025-08-21T07:20:31.000Z');
        }
    });
});

describe('KickPusher.parseRewardRedeemedEvent', () => {
    it('parses a reward redeemed event', () => {
        const jsonInput = `{"reward_title":"Test Reward","user_id":2408714,"channel_id":2346570,"username":"TheStaticMage","user_input":"Some input","reward_background_color":"#DEB2FF"}`;
        const result = parseRewardRedeemedEvent(JSON.parse(jsonInput));
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
    it('parses a StreamHostedEvent payload', () => {
        const jsonInput = `{"message":{"id":"d251ef14-5f5c-4593-8f7d-f5cc0aa52571","numberOfViewers":32,"optionalMessage":"","createdAt":"2025-08-20T20:26:31.231698Z"},"user":{"id":1234567,"username":"Kicker","isSuperAdmin":false,"verified":{"id":12345,"channel_id":7654321,"created_at":"2025-05-12T14:00:00.000000Z","updated_at":"2025-05-12T14:00:00.000000Z"}}}`;
        const result = parseStreamHostedEvent(JSON.parse(jsonInput));
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

describe('parseChatMoveToSupportedChannelEvent', () => {
    it('parses a valid move-to-supported-channel event', () => {
        const jsonInput = `{"channel":{"id":12345678,"user_id":23456789,"slug":"slug","is_banned":false,"playback_url":"https://playback_url","name_updated_at":null,"vod_enabled":true,"subscription_enabled":true,"is_affiliate":true,"can_host":false,"current_livestream":{"id":3456789,"slug":"stream-slug","channel_id":12345678,"created_at":"2025-08-21 17:06:41","session_title":"Title of my stream","is_live":true,"risk_level_id":null,"start_time":"2025-08-21 17:06:40","source":null,"twitch_channel":null,"duration":0,"language":"English","is_mature":false,"viewer_count":14}},"slug":"target-slug","hosted":{"id":87654321,"username":"Target_User","slug":"target-slug","viewers_count":19,"is_live":true,"profile_pic":"https://profile_pic","category":"Games","preview_thumbnail":{"srcset":"https://thumbnail_srcset","src":"https://thumbnail_src"}}}`;
        const result = parseChatMoveToSupportedChannelEvent(JSON.parse(jsonInput));
        expect(result).toEqual({
            targetUser: {
                userId: 'k87654321',
                username: 'Target_User@kick',
                displayName: 'Target_User',
                profilePicture: 'https://profile_pic',
                isVerified: false,
                channelSlug: 'target-slug'
            },
            targetSlug: 'target-slug',
            numberOfViewers: 19
        });
    });
});

describe('parseViewerBannedOrTimedOutEvent', () => {
    // The banned_by user ID is always reported as 0 when the banning is done
    // via the web UI by the broadcaster, and possibly under other
    // circumstances. :shrug:
    it('parses a timeout event correctly', () => {
        const jsonInput = `{"id":"0207bd89-e15c-4bf9-ba1e-129f937639a7","user":{"id":23498234,"username":"timeoutuser","slug":"timeoutuser"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":false,"duration":5,"expires_at":"2025-09-01T18:16:58+00:00"}`;
        const input = JSON.parse(jsonInput);
        const result = parseViewerBannedOrTimedOutEvent(input);

        expect(result).toEqual({
            bannedUser: {
                userId: "k23498234",
                username: "timeoutuser@kick",
                displayName: "timeoutuser",
                profilePicture: '',
                isVerified: false,
                channelSlug: 'timeoutuser'
            },
            moderator: {
                userId: "k0",
                username: "TheStaticMage@kick",
                displayName: "TheStaticMage",
                profilePicture: '',
                isVerified: false,
                channelSlug: 'thestaticmage'
            },
            metadata: {
                reason: 'No reason provided',
                createdAt: expect.any(Date),
                expiresAt: new Date("2025-09-01T18:16:58+00:00")
            }
        });
    });

    it('parses a permanent ban event correctly', () => {
        const jsonInput = `{"id":"517e2dcb-7637-4482-af68-1bfba32ba2a7","user":{"id":23498234,"username":"timeoutuser","slug":"timeoutuser"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":true}`;
        const input = JSON.parse(jsonInput);
        const result = parseViewerBannedOrTimedOutEvent(input);

        expect(result).toEqual({
            bannedUser: {
                userId: "k23498234",
                username: "timeoutuser@kick",
                displayName: "timeoutuser",
                profilePicture: '',
                isVerified: false,
                channelSlug: 'timeoutuser'
            },
            moderator: {
                userId: "k0",
                username: "TheStaticMage@kick",
                displayName: "TheStaticMage",
                profilePicture: '',
                isVerified: false,
                channelSlug: 'thestaticmage'
            },
            metadata: {
                reason: 'No reason provided',
                createdAt: expect.any(Date),
                expiresAt: undefined
            }
        });
    });
});
