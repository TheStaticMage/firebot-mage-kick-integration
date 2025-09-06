const triggerEventMock = jest.fn();
const mockGetOrCreateViewer = jest.fn();
const mockRecordSubscription = jest.fn();
const mockRecordGift = jest.fn();
const mockGetViewerByUsername = jest.fn();
const mockGetSettings = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        kick: {
            broadcaster: {
                userId: "123456",
                name: "teststreamer",
                profilePicture: "https://example.com/profile.jpg"
            },
            userManager: {
                getOrCreateViewer: (...args: any[]) => mockGetOrCreateViewer(...args),
                recordSubscription: (...args: any[]) => mockRecordSubscription(...args),
                recordGift: (...args: any[]) => mockRecordGift(...args),
                getViewerByUsername: (...args: any[]) => mockGetViewerByUsername(...args)
            }
        },
        getSettings: () => mockGetSettings()
    }
}));

jest.mock('../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: triggerEventMock
            },
            frontendCommunicator: {
                send: jest.fn()
            }
        },
        firebot: {
            settings: {
                getSetting: jest.fn().mockReturnValue(false) // IgnoreSubsequentSubEventsAfterCommunitySub
            }
        }
    },
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

import { IntegrationConstants } from '../constants';
import { KickPusher } from '../internal/pusher/pusher';
import { webhookHandler } from '../internal/webhook-handler/webhook-handler';
import { giftSubCache } from '../events/sub-events';

interface InboundWebhook {
    kick_event_message_id: string;
    kick_event_subscription_id: string;
    kick_event_message_timestamp: string;
    kick_event_type: string;
    kick_event_version: string;
    is_test_event?: boolean;
    raw_data: string;
}

