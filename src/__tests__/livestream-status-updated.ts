export const triggerEventMock = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        getSettings: jest.fn(),
        kick: {
            channelManager: {
                updateLiveStatus: jest.fn()
            },
            broadcaster: {
                userId: "123456",
                name: "teststreamer",
                profilePicture: "https://example.com/avatar.jpg"
            }
        }
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
import { webhookHandler } from '../internal/webhook-handler/webhook-handler';

describe('e2e livestream status updated', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();

        // Set default integration settings
        const integration = require('../integration').integration;
        integration.kick.channelManager.updateLiveStatus.mockReturnValue(true);
        integration.getSettings = () => ({
            triggerTwitchEvents: {
                streamOnline: true,
                streamOffline: true
            },
            logging: { logWebhooks: false }
        });
    });

    // Pusher stream start payload (StreamerIsLiveEvent)
    /* eslint-disable camelcase */
    const pusherStreamStartPayload = {
        livestream: {
            session_title: "Testing Stream Title",
            created_at: "2025-09-02T10:00:00+00:00"
        }
    };
    /* eslint-enable camelcase */
    const pusherStreamStartEvent = 'App\\Events\\StreamerIsLiveEvent';

    // Different payload for disabled test to avoid any potential conflicts
    /* eslint-disable camelcase */
    const pusherStreamStartPayloadDisabled = {
        livestream: {
            session_title: "Testing Stream Title Disabled",
            created_at: "2025-09-02T10:01:00+00:00"
        }
    };
    /* eslint-enable camelcase */

    // Pusher stream stop payload (StopStreamBroadcast) - no data payload
    const pusherStreamStopEvent = 'App\\Events\\StopStreamBroadcast';

    // Webhook stream start payload - base64 encoded JSON
    const webhookStreamStartData = Buffer.from(JSON.stringify({
        "eventType": "livestream.status.updated",
        "eventVersion": "1",
        "broadcaster": {
            "user_id": 123456,
            "username": "teststreamer",
            "is_verified": false,
            "profile_picture": "https://example.com/avatar.jpg",
            "channel_slug": "teststreamer"
        },
        "is_live": true,
        "title": "Live Stream from Webhook",
        "started_at": "2025-09-02T10:05:00+00:00",
        "ended_at": null
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookStreamStartPayload: InboundWebhook = {
        kick_event_message_id: "msg-stream-start-123",
        kick_event_subscription_id: "sub-livestream-456",
        kick_event_message_timestamp: "1693589518",
        kick_event_type: "livestream.status.updated",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookStreamStartData
    };
    /* eslint-enable camelcase */

    // Webhook stream start payload for disabled test - different content to avoid conflicts
    const webhookStreamStartDataDisabled = Buffer.from(JSON.stringify({
        "eventType": "livestream.status.updated",
        "eventVersion": "1",
        "broadcaster": {
            "user_id": 123457,
            "username": "teststreamer2",
            "is_verified": false,
            "profile_picture": "https://example.com/avatar2.jpg",
            "channel_slug": "teststreamer2"
        },
        "is_live": true,
        "title": "Live Stream from Webhook Disabled",
        "started_at": "2025-09-02T10:06:00+00:00",
        "ended_at": null
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookStreamStartPayloadDisabled: InboundWebhook = {
        kick_event_message_id: "msg-stream-start-disabled-123",
        kick_event_subscription_id: "sub-livestream-disabled-456",
        kick_event_message_timestamp: "1693589519",
        kick_event_type: "livestream.status.updated",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookStreamStartDataDisabled
    };
    /* eslint-enable camelcase */

    // Webhook stream stop payload - base64 encoded JSON
    const webhookStreamStopData = Buffer.from(JSON.stringify({
        "eventType": "livestream.status.updated",
        "eventVersion": "1",
        "broadcaster": {
            "user_id": 123456,
            "username": "teststreamer",
            "is_verified": false,
            "profile_picture": "https://example.com/avatar.jpg",
            "channel_slug": "teststreamer"
        },
        "is_live": false,
        "title": "Stream Ended",
        "started_at": "2025-09-02T10:05:00+00:00",
        "ended_at": "2025-09-02T12:05:00+00:00"
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookStreamStopPayload: InboundWebhook = {
        kick_event_message_id: "msg-stream-stop-789",
        kick_event_subscription_id: "sub-livestream-101",
        kick_event_message_timestamp: "1693589518",
        kick_event_type: "livestream.status.updated",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookStreamStopData
    };
    /* eslint-enable camelcase */

    // Webhook stream stop payload for disabled test - different content to avoid conflicts
    const webhookStreamStopDataDisabled = Buffer.from(JSON.stringify({
        "eventType": "livestream.status.updated",
        "eventVersion": "1",
        "broadcaster": {
            "user_id": 123458,
            "username": "teststreamer3",
            "is_verified": false,
            "profile_picture": "https://example.com/avatar3.jpg",
            "channel_slug": "teststreamer3"
        },
        "is_live": false,
        "title": "Stream Ended Disabled",
        "started_at": "2025-09-02T10:07:00+00:00",
        "ended_at": "2025-09-02T12:07:00+00:00"
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookStreamStopPayloadDisabled: InboundWebhook = {
        kick_event_message_id: "msg-stream-stop-disabled-789",
        kick_event_subscription_id: "sub-livestream-disabled-101",
        kick_event_message_timestamp: "1693589519",
        kick_event_type: "livestream.status.updated",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookStreamStopDataDisabled
    };
    /* eslint-enable camelcase */

    describe('stream start via pusher', () => {
        const expectedStreamOnlineMetadata = {
            username: 'teststreamer@kick',
            userId: 'k123456',
            userDisplayName: 'teststreamer',
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: true,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChannelEvent(pusherStreamStartEvent, pusherStreamStartPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-online", expectedStreamOnlineMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "stream-online", expectedStreamOnlineMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers only kick events', async () => {
                await expect((pusher as any).dispatchChannelEvent(pusherStreamStartEvent, pusherStreamStartPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-online", expectedStreamOnlineMetadata);
            });
        });
    });

    describe('stream stop via pusher', () => {
        const expectedStreamOfflineMetadata = {
            username: 'teststreamer@kick',
            userId: 'k123456',
            userDisplayName: 'teststreamer',
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: true
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChannelEvent(pusherStreamStopEvent, {})).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-offline", expectedStreamOfflineMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "stream-offline", expectedStreamOfflineMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers only kick events', async () => {
                await expect((pusher as any).dispatchChannelEvent(pusherStreamStopEvent, {})).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-offline", expectedStreamOfflineMetadata);
            });
        });
    });

    describe('stream start via webhook', () => {
        const expectedStreamOnlineMetadata = {
            username: 'teststreamer@kick',
            userId: 'k123456',
            userDisplayName: 'teststreamer',
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: true,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect(webhookHandler.handleWebhook(webhookStreamStartPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-online", expectedStreamOnlineMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "stream-online", expectedStreamOnlineMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers only kick events', async () => {
                await expect(webhookHandler.handleWebhook(webhookStreamStartPayloadDisabled)).resolves.not.toThrow();
                const expectedMetadata = {
                    username: 'teststreamer2@kick',
                    userId: 'k123457',
                    userDisplayName: 'teststreamer2',
                    platform: 'kick'
                };
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-online", expectedMetadata);
            });
        });
    });

    describe('stream stop via webhook', () => {
        const expectedStreamOfflineMetadata = {
            username: 'teststreamer@kick',
            userId: 'k123456',
            userDisplayName: 'teststreamer',
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: true
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect(webhookHandler.handleWebhook(webhookStreamStopPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-offline", expectedStreamOfflineMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "stream-offline", expectedStreamOfflineMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        streamOnline: false,
                        streamOffline: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers only kick events', async () => {
                await expect(webhookHandler.handleWebhook(webhookStreamStopPayloadDisabled)).resolves.not.toThrow();
                const expectedMetadata = {
                    username: 'teststreamer3@kick',
                    userId: 'k123458',
                    userDisplayName: 'teststreamer3',
                    platform: 'kick'
                };
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "stream-offline", expectedMetadata);
            });
        });
    });

    describe('no status change scenarios', () => {
        beforeEach(() => {
            const integration = require('../integration').integration;
            // Mock updateLiveStatus to return false (no change)
            integration.kick.channelManager.updateLiveStatus.mockReturnValue(false);
            integration.getSettings = () => ({
                triggerTwitchEvents: {
                    streamOnline: true,
                    streamOffline: true
                },
                logging: { logWebhooks: false }
            });
        });

        it('does not trigger events when status unchanged via pusher stream start', async () => {
            await expect((pusher as any).dispatchChannelEvent(pusherStreamStartEvent, pusherStreamStartPayload)).resolves.not.toThrow();
            expect(triggerEventMock).not.toHaveBeenCalled();
        });

        it('does not trigger events when status unchanged via pusher stream stop', async () => {
            await expect((pusher as any).dispatchChannelEvent(pusherStreamStopEvent, {})).resolves.not.toThrow();
            expect(triggerEventMock).not.toHaveBeenCalled();
        });

        it('does not trigger events when status unchanged via webhook stream start', async () => {
            await expect(webhookHandler.handleWebhook(webhookStreamStartPayload)).resolves.not.toThrow();
            expect(triggerEventMock).not.toHaveBeenCalled();
        });

        it('does not trigger events when status unchanged via webhook stream stop', async () => {
            await expect(webhookHandler.handleWebhook(webhookStreamStopPayload)).resolves.not.toThrow();
            expect(triggerEventMock).not.toHaveBeenCalled();
        });
    });
});
