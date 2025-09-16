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
import { KickPusher } from '../internal/pusher/pusher';

describe('e2e kicks gifted events', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        // Mock the delay method to resolve immediately for testing
        jest.spyOn(pusher as any, 'delay').mockResolvedValue(undefined);
        jest.clearAllMocks();
        mockGetSettings.mockReturnValue({
            triggerTwitchEvents: { cheer: false },
            logging: { logWebhooks: false }
        });
    });

    describe('pusher only - KicksGifted', () => {
        it('handles pusher kicks gifted event', async () => {
            const pusherEvent = 'KicksGifted';

            /* eslint-disable camelcase */
            const pusherPayload = {
                message: "",
                sender: {
                    id: 12345678,
                    username: "gifter-username",
                    username_color: "#ffffcc"
                },
                gift: {
                    amount: 69
                }
            };
            /* eslint-enable camelcase */

            const expectedKickMetadata = {
                userId: 'k12345678',
                username: 'gifter-username@kick',
                userDisplayName: 'gifter-username',
                amount: 69,
                bits: 69, // Mapped to bits for Twitch compatibility
                platform: 'kick'
            };

            // Simulate pusher event dispatch
            await (pusher as any).dispatchChannelEvent(pusherEvent, pusherPayload);

            // With mocked delay, the event should process immediately
            // Allow all async operations to complete
            await new Promise(resolve => setImmediate(resolve));

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

        it('handles pusher kicks gifted event with twitch forwarding enabled', async () => {
            // Enable Twitch cheer forwarding
            mockGetSettings.mockReturnValue({
                triggerTwitchEvents: { cheer: true },
                logging: { logWebhooks: false }
            });

            const pusherEvent = 'KicksGifted';

            /* eslint-disable camelcase */
            const pusherPayload = {
                message: "",
                sender: {
                    id: 12345678,
                    username: "gifter-username",
                    username_color: "#ffffcc"
                },
                gift: {
                    amount: 69
                }
            };
            /* eslint-enable camelcase */

            const expectedMetadata = {
                userId: 'k12345678',
                username: 'gifter-username@kick',
                userDisplayName: 'gifter-username',
                amount: 69,
                bits: 69,
                platform: 'kick'
            };

            // Simulate pusher event dispatch
            await (pusher as any).dispatchChannelEvent(pusherEvent, pusherPayload);

            // Allow all async operations to complete
            await new Promise(resolve => setImmediate(resolve));

            // Should trigger both kicks-gifted and Twitch cheer events
            expect(triggerEventMock).toHaveBeenCalledWith(
                IntegrationConstants.INTEGRATION_ID,
                "kicks-gifted",
                expectedMetadata
            );

            expect(triggerEventMock).toHaveBeenCalledWith(
                "twitch",
                "cheer",
                expectedMetadata
            );
        });
    });
});