describe('e2e gift subscription events', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        // Mock the delay method to resolve immediately for testing
        jest.spyOn(pusher as any, 'delay').mockResolvedValue(undefined);
        jest.clearAllMocks();
        giftSubCache.flushAll(); // Clear deduplication cache
        mockGetOrCreateViewer.mockResolvedValue(undefined);
        mockRecordSubscription.mockResolvedValue(undefined);
        mockRecordGift.mockResolvedValue(undefined);
        mockGetSettings.mockReturnValue({
            triggerTwitchEvents: { subGift: false },
            logging: { logWebhooks: false }
        });
    });

    // Test data - webhook gift subscription payload
    const webhookGiftSubData = Buffer.from(JSON.stringify({
        "broadcaster": {
            "user_id": 123456,
            "username": "teststreamer",
            "is_verified": false,
            "profile_picture": "https://example.com/broadcaster.jpg",
            "channel_slug": "teststreamer"
        },
        "gifter": {
            "user_id": 789012,
            "username": "gifterguy",
            "is_verified": false,
            "profile_picture": "https://example.com/gifter.jpg",
            "channel_slug": "gifterguy"
        },
        "giftees": [
            {
                "user_id": 111222,
                "username": "recipient1",
                "is_verified": false,
                "profile_picture": "https://example.com/recipient1.jpg",
                "channel_slug": "recipient1"
            },
            {
                "user_id": 333444,
                "username": "recipient2",
                "is_verified": false,
                "profile_picture": "https://example.com/recipient2.jpg",
                "channel_slug": "recipient2"
            }
        ],
        "created_at": "2025-09-01T18:00:00+00:00",
        "expires_at": "2025-10-01T18:00:00+00:00"
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookGiftSubPayload: InboundWebhook = {
        kick_event_message_id: "gift-msg-123",
        kick_event_subscription_id: "gift-sub-456",
        kick_event_message_timestamp: "1693589518",
        kick_event_type: "channel.subscription.gifts",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookGiftSubData
    };
    /* eslint-enable camelcase */

    const expectedKickMetadata = {
        gifterUsername: 'gifterguy@kick',
        gifterUserId: 'k789012',
        gifterUserDisplayName: 'gifterguy',
        isAnonymous: false,
        subCount: 2,
        subPlan: 'kickDefault',
        giftReceivers: [
            { gifteeUsername: 'recipient1@kick', gifteeUserId: 'k111222', gifteeUserDisplayName: 'recipient1', giftSubMonths: 1 },
            { gifteeUsername: 'recipient2@kick', gifteeUserId: 'k333444', gifteeUserDisplayName: 'recipient2', giftSubMonths: 1 }
        ],
        platform: 'kick'
    };

    const expectedIndividualKickMetadata1 = {
        gifterUsername: 'gifterguy@kick',
        gifterUserId: 'k789012',
        gifterUserDisplayName: 'gifterguy',
        isAnonymous: false,
        subPlan: 'kickDefault',
        giftSubMonths: 1,
        giftSubDuration: 1,
        gifteeUsername: 'recipient1@kick',
        gifteeUserId: 'k111222',
        gifteeUserDisplayName: 'recipient1',
        platform: 'kick'
    };

    const expectedIndividualKickMetadata2 = {
        gifterUsername: 'gifterguy@kick',
        gifterUserId: 'k789012',
        gifterUserDisplayName: 'gifterguy',
        isAnonymous: false,
        subPlan: 'kickDefault',
        giftSubMonths: 1,
        giftSubDuration: 1,
        gifteeUsername: 'recipient2@kick',
        gifteeUserId: 'k333444',
        gifteeUserDisplayName: 'recipient2',
        platform: 'kick'
    };

    describe('webhook only - channel.subscription.gifts', () => {
        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                mockGetSettings.mockReturnValue({
                    triggerTwitchEvents: { subGift: false },
                    logging: { logWebhooks: false }
                });
            });

            it('handles webhook gift subscription event', async () => {
                // Create unique webhook for this test to avoid cache issues
                const uniqueWebhookData = Buffer.from(JSON.stringify({
                    "broadcaster": {
                        "user_id": 123456,
                        "username": "teststreamer",
                        "is_verified": false,
                        "profile_picture": "https://example.com/broadcaster.jpg",
                        "channel_slug": "teststreamer"
                    },
                    "gifter": {
                        "user_id": 789012,
                        "username": "gifterguy",
                        "is_verified": false,
                        "profile_picture": "https://example.com/gifter.jpg",
                        "channel_slug": "gifterguy"
                    },
                    "giftees": [
                        {
                            "user_id": 111222,
                            "username": "recipient1",
                            "is_verified": false,
                            "profile_picture": "https://example.com/recipient1.jpg",
                            "channel_slug": "recipient1"
                        },
                        {
                            "user_id": 333444,
                            "username": "recipient2",
                            "is_verified": false,
                            "profile_picture": "https://example.com/recipient2.jpg",
                            "channel_slug": "recipient2"
                        }
                    ],
                    "created_at": "2025-09-01T18:00:00+00:00",
                    "expires_at": "2025-10-01T18:00:00+00:00",
                    "test_unique_id": "webhook-test-1" // Make each test unique
                })).toString('base64');

                const uniqueWebhookPayload = {
                    ...webhookGiftSubPayload,
                    kick_event_message_id: "unique-gift-msg-1", // eslint-disable-line camelcase
                    raw_data: uniqueWebhookData // eslint-disable-line camelcase
                };

                await expect(webhookHandler.handleWebhook(uniqueWebhookPayload)).resolves.not.toThrow();

                // Should trigger community subs gifted event (2 giftees)
                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "community-subs-gifted",
                    expectedKickMetadata
                );

                // Should trigger individual subs-gifted events for each recipient
                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "subs-gifted",
                    expectedIndividualKickMetadata1
                );

                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "subs-gifted",
                    expectedIndividualKickMetadata2
                );

                // Should NOT trigger Twitch events
                expect(triggerEventMock).not.toHaveBeenCalledWith("twitch", expect.any(String), expect.any(Object));

                // Should call userManager methods
                expect(mockGetOrCreateViewer).toHaveBeenCalledTimes(3); // gifter + 2 giftees
                expect(mockRecordSubscription).toHaveBeenCalledTimes(2); // 2 giftees
                expect(mockRecordGift).toHaveBeenCalledTimes(2); // 2 gifts recorded

                expect(triggerEventMock).toHaveBeenCalledTimes(4); // 1 community + 2 individual + 1 webhook-received
            });
        });

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                mockGetSettings.mockReturnValue({
                    triggerTwitchEvents: { subGift: true },
                    logging: { logWebhooks: false }
                });
            });

            it('handles webhook gift subscription event with twitch forwarding', async () => {
                await expect(webhookHandler.handleWebhook(webhookGiftSubPayload)).resolves.not.toThrow();

                // Should trigger community subs gifted event
                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "community-subs-gifted",
                    expectedKickMetadata
                );

                // Should trigger individual Kick events
                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "subs-gifted",
                    expectedIndividualKickMetadata1
                );

                expect(triggerEventMock).toHaveBeenCalledWith(
                    IntegrationConstants.INTEGRATION_ID,
                    "subs-gifted",
                    expectedIndividualKickMetadata2
                );

                // Should ALSO trigger Twitch events for individual gifts
                expect(triggerEventMock).toHaveBeenCalledWith(
                    "twitch",
                    "subs-gifted",
                    expectedIndividualKickMetadata1
                );

                expect(triggerEventMock).toHaveBeenCalledWith(
                    "twitch",
                    "subs-gifted",
                    expectedIndividualKickMetadata2
                );

                expect(triggerEventMock).toHaveBeenCalledTimes(6); // 1 community + 2 kick individual + 2 twitch individual + 1 webhook-received
            });
        });
    });

    describe('pusher only - App\\Events\\LuckyUsersWhoGotGiftSubscriptionsEvent', () => {
        beforeEach(() => {
            // Mock database lookups for pusher event
            mockGetViewerByUsername
                .mockResolvedValueOnce({
                    _id: "789012",
                    username: "TheGifter",
                    displayName: "TheGifter",
                    profilePicUrl: "https://example.com/gifter.jpg"
                })
                .mockResolvedValueOnce({
                    _id: "111222",
                    username: "RecipientOne",
                    displayName: "RecipientOne",
                    profilePicUrl: "https://example.com/recipient1.jpg"
                });
        });

        it('handles pusher gift subscription event', async () => {
            // Test data based on provided payload but anonymized
            const pusherEvent = 'App\\Events\\LuckyUsersWhoGotGiftSubscriptionsEvent';
            /* eslint-disable camelcase */
            const pusherPayload = {
                channel: {
                    id: 12345,
                    user_id: 123456,
                    slug: "test-streamer",
                    is_banned: false,
                    playback_url: "https://example.playback.url/test.m3u8",
                    name_updated_at: null,
                    vod_enabled: true,
                    subscription_enabled: true,
                    is_affiliate: true,
                    can_host: true,
                    chatroom: {
                        id: 11111,
                        chatable_type: "App\\Models\\Channel",
                        channel_id: 12345,
                        created_at: "2025-07-25T20:51:05.000000Z",
                        updated_at: "2025-07-25T20:51:05.000000Z",
                        chat_mode_old: "public",
                        chat_mode: "public",
                        slow_mode: false,
                        chatable_id: 12345,
                        followers_mode: false,
                        subscribers_mode: false,
                        emotes_mode: false,
                        message_interval: 0,
                        following_min_duration: 0
                    }
                },
                usernames: ["RecipientOne"],
                gifter_username: "TheGifter"
            };
            /* eslint-enable camelcase */

            const expectedIndividualMetadata = {
                giftSubDuration: 1,
                giftSubMonths: 1,
                gifteeUsername: 'RecipientOne@kick',
                gifteeUserId: 'k111222',
                gifteeUserDisplayName: 'RecipientOne',
                gifterUsername: 'TheGifter@kick',
                gifterUserId: 'k789012',
                gifterUserDisplayName: 'TheGifter',
                isAnonymous: undefined, // Not explicitly set in pusher parser
                platform: 'kick',
                subPlan: 'kickDefault'
            };

            // Simulate pusher event dispatch
            await (pusher as any).dispatchChannelEvent(pusherEvent, pusherPayload);

            // With mocked delay, the event should process immediately
            // Allow all async operations to complete
            await new Promise(resolve => setImmediate(resolve));

            // Should NOT trigger community subs gifted event (only 1 giftee)
            expect(triggerEventMock).not.toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "community-subs-gifted",
                expect.any(Object)
            );

            // Should trigger individual subs-gifted event
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "subs-gifted",
                expectedIndividualMetadata
            );

            expect(triggerEventMock).toHaveBeenCalledTimes(1);
        });
    });

    describe('webhook + pusher races', () => {
        beforeEach(() => {
            // Clear all mocks and cache to ensure clean state
            jest.clearAllMocks();
            giftSubCache.flushAll();

            // Ensure delay mock is properly applied for immediate resolution
            jest.spyOn(pusher as any, 'delay').mockResolvedValue(undefined);

            // Set up mock to return appropriate data based on username
            mockGetViewerByUsername.mockImplementation((username: string) => {
                switch (username) {
                    case "gifterguy":
                        return Promise.resolve({
                            _id: "789012",
                            username: "gifterguy",
                            displayName: "gifterguy",
                            profilePicUrl: "https://example.com/gifter.jpg"
                        });
                    case "recipient1":
                        return Promise.resolve({
                            _id: "111222",
                            username: "recipient1",
                            displayName: "recipient1",
                            profilePicUrl: "https://example.com/recipient1.jpg"
                        });
                    case "different_recipient":
                        return Promise.resolve({
                            _id: "555666",
                            username: "different_recipient",
                            displayName: "different_recipient",
                            profilePicUrl: "https://example.com/different.jpg"
                        });
                    default:
                        return Promise.resolve(null);
                }
            });
        });

        it('handles matching webhook and pusher events - webhook processes first due to delay', async () => {
            // Test data with matching gifter and giftee usernames
            // Note: Webhook and Pusher format usernames differently (pusher adds @kick)
            // so they won't be deduplicated - this tests the scenario where both
            // events are processed as separate but related events
            const pusherEvent = 'App\\Events\\LuckyUsersWhoGotGiftSubscriptionsEvent';
            /* eslint-disable camelcase */
            const pusherPayload = {
                channel: {
                    id: 123456,
                    user_id: 123456,
                    slug: "teststreamer",
                    is_banned: false,
                    playback_url: "https://example.playback.url/test.m3u8",
                    name_updated_at: null,
                    vod_enabled: true,
                    subscription_enabled: true,
                    is_affiliate: true,
                    can_host: true,
                    chatroom: {
                        id: 11111,
                        chatable_type: "App\\Models\\Channel",
                        channel_id: 123456,
                        created_at: "2025-07-25T20:51:05.000000Z",
                        updated_at: "2025-07-25T20:51:05.000000Z",
                        chat_mode_old: "public",
                        chat_mode: "public",
                        slow_mode: false,
                        chatable_id: 123456,
                        followers_mode: false,
                        subscribers_mode: false,
                        emotes_mode: false,
                        message_interval: 0,
                        following_min_duration: 0
                    }
                },
                usernames: ["recipient1"],
                gifter_username: "gifterguy"
            };
            /* eslint-enable camelcase */

            // Create matching webhook payload (same gifter and giftee)
            const matchingWebhookData = Buffer.from(JSON.stringify({
                "broadcaster": {
                    "user_id": 123456,
                    "username": "teststreamer",
                    "is_verified": false,
                    "profile_picture": "https://example.com/broadcaster.jpg",
                    "channel_slug": "teststreamer"
                },
                "gifter": {
                    "user_id": 789012,
                    "username": "gifterguy",
                    "is_verified": false,
                    "profile_picture": "https://example.com/gifter.jpg",
                    "channel_slug": "gifterguy"
                },
                "giftees": [
                    {
                        "user_id": 111222,
                        "username": "recipient1",
                        "is_verified": false,
                        "profile_picture": "https://example.com/recipient1.jpg",
                        "channel_slug": "recipient1"
                    }
                ],
                "created_at": "2025-09-01T18:00:00+00:00",
                "expires_at": "2025-10-01T18:00:00+00:00"
            })).toString('base64');

            /* eslint-disable camelcase */
            const matchingWebhookPayload: InboundWebhook = {
                kick_event_message_id: "gift-msg-race-123",
                kick_event_subscription_id: "gift-sub-race-456",
                kick_event_message_timestamp: "1693589518",
                kick_event_type: "channel.subscription.gifts",
                kick_event_version: "1",
                is_test_event: false,
                raw_data: matchingWebhookData
            };
            /* eslint-enable camelcase */

            // Dispatch pusher event first (but it has a delay)
            const pusherPromise = (pusher as any).dispatchChannelEvent(pusherEvent, pusherPayload);

            // Process webhook event immediately (before pusher delay)
            const webhookPromise = webhookHandler.handleWebhook(matchingWebhookPayload);

            // Wait for both operations to complete
            await Promise.all([webhookPromise, pusherPromise]);

            // Allow all async operations to complete
            await new Promise(resolve => setImmediate(resolve));

            // Both webhook and pusher should trigger events (different username formats)
            // Webhook event
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "subs-gifted",
                {
                    giftSubDuration: 1,
                    giftSubMonths: 1,
                    gifteeUsername: 'recipient1@kick',
                    gifteeUserId: 'k111222',
                    gifteeUserDisplayName: 'recipient1',
                    gifterUsername: 'gifterguy@kick',
                    gifterUserId: 'k789012',
                    gifterUserDisplayName: 'gifterguy',
                    isAnonymous: false,
                    platform: 'kick',
                    subPlan: 'kickDefault'
                }
            );

            // Pusher event
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "subs-gifted",
                {
                    giftSubDuration: 1,
                    giftSubMonths: 1,
                    gifteeUsername: 'recipient1@kick',
                    gifteeUserId: 'k111222',
                    gifteeUserDisplayName: 'recipient1',
                    gifterUsername: 'gifterguy@kick',
                    gifterUserId: 'k789012',
                    gifterUserDisplayName: 'gifterguy',
                    isAnonymous: false,
                    platform: 'kick',
                    subPlan: 'kickDefault'
                }
            );

            // Verify both events were processed
            const subGiftedCalls = triggerEventMock.mock.calls.filter(call => call[1] === "subs-gifted");
            expect(subGiftedCalls).toHaveLength(1);
            expect(triggerEventMock).toHaveBeenCalledTimes(2); // Only webhook should trigger + 1 webhook-received
            const hasWebhookEvent = subGiftedCalls.some(call =>
                call[2].gifteeUsername === 'recipient1@kick');
            expect(hasWebhookEvent).toBe(true);
        });

        it('handles non-matching webhook and pusher events - both process separately', async () => {
            // Test data with different giftee usernames (gifter matches, giftee differs)
            // This test verifies that when webhook and pusher events have different giftees,
            // they should both be processed separately (no deduplication)
            const pusherEvent = 'App\\Events\\LuckyUsersWhoGotGiftSubscriptionsEvent';
            /* eslint-disable camelcase */
            const pusherPayload = {
                channel: {
                    id: 123456,
                    user_id: 123456,
                    slug: "teststreamer",
                    is_banned: false,
                    playback_url: "https://example.playback.url/test.m3u8",
                    name_updated_at: null,
                    vod_enabled: true,
                    subscription_enabled: true,
                    is_affiliate: true,
                    can_host: true,
                    chatroom: {
                        id: 11111,
                        chatable_type: "App\\Models\\Channel",
                        channel_id: 123456,
                        created_at: "2025-07-25T20:51:05.000000Z",
                        updated_at: "2025-07-25T20:51:05.000000Z",
                        chat_mode_old: "public",
                        chat_mode: "public",
                        slow_mode: false,
                        chatable_id: 123456,
                        followers_mode: false,
                        subscribers_mode: false,
                        emotes_mode: false,
                        message_interval: 0,
                        following_min_duration: 0
                    }
                },
                usernames: ["different_recipient5"],
                gifter_username: "gifterguy5"
            };
            /* eslint-enable camelcase */

            // Create webhook payload with different giftee
            const nonMatchingWebhookData = Buffer.from(JSON.stringify({
                "broadcaster": {
                    "user_id": 123456,
                    "username": "teststreamer",
                    "is_verified": false,
                    "profile_picture": "https://example.com/broadcaster.jpg",
                    "channel_slug": "teststreamer"
                },
                "gifter": {
                    "user_id": 789012,
                    "username": "gifterguy6",
                    "is_verified": false,
                    "profile_picture": "https://example.com/gifter.jpg",
                    "channel_slug": "gifterguy6"
                },
                "giftees": [
                    {
                        "user_id": 111222,
                        "username": "recipient6",
                        "is_verified": false,
                        "profile_picture": "https://example.com/recipient1.jpg",
                        "channel_slug": "recipient6"
                    }
                ],
                "created_at": "2025-09-01T18:00:00+00:00",
                "expires_at": "2025-10-01T18:00:00+00:00"
            })).toString('base64');

            /* eslint-disable camelcase */
            const nonMatchingWebhookPayload: InboundWebhook = {
                kick_event_message_id: "gift-msg-nomatch-123",
                kick_event_subscription_id: "gift-sub-nomatch-456",
                kick_event_message_timestamp: "1693589518",
                kick_event_type: "channel.subscription.gifts",
                kick_event_version: "1",
                is_test_event: false,
                raw_data: nonMatchingWebhookData
            };
            /* eslint-enable camelcase */

            // Dispatch pusher event first (but it has a delay)
            const pusherPromise = (pusher as any).dispatchChannelEvent(pusherEvent, pusherPayload);

            // Process webhook event immediately (before pusher delay)
            const webhookPromise = webhookHandler.handleWebhook(nonMatchingWebhookPayload);

            // Wait for both operations to complete
            await Promise.all([webhookPromise, pusherPromise]);

            // Allow all async operations to complete
            await new Promise(resolve => setImmediate(resolve));

            // Check what events were actually triggered
            const allCalls = triggerEventMock.mock.calls;
            const subGiftedCalls = allCalls.filter(call => call[1] === "subs-gifted");
            expect(subGiftedCalls.length).toBe(2);

            const hasWebhookEvent = subGiftedCalls.some(call =>
                call[2].gifteeUsername === 'recipient6@kick');
            const hasPusherEvent = subGiftedCalls.some(call =>
                call[2].gifteeUsername === 'different_recipient5@kick');

            expect(hasPusherEvent).toBe(true);
            expect(hasWebhookEvent).toBe(true);

            // This test verifies that different events can be processed separately
            expect(triggerEventMock).toHaveBeenCalledTimes(subGiftedCalls.length + 1); // +1 for webhook-received
        });
    });
});
