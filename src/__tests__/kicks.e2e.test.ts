const triggerEventMock = jest.fn();
const mockGetSettings = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        kick: {
            broadcaster: {
                userId: "123456",
                name: "teststreamer",
                profilePicture: "https://example.com/profile.jpg"
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
import { webhookHandler } from '../internal/webhook-handler/webhook-handler';

describe('e2e kicks gifted events', () => {
    /* eslint-disable camelcase */
    const webhookKicksGiftedPayload: InboundWebhook = {
        kickEventMessageId: "msg-kicks-gifted-1",
        kickEventSubscriptionId: "sub-kicks-123",
        kickEventMessageTimestamp: "1693589518",
        kickEventType: "kicks.gifted",
        kickEventVersion: "1",
        rawData: Buffer.from(JSON.stringify({
            sender: {
                user_id: 12345678,
                username: "gifter-username",
                username_color: "#ffffcc"
            },
            gift: {
                gift_id: "super_gift",
                name: "Super Gift",
                type: "BASIC",
                tier: "BASIC",
                character_limit: 69,
                pinned_time: 123456789,
                amount: 25,
                message: "Test message"
            }
        })).toString('base64')
    };

    const expectedKickMetadata = {
        userId: 'k12345678',
        username: 'gifter-username@kick',
        userDisplayName: 'gifter-username',
        amount: 25,
        bits: 25, // Mapped to bits for Twitch compatibility
        characterLimit: 0,
        cheerMessage: 'Test message',
        giftId: '',
        giftName: 'Super Gift',
        giftType: 'BASIC',
        giftTier: 'BASIC',
        pinnedTime: 0,
        platform: 'kick'
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockGetSettings.mockReturnValue({
            triggerTwitchEvents: { cheer: false },
            logging: { logWebhooks: false }
        });
    });

    describe('webhook only - kicks.gifted', () => {
        it('handles webhook kicks gifted event', async () => {

            await expect(webhookHandler.handleWebhook(webhookKicksGiftedPayload)).resolves.not.toThrow();

            // Should trigger kicks-gifted event
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "kicks-gifted",
                expectedKickMetadata
            );

            // Should NOT trigger Twitch cheer event since it's disabled
            expect(triggerEventMock).not.toHaveBeenCalledWith(
                "twitch",
                "cheer",
                expect.any(Object)
            );
        });

        it('handles webhook kicks gifted event with twitch forwarding enabled', async () => {
            // Enable Twitch cheer forwarding
            mockGetSettings.mockReturnValue({
                triggerTwitchEvents: { cheer: true },
                logging: { logWebhooks: false }
            });

            const uniqueWebhookPayload: InboundWebhook = {
                ...webhookKicksGiftedPayload,
                kickEventMessageId: "msg-kicks-gifted-2",
                rawData: Buffer.from(JSON.stringify({
                    sender: {
                        user_id: 12345678,
                        username: "gifter-username",
                        username_color: "#cccccc" // Different color to avoid payload hash collision
                    },
                    gift: {
                        gift_id: "super_gift",
                        name: "Super Gift",
                        type: "BASIC",
                        tier: "BASIC",
                        character_limit: 69,
                        pinned_time: 123456789,
                        amount: 25,
                        message: "Test message"
                    }
                })).toString('base64')
            };
            /* eslint-enable camelcase */

            await expect(webhookHandler.handleWebhook(uniqueWebhookPayload)).resolves.not.toThrow();

            // Should trigger both kicks-gifted and Twitch cheer events
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "kicks-gifted",
                expectedKickMetadata
            );

            expect(triggerEventMock).toHaveBeenCalledWith(
                "twitch",
                "cheer",
                expectedKickMetadata
            );
        });
    });
});
