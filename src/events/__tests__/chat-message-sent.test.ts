import { FirebotChatHelpers, handleChatMessageSentEvent } from "../chat-message-sent";
import { KickIdentity, ChatMessage } from "../../shared/types";
import { IntegrationConstants } from "../../constants";

// Mock logger before importing modules that use it
jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    },
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: jest.fn()
            },
            frontendCommunicator: {
                send: jest.fn()
            }
        }
    }
}));

// Mock integration
jest.mock("../../integration", () => ({
    integration: {
        kick: {
            userManager: {
                getOrCreateViewer: jest.fn().mockResolvedValue(undefined),
                setViewerRoles: jest.fn(),
                incrementChatMessages: jest.fn(),
                updateLastSeen: jest.fn()
            },
            chatManager: {
                registerMessage: jest.fn().mockResolvedValue(false),
                checkViewerArrived: jest.fn().mockReturnValue(false)
            }
        },
        isChatFeedEnabled: jest.fn().mockReturnValue(false),
        getSettings: jest.fn().mockReturnValue({
            triggerTwitchEvents: {
                chatMessage: false
            }
        })
    }
}));

// Mock command handler
jest.mock("../../internal/command", () => ({
    commandHandler: {
        handleChatMessage: jest.fn()
    }
}));

describe('FirebotChatHelpers', () => {
    let helpers: FirebotChatHelpers;

    beforeEach(() => {
        helpers = new FirebotChatHelpers();
    });

    describe('getTwitchRoles', () => {
        it('returns broadcaster role for broadcaster badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster"]);
        });

        it('returns mod role for moderator badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Moderator", type: "moderator" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["mod"]);
        });

        it('returns vip role for vip badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["vip"]);
        });

        it('returns sub and tier1 roles for subscriber badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Subscriber", type: "subscriber" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["sub", "tier1"]);
        });

        it('returns empty array for og badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "OG", type: "og" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns empty array for founder badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Founder", type: "founder" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns empty array for sub_gifter badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Sub Gifter", type: "sub_gifter" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns multiple roles for multiple badges', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" },
                    { text: "Subscriber", type: "subscriber" },
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster", "sub", "tier1", "vip"]);
        });

        it('deduplicates roles when multiple badges map to same role', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Subscriber", type: "subscriber" },
                    { text: "Subscriber", type: "subscriber" } // Duplicate subscriber badge
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["sub", "tier1"]);
        });

        it('returns empty array for unknown badge types', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Unknown", type: "unknown_badge_type" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('handles mixed known and unknown badge types', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" },
                    { text: "Unknown", type: "unknown_badge_type" },
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster", "vip"]);
        });

        it('returns empty array for empty badges array', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: []
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('throws error when identity is null', () => {
            expect(() => {
                helpers.getTwitchRoles(null as any);
            }).toThrow();
        });

        it('throws error when identity is undefined', () => {
            expect(() => {
                helpers.getTwitchRoles(undefined as any);
            }).toThrow();
        });

        it('throws error when identity.badges is null', () => {
            const identity = {
                usernameColor: "#000000",
                badges: null as any
            };

            expect(() => {
                helpers.getTwitchRoles(identity);
            }).toThrow();
        });

        it('throws error when identity.badges is undefined', () => {
            const identity = {
                usernameColor: "#000000",
                badges: undefined as any
            };

            expect(() => {
                helpers.getTwitchRoles(identity);
            }).toThrow();
        });
    });

    describe('buildFirebotChatMessage', () => {
        it('uses profile picture URL from message sender', async () => {
            const msg: ChatMessage = {
                messageId: "msg-123",
                content: "Hello world",
                createdAt: new Date(),
                broadcaster: {
                    userId: "123",
                    username: "broadcaster",
                    displayName: "Broadcaster",
                    isVerified: false,
                    profilePicture: "https://example.com/broadcaster.jpg",
                    channelSlug: "broadcaster"
                },
                sender: {
                    userId: "456",
                    username: "testuser",
                    displayName: "Test User",
                    isVerified: false,
                    profilePicture: "https://example.com/avatar.jpg",
                    channelSlug: "testuser",
                    identity: {
                        usernameColor: "#000000",
                        badges: []
                    }
                },
                repliesTo: undefined
            };

            const result = await helpers.buildFirebotChatMessage(msg, "Hello world");
            expect(result.profilePicUrl).toBe("https://example.com/avatar.jpg");
        });

        it('uses empty string when profile picture is missing', async () => {
            const msg: ChatMessage = {
                messageId: "msg-123",
                content: "Hello world",
                createdAt: new Date(),
                broadcaster: {
                    userId: "123",
                    username: "broadcaster",
                    displayName: "Broadcaster",
                    isVerified: false,
                    profilePicture: "https://example.com/broadcaster.jpg",
                    channelSlug: "broadcaster"
                },
                sender: {
                    userId: "456",
                    username: "testuser",
                    displayName: "Test User",
                    isVerified: false,
                    profilePicture: "",
                    channelSlug: "testuser",
                    identity: {
                        usernameColor: "#000000",
                        badges: []
                    }
                },
                repliesTo: undefined
            };

            const result = await helpers.buildFirebotChatMessage(msg, "Hello world");
            expect(result.profilePicUrl).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE);
        });

        it('uses default profile image when profile picture is undefined', async () => {
            const msg: ChatMessage = {
                messageId: "msg-123",
                content: "Hello world",
                createdAt: new Date(),
                broadcaster: {
                    userId: "123",
                    username: "broadcaster",
                    displayName: "Broadcaster",
                    isVerified: false,
                    profilePicture: "https://example.com/broadcaster.jpg",
                    channelSlug: "broadcaster"
                },
                sender: {
                    userId: "456",
                    username: "testuser",
                    displayName: "Test User",
                    isVerified: false,
                    profilePicture: undefined as any,
                    channelSlug: "testuser",
                    identity: {
                        usernameColor: "#000000",
                        badges: []
                    }
                },
                repliesTo: undefined
            };

            const result = await helpers.buildFirebotChatMessage(msg, "Hello world");
            expect(result.profilePicUrl).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE);
        });
    });
});

