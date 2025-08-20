import { parseChatMessageEvent } from "../webhook-handler";

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

describe('parseChatMessageEvent', () => {
    it('parses a chat message event with replies_to', () => {
        const json = '{"message_id":"b776e9d4-a30e-4154-8747-f8f02c2818a6","replies_to":{"message_id":"f08e9286-3390-4720-a292-266b7f80ab39","content":"Test 6","sender":{"is_anonymous":false,"user_id":72805522,"username":"thestaticmagetest","is_verified":false,"profile_picture":"","channel_slug":"thestaticmagetest","identity":null}},"broadcaster":{"is_anonymous":false,"user_id":2408714,"username":"TheStaticMage","is_verified":false,"profile_picture":"https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png","channel_slug":"thestaticmage","identity":null},"sender":{"is_anonymous":false,"user_id":2408714,"username":"TheStaticMage","is_verified":false,"profile_picture":"https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png","channel_slug":"thestaticmage","identity":{"username_color":"#DEB2FF","badges":[{"text":"Broadcaster","type":"broadcaster"}]}},"content":"Test 7","emotes":null,"created_at":"2025-08-20T07:05:42.561408909Z"}';
        const base64 = Buffer.from(json, 'utf-8').toString('base64');
        const result = parseChatMessageEvent(base64);
        expect(result).toEqual({
            messageId: "b776e9d4-a30e-4154-8747-f8f02c2818a6",
            repliesTo: {
                messageId: "f08e9286-3390-4720-a292-266b7f80ab39",
                content: "Test 6",
                sender: {
                    isAnonymous: false,
                    userId: "72805522",
                    username: "thestaticmagetest",
                    displayName: "thestaticmagetest",
                    isVerified: false,
                    profilePicture: "",
                    channelSlug: "thestaticmagetest"
                }
            },
            broadcaster: {
                isAnonymous: false,
                userId: "2408714",
                username: "TheStaticMage",
                displayName: "TheStaticMage",
                isVerified: false,
                profilePicture: "https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png",
                channelSlug: "thestaticmage"
            },
            sender: {
                isAnonymous: false,
                userId: "2408714",
                username: "TheStaticMage",
                displayName: "TheStaticMage",
                isVerified: false,
                profilePicture: "https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png",
                channelSlug: "thestaticmage",
                identity: {
                    usernameColor: "#DEB2FF",
                    badges: [
                        { text: "Broadcaster", type: "broadcaster", count: 0 }
                    ]
                }
            },
            content: "Test 7",
            createdAt: new Date("2025-08-20T07:05:42.561408909Z")
        });
    });

    it('parses a chat message event without replies_to', () => {
        const json = '{"message_id":"306a5724-94a2-4053-85d3-0d0c4af40806","replies_to":null,"broadcaster":{"is_anonymous":false,"user_id":2408714,"username":"TheStaticMage","is_verified":false,"profile_picture":"https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png","channel_slug":"thestaticmage","identity":null},"sender":{"is_anonymous":false,"user_id":2408714,"username":"TheStaticMage","is_verified":false,"profile_picture":"https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png","channel_slug":"thestaticmage","identity":{"username_color":"#DEB2FF","badges":[{"text":"Broadcaster","type":"broadcaster"}]}},"content":"Test 8","emotes":null,"created_at":"2025-08-20T07:07:44.479216297Z"}';
        const base64 = Buffer.from(json, 'utf-8').toString('base64');
        const result = parseChatMessageEvent(base64);
        expect(result).toEqual({
            messageId: "306a5724-94a2-4053-85d3-0d0c4af40806",
            repliesTo: undefined,
            broadcaster: {
                isAnonymous: false,
                userId: "2408714",
                username: "TheStaticMage",
                displayName: "TheStaticMage",
                isVerified: false,
                profilePicture: "https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png",
                channelSlug: "thestaticmage"
            },
            sender: {
                isAnonymous: false,
                userId: "2408714",
                username: "TheStaticMage",
                displayName: "TheStaticMage",
                isVerified: false,
                profilePicture: "https://dbxmjjzl5pc1g.cloudfront.net/68417caf-7cdd-43e3-8a65-c6d605e1b881/images/user-profile-pic.png",
                channelSlug: "thestaticmage",
                identity: {
                    usernameColor: "#DEB2FF",
                    badges: [
                        { text: "Broadcaster", type: "broadcaster", count: 0 }
                    ]
                }
            },
            content: "Test 8",
            createdAt: new Date("2025-08-20T07:07:44.479216297Z")
        });
    });
});
