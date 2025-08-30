export const triggerEventMock = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        getSettings: () => null
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

describe('e2e moderation unbanned', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    const jsonInput = `{"user":{"id":333,"username":"timeoutuser"},"unbanned_by":{"id":444,"username":"mod2"},"permanent":false}`;
    const payload = JSON.parse(jsonInput);
    const event = 'App\\Events\\UserUnbannedEvent';
    const expectedMetadata = {
        userId: 'k333',
        username: 'timeoutuser@kick',
        userDisplayName: 'timeoutuser',
        moderatorId: 'k444',
        moderatorUsername: 'mod2@kick',
        moderatorDisplayName: 'mod2',
        moderator: 'mod2@kick',
        banType: 'timeout',
        platform: 'kick'
    };

    describe('un-timeout', () => {
        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({ triggerTwitchEvents: { viewerUnbanned: true } });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "unbanned", expectedMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "unbanned", expectedMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({ triggerTwitchEvents: { viewerUnbanned: false } });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "unbanned", expectedMetadata);
            });
        });
    });

    describe('un-banned', () => {
        // Same test as above, except banType == permanent
        const expectedMetadataPermanent = {
            ...expectedMetadata,
            banType: 'permanent'
        };
        const payloadPermanent = { ...payload, permanent: true};

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({ triggerTwitchEvents: { viewerUnbanned: true } });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payloadPermanent)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "unbanned", expectedMetadataPermanent);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "unbanned", expectedMetadataPermanent);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({ triggerTwitchEvents: { viewerUnbanned: false } });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payloadPermanent)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "unbanned", expectedMetadataPermanent);
            });
        });
    });
});
