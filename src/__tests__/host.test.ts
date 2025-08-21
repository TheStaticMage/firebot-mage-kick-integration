export const triggerEventMock = jest.fn();

export const userManagerMock = {
    getViewerById: jest.fn(),
    createNewViewer: jest.fn()
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

import { KickPusher } from '../internal/pusher/pusher';
import { IntegrationConstants } from '../constants';
import { FirebotViewer } from '@crowbartools/firebot-custom-scripts-types/types/modules/viewer-database';

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
    const firebotViewer: FirebotViewer = {
        _id: 'k1234567',
        username: 'Kicker@kick',
        displayName: 'Kicker',
        profilePicUrl: '',
        twitch: false,
        twitchRoles: [],
        online: false,
        onlineAt: 0,
        lastSeen: 0,
        joinDate: 0,
        minutesInChannel: 0,
        chatMessages: 0,
        disableAutoStatAccrual: true,
        disableActiveUserList: true,
        disableViewerList: true,
        metadata: {},
        currency: {},
        ranks: {}
    };

    describe('twitch forwarding enabled', () => {
        describe('viewer database had user', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({ triggerTwitchEvents: { raid: true } });
                (userManagerMock.getViewerById).mockReturnValueOnce(firebotViewer);
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
                expect(userManagerMock.createNewViewer).not.toHaveBeenCalled();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "raid", expectedMetadata);
            });
        });

        describe('viewer database created user', () => {
            beforeEach(() => {
                (userManagerMock.createNewViewer).mockReturnValueOnce(firebotViewer);
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "raid", expectedMetadata);
            });
        });

        describe('viewer database failed', () => {
            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
                expect(userManagerMock.getViewerById).toHaveBeenCalledWith("k1234567");
                expect(userManagerMock.createNewViewer).toHaveBeenCalledWith({"channelSlug": "", "displayName": "Kicker", "isVerified": true, "profilePicture": "", "userId": "1234567", "username": "Kicker"}, [], true);
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "raid", expectedMetadata);
            });
        });
    });

    describe('twitch forwarding disabled', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            integration.getSettings = () => ({ triggerTwitchEvents: { raid: false } });
            (userManagerMock.getViewerById).mockReturnValueOnce(firebotViewer);
        });

        it('triggers all expected events', async () => {
            await expect((pusher as any).dispatchChatroomEvent(event, payload)).resolves.not.toThrow();
            expect(userManagerMock.createNewViewer).not.toHaveBeenCalled();
            expect(triggerEventMock).toHaveBeenCalledTimes(1);
            expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "raid", expectedMetadata);
        });
    });
});