describe('handleChatMessageSentEvent - webhook delay mechanism', () => {
    beforeAll(() => {
        jest.useFakeTimers();
    });

    afterAll(() => {
        jest.useRealTimers();
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.clearAllMocks();
    });

    const createPusherMessage = (messageId: string): ChatMessage => ({
        messageId,
        content: "Test message",
        createdAt: new Date(),
        broadcaster: {
            userId: "123",
            username: "broadcaster",
            displayName: "Broadcaster",
            isVerified: false,
            profilePicture: IntegrationConstants.DEFAULT_PROFILE_IMAGE,
            channelSlug: "broadcaster"
        },
        sender: {
            userId: "456",
            username: "testuser",
            displayName: "Test User",
            isVerified: false,
            profilePicture: IntegrationConstants.DEFAULT_PROFILE_IMAGE, // Pusher doesn't include profile picture
            channelSlug: "testuser",
            identity: {
                usernameColor: "#000000",
                badges: []
            }
        },
        repliesTo: undefined
    });

    const createWebhookMessage = (messageId: string): ChatMessage => ({
        messageId,
        content: "Test message",
        createdAt: new Date(),
        broadcaster: {
            userId: "123",
            username: "broadcaster",
            displayName: "Broadcaster",
            isVerified: false,
            profilePicture: "https://example.com/broadcaster.jpg",
            channelSlug: "broadcaster"
        },
        sender: {
            userId: "456",
            username: "testuser",
            displayName: "Test User",
            isVerified: false,
            profilePicture: "https://example.com/avatar.jpg", // Webhook includes profile picture
            channelSlug: "testuser",
            identity: {
                usernameColor: "#000000",
                badges: []
            }
        },
        repliesTo: undefined
    });

    it('schedules Pusher messages for 5 second delay', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const msg = createPusherMessage("pusher-msg-delay-test");

        await handleChatMessageSentEvent(msg, false);

        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
        expect(msg.sender.profilePicture).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE); // Verify Pusher message has no profile pic
        setTimeoutSpy.mockRestore();
    });

    it('does not schedule delay for webhook messages', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const msg = createWebhookMessage("webhook-msg-nodelay-test");

        // This will fail due to missing mocks, but we can catch the error
        try {
            await handleChatMessageSentEvent(msg, true);
        } catch {
            // Expected - integration not mocked
        }

        // Verify setTimeout was NOT called before the error
        expect(setTimeoutSpy).not.toHaveBeenCalled();
        expect(msg.sender.profilePicture).toBe("https://example.com/avatar.jpg"); // Verify webhook has profile pic
        setTimeoutSpy.mockRestore();
    });

    it('cancels pending Pusher message when webhook arrives', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
        const pusherMsg = createPusherMessage("msg-cancel-test");
        const webhookMsg = createWebhookMessage("msg-cancel-test");

        // Pusher message arrives - schedules delay
        await handleChatMessageSentEvent(pusherMsg, false);
        expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
        expect(pusherMsg.sender.profilePicture).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE); // Pusher has no profile pic

        // Webhook arrives - should cancel the timer
        try {
            await handleChatMessageSentEvent(webhookMsg, true);
        } catch {
            // Expected - integration not mocked
        }

        // Verify clearTimeout was called
        expect(clearTimeoutSpy).toHaveBeenCalled();
        expect(webhookMsg.sender.profilePicture).toBe("https://example.com/avatar.jpg"); // Webhook has profile pic

        setTimeoutSpy.mockRestore();
        clearTimeoutSpy.mockRestore();
    });

    it('ignores Pusher message if webhook already processed', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        const webhookMsg = createWebhookMessage("msg-ignore-test");
        const pusherMsg = createPusherMessage("msg-ignore-test");

        // Webhook arrives first
        try {
            await handleChatMessageSentEvent(webhookMsg, true);
        } catch {
            // Expected - integration not mocked
        }

        expect(webhookMsg.sender.profilePicture).toBe("https://example.com/avatar.jpg"); // Webhook has profile pic
        const initialCallCount = setTimeoutSpy.mock.calls.length;

        // Pusher arrives later - should be ignored
        await handleChatMessageSentEvent(pusherMsg, false);

        // setTimeout should not have been called again
        expect(setTimeoutSpy).toHaveBeenCalledTimes(initialCallCount);
        expect(pusherMsg.sender.profilePicture).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE); // Pusher has no profile pic

        setTimeoutSpy.mockRestore();
    });

    it('deduplicates webhook arriving after Pusher already delivered', async () => {
        const { integration } = require("../../integration");
        const { firebot } = require("../../main");
        const registerMessageMock = integration.kick.chatManager.registerMessage;
        const frontendSendMock = firebot.modules.frontendCommunicator.send;
        const eventManagerMock = firebot.modules.eventManager.triggerEvent;

        // First call (Pusher after 5s) succeeds, second call (webhook at 10s) is duplicate
        registerMessageMock
            .mockResolvedValueOnce(true) // Pusher message registers successfully
            .mockResolvedValueOnce(false); // Webhook is rejected as duplicate

        const pusherMsg = createPusherMessage("msg-late-webhook-test");
        const webhookMsg = createWebhookMessage("msg-late-webhook-test");

        // Pusher arrives at T=0, scheduled for T=5
        const pusherPromise = handleChatMessageSentEvent(pusherMsg, false);
        await pusherPromise;

        // Fast-forward 5 seconds - this triggers the timeout
        await jest.advanceTimersByTimeAsync(5000);

        // Verify Pusher message was registered and resulted in actual message processing
        expect(registerMessageMock).toHaveBeenCalledTimes(1);
        expect(registerMessageMock).toHaveBeenNthCalledWith(1, "msg-late-webhook-test", "kick", expect.objectContaining({
            profilePicUrl: IntegrationConstants.DEFAULT_PROFILE_IMAGE // Pusher message has no profile pic
        }));
        const initialEventCallCount = eventManagerMock.mock.calls.length;

        // Webhook arrives at T=10 (late)
        await handleChatMessageSentEvent(webhookMsg, true);

        // Verify webhook attempted to register but was rejected as duplicate
        expect(registerMessageMock).toHaveBeenCalledTimes(2);
        expect(registerMessageMock).toHaveBeenNthCalledWith(2, "msg-late-webhook-test", "kick", expect.objectContaining({
            profilePicUrl: "https://example.com/avatar.jpg" // Webhook has profile pic
        }));

        // Verify NO additional events were triggered for the duplicate webhook
        expect(eventManagerMock).toHaveBeenCalledTimes(initialEventCallCount);
        expect(frontendSendMock).toHaveBeenCalledTimes(0); // Chat feed disabled in mocks

        // Both messages have their expected profile picture states
        expect(pusherMsg.sender.profilePicture).toBe(IntegrationConstants.DEFAULT_PROFILE_IMAGE);
        expect(webhookMsg.sender.profilePicture).toBe("https://example.com/avatar.jpg");
    });
});
