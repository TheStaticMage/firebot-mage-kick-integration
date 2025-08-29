export const triggerEventMock = jest.fn();

export const userManagerMock = {
    getOrCreateViewer: jest.fn()
};

jest.mock('../integration', () => ({
    integration: {
        getSettings: () => null,
        kick: {
            broadcaster: {
                email: "you@example.com",
                name: "You",
                profilePicture: "https://your-profile-pic",
                userId: 1234567890
            },
            userManager: userManagerMock
        }
    }
}));

jest.mock('../main', () => ({
    firebot: {
        modules: {
            eventManager: {
                triggerEvent: triggerEventMock
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

describe('e2e stream incoming hosted', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    const jsonInput = `{"message":{"id":"d251ef14-5f5c-4593-8f7d-f5cc0aa52571","numberOfViewers":32,"optionalMessage":"","createdAt":"2025-08-20T20:26:31.231698Z"},"user":{"id":1234567,"username":"Kicker","isSuperAdmin":false,"verified":{"id":12345,"channel_id":7654321,"created_at":"2025-05-12T14:00:00.000000Z","updated_at":"2025-05-12T14:00:00.000000Z"}}}`;
    const payload = JSON.parse(jsonInput);
    const event = 'App\\Events\\StreamHostedEvent';
    const expectedMetadata = {
        userId: 'k1234567',
        username: 'Kicker@kick',
        userDisplayName: 'Kicker',
        viewerCount: 32,
        platform: 'kick'
    };

    describe('twitch forwarding enabled', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            integration.getSettings = () => ({ triggerTwitchEvents: { raid: true } });
        });

        it('triggers all expected events', async () => {
            await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
            expect(userManagerMock.getOrCreateViewer).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: '1234567',
                    username: 'Kicker',
                    displayName: 'Kicker'
                }),
                [],
                true
            );
            expect(triggerEventMock).toHaveBeenCalledTimes(2);
            expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
            expect(triggerEventMock).toHaveBeenCalledWith("twitch", "raid", expectedMetadata);
        });
    });

    describe('twitch forwarding disabled', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            integration.getSettings = () => ({ triggerTwitchEvents: { raid: false } });
        });

        it('triggers all expected events', async () => {
            await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
            expect(userManagerMock.getOrCreateViewer).toHaveBeenCalledWith(
                expect.objectContaining({
                    userId: '1234567',
                    username: 'Kicker',
                    displayName: 'Kicker'
                }),
                [],
                true
            );
            expect(triggerEventMock).toHaveBeenCalledTimes(1);
            expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
        });
    });
});

describe('e2e stream outgoing hosted', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    const jsonInput = `{"channel":{"id":12345678,"user_id":23456789,"slug":"slug","is_banned":false,"playback_url":"https://playback_url","name_updated_at":null,"vod_enabled":true,"subscription_enabled":true,"is_affiliate":true,"can_host":false,"current_livestream":{"id":3456789,"slug":"stream-slug","channel_id":12345678,"created_at":"2025-08-21 17:06:41","session_title":"Title of my stream","is_live":true,"risk_level_id":null,"start_time":"2025-08-21 17:06:40","source":null,"twitch_channel":null,"duration":0,"language":"English","is_mature":false,"viewer_count":14}},"slug":"target-slug","hosted":{"id":87654321,"username":"Target_User","slug":"target-slug","viewers_count":19,"is_live":true,"profile_pic":"https://profile_pic","category":"Games","preview_thumbnail":{"srcset":"https://thumbnail_srcset","src":"https://thumbnail_src"}}}`;
    const payload = JSON.parse(jsonInput);
    const event = 'App\\Events\\ChatMoveToSupportedChannelEvent';
    const expectedMetadata = {
        userId: 'k1234567890',
        username: 'You@kick',
        userDisplayName: 'You',
        raidTargetUserDisplayName: "Target_User",
        raidTargetUserId: "k87654321",
        raidTargetUsername: "Target_User@kick",
        viewerCount: 19,
        platform: 'kick'
    };

    describe('twitch forwarding enabled', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            integration.getSettings = () => ({ triggerTwitchEvents: { raidSentOff: true } });
        });

        it('triggers all expected events', async () => {
            await expect((pusher as any).dispatchChannelEvent(event, payload)).resolves.not.toThrow();
            expect(triggerEventMock).toHaveBeenCalledTimes(2);
            expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid-sent-off", expectedMetadata);
            expect(triggerEventMock).toHaveBeenCalledWith("twitch", "raid-sent-off", expectedMetadata);
        });
    });

    describe('twitch forwarding disabled', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            integration.getSettings = () => ({ triggerTwitchEvents: { raidSentOff: false } });
        });

        it('triggers all expected events', async () => {
            await expect((pusher as any).dispatchChannelEvent(event, payload)).resolves.not.toThrow();
            expect(triggerEventMock).toHaveBeenCalledTimes(1);
            expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid-sent-off", expectedMetadata);
        });
    });
});
