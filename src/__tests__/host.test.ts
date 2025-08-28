export const triggerEventMock = jest.fn();

export const userManagerMock = {
    getOrCreateViewer: jest.fn()
};

jest.mock('../integration', () => ({
    integration: {
        getSettings: () => null,
        kick: {
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

describe('e2e stream hosted', () => {
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
