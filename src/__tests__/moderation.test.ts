export const triggerEventMock = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        getSettings: jest.fn()
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
import { handleWebhook } from '../internal/webhook-handler/webhook-handler';

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

describe('e2e moderation banned', () => {
    let pusher: KickPusher;

    beforeEach(() => {
        pusher = new KickPusher();
        jest.clearAllMocks();
    });

    // Pusher timeout payload - temporary ban with expiration
    const pusherTimeoutPayload = JSON.parse(`{"id":"0207bd89-e15c-4bf9-ba1e-129f937639a7","user":{"id":23498234,"username":"timeoutuser","slug":"timeoutuser"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":false,"duration":5,"expires_at":"2025-09-01T18:16:58+00:00"}`);
    const pusherTimeoutEvent = 'App\\Events\\UserBannedEvent';

    // Different payload for disabled test to avoid cache conflicts
    const pusherTimeoutPayloadDisabled = JSON.parse(`{"id":"0207bd89-e15c-4bf9-ba1e-129f937639a8","user":{"id":23498235,"username":"timeoutuser2","slug":"timeoutuser2"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":false,"duration":5,"expires_at":"2025-09-01T18:16:58+00:00"}`);

    // Pusher permanent ban payload - permanent ban with no expiration
    const pusherBanPayload = JSON.parse(`{"id":"517e2dcb-7637-4482-af68-1bfba32ba2a7","user":{"id":23498234,"username":"timeoutuser","slug":"timeoutuser"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":true}`);
    const pusherBanEvent = 'App\\Events\\UserBannedEvent';

    // Different payload for disabled test to avoid cache conflicts
    const pusherBanPayloadDisabled = JSON.parse(`{"id":"517e2dcb-7637-4482-af68-1bfba32ba2a8","user":{"id":23498236,"username":"timeoutuser3","slug":"timeoutuser3"},"banned_by":{"id":0,"username":"TheStaticMage","slug":"thestaticmage"},"permanent":true}`);

    // Webhook timeout payload - base64 encoded JSON
    const webhookTimeoutData = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498240, "username": "webhooktimeoutuser", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "webhooktimeoutuser" },
        "metadata": { "reason": "Timeout reason", "created_at": "2025-09-01T18:11:58+00:00", "expires_at": "2025-09-01T18:16:58+00:00" }
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookTimeoutPayload: InboundWebhook = {
        kick_event_message_id: "msg-123",
        kick_event_subscription_id: "sub-456",
        kick_event_message_timestamp: "1693589518",
        kick_event_type: "moderation.banned",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookTimeoutData
    };
    /* eslint-enable camelcase */

    // Webhook timeout payload for disabled test - different user to avoid cache conflicts
    const webhookTimeoutDataDisabled = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498237, "username": "timeoutuser4", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "timeoutuser4" },
        "metadata": { "reason": "Timeout reason disabled", "created_at": "2025-09-01T18:11:58+00:00", "expires_at": "2025-09-01T18:16:58+00:00" }
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookTimeoutPayloadDisabled: InboundWebhook = {
        kick_event_message_id: "msg-123-disabled",
        kick_event_subscription_id: "sub-456-disabled",
        kick_event_message_timestamp: "1693589519",
        kick_event_type: "moderation.banned",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookTimeoutDataDisabled
    };
    /* eslint-enable camelcase */

    // Webhook permanent ban payload - base64 encoded JSON
    const webhookBanData = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498241, "username": "webhookbanuser", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "webhookbanuser" },
        "metadata": { "reason": "Ban reason", "created_at": "2025-09-01T18:11:58+00:00" }
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookBanPayload: InboundWebhook = {
        kick_event_message_id: "msg-789",
        kick_event_subscription_id: "sub-101",
        kick_event_message_timestamp: "1693589518",
        kick_event_type: "moderation.banned",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookBanData
    };
    /* eslint-enable camelcase */

    // Webhook permanent ban payload for disabled test - different user to avoid cache conflicts
    const webhookBanDataDisabled = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498238, "username": "timeoutuser5", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "timeoutuser5" },
        "metadata": { "reason": "Ban reason disabled", "created_at": "2025-09-01T18:11:58+00:00" }
    })).toString('base64');

    /* eslint-disable camelcase */
    const webhookBanPayloadDisabled: InboundWebhook = {
        kick_event_message_id: "msg-789-disabled",
        kick_event_subscription_id: "sub-101-disabled",
        kick_event_message_timestamp: "1693589519",
        kick_event_type: "moderation.banned",
        kick_event_version: "1",
        is_test_event: false,
        raw_data: webhookBanDataDisabled
    };
    /* eslint-enable camelcase */

    describe('timeout via pusher', () => {
        const expectedTimeoutMetadata = {
            username: 'timeoutuser@kick',
            userId: 'k23498234',
            userDisplayName: 'timeoutuser',
            moderatorUsername: 'TheStaticMage@kick',
            moderatorId: 'k0',
            moderatorDisplayName: 'TheStaticMage',
            modReason: 'No reason provided',
            moderator: 'TheStaticMage',
            timeoutDuration: expect.any(Number),
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: true
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(pusherTimeoutEvent, pusherTimeoutPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "timeout", expectedTimeoutMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "timeout", expectedTimeoutMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers integration event only', async () => {
                const expectedTimeoutMetadataDisabled = {
                    username: 'timeoutuser2@kick',
                    userId: 'k23498235',
                    userDisplayName: 'timeoutuser2',
                    moderatorUsername: 'TheStaticMage@kick',
                    moderatorId: 'k0',
                    moderatorDisplayName: 'TheStaticMage',
                    modReason: 'No reason provided',
                    moderator: 'TheStaticMage',
                    timeoutDuration: expect.any(Number),
                    platform: 'kick'
                };
                await expect((pusher as any).dispatchChatroomEvent(pusherTimeoutEvent, pusherTimeoutPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "timeout", expectedTimeoutMetadataDisabled);
            });
        });
    });

    describe('permanent ban via pusher', () => {
        const expectedBanMetadata = {
            username: 'timeoutuser@kick',
            userId: 'k23498234',
            userDisplayName: 'timeoutuser',
            moderatorUsername: 'TheStaticMage@kick',
            moderatorId: 'k0',
            moderatorDisplayName: 'TheStaticMage',
            modReason: 'No reason provided',
            moderator: 'TheStaticMage',
            timeoutDuration: undefined,
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: true,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect((pusher as any).dispatchChatroomEvent(pusherBanEvent, pusherBanPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "banned", expectedBanMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "banned", expectedBanMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers integration event only', async () => {
                const expectedBanMetadataDisabled = {
                    username: 'timeoutuser3@kick',
                    userId: 'k23498236',
                    userDisplayName: 'timeoutuser3',
                    moderatorUsername: 'TheStaticMage@kick',
                    moderatorId: 'k0',
                    moderatorDisplayName: 'TheStaticMage',
                    modReason: 'No reason provided',
                    moderator: 'TheStaticMage',
                    timeoutDuration: undefined,
                    platform: 'kick'
                };
                await expect((pusher as any).dispatchChatroomEvent(pusherBanEvent, pusherBanPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "banned", expectedBanMetadataDisabled);
            });
        });
    });

    describe('timeout via webhook', () => {
        const expectedWebhookTimeoutMetadata = {
            username: 'webhooktimeoutuser@kick',
            userId: 'k23498240',
            userDisplayName: 'webhooktimeoutuser',
            moderatorUsername: 'TheStaticMage@kick',
            moderatorId: 'k2408714',
            moderatorDisplayName: 'TheStaticMage',
            modReason: 'Timeout reason',
            moderator: 'TheStaticMage',
            timeoutDuration: expect.any(Number),
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: true
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect(handleWebhook(webhookTimeoutPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "timeout", expectedWebhookTimeoutMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "timeout", expectedWebhookTimeoutMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers integration event only', async () => {
                const expectedWebhookTimeoutMetadataDisabled = {
                    username: 'timeoutuser4@kick',
                    userId: 'k23498237',
                    userDisplayName: 'timeoutuser4',
                    moderatorUsername: 'TheStaticMage@kick',
                    moderatorId: 'k2408714',
                    moderatorDisplayName: 'TheStaticMage',
                    modReason: 'Timeout reason disabled',
                    moderator: 'TheStaticMage',
                    timeoutDuration: expect.any(Number),
                    platform: 'kick'
                };
                await expect(handleWebhook(webhookTimeoutPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "timeout", expectedWebhookTimeoutMetadataDisabled);
            });
        });
    });

    describe('permanent ban via webhook', () => {
        const expectedWebhookBanMetadata = {
            username: 'webhookbanuser@kick',
            userId: 'k23498241',
            userDisplayName: 'webhookbanuser',
            moderatorUsername: 'TheStaticMage@kick',
            moderatorId: 'k2408714',
            moderatorDisplayName: 'TheStaticMage',
            modReason: 'Ban reason',
            moderator: 'TheStaticMage',
            timeoutDuration: undefined,
            platform: 'kick'
        };

        describe('twitch forwarding enabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: true,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers all expected events', async () => {
                await expect(handleWebhook(webhookBanPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "banned", expectedWebhookBanMetadata);
                expect(triggerEventMock).toHaveBeenCalledWith("twitch", "banned", expectedWebhookBanMetadata);
            });
        });

        describe('twitch forwarding disabled', () => {
            beforeEach(() => {
                const integration = require('../integration').integration;
                integration.getSettings = () => ({
                    triggerTwitchEvents: {
                        viewerBanned: false,
                        viewerTimeout: false
                    },
                    logging: { logWebhooks: false }
                });
            });

            it('triggers integration event only', async () => {
                const expectedWebhookBanMetadataDisabled = {
                    username: 'timeoutuser5@kick',
                    userId: 'k23498238',
                    userDisplayName: 'timeoutuser5',
                    moderatorUsername: 'TheStaticMage@kick',
                    moderatorId: 'k2408714',
                    moderatorDisplayName: 'TheStaticMage',
                    modReason: 'Ban reason disabled',
                    moderator: 'TheStaticMage',
                    timeoutDuration: undefined,
                    platform: 'kick'
                };
                await expect(handleWebhook(webhookBanPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(1);
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "banned", expectedWebhookBanMetadataDisabled);
            });
        });
    });
});
