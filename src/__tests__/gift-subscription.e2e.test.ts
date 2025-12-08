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
import { InboundWebhook } from '../internal/webhook-handler/webhook';
import { webhookHandler } from '../internal/webhook-handler/webhook-handler';
import { giftSubCache } from '../events/sub-events';

describe('e2e gift subscription events', () => {
    beforeEach(() => {
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

    const webhookGiftSubPayload: InboundWebhook = {
        kickEventMessageId: "gift-msg-123",
        kickEventSubscriptionId: "gift-sub-456",
        kickEventMessageTimestamp: "1693589518",
        kickEventType: "channel.subscription.gifts",
        kickEventVersion: "1",
        rawData: webhookGiftSubData
    };

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
                    kickEventMessageId: "unique-gift-msg-1",
                    rawData: uniqueWebhookData
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
});
