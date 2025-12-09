export const triggerEventMock = jest.fn();

jest.mock('../integration', () => ({
    integration: {
        getSettings: jest.fn(),
        kick: {
            broadcaster: {
                name: "You",
                profilePicture: "https://your-profile-pic",
                userId: 1234567890
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
import { InboundWebhook } from '../internal/webhook-handler/webhook';
import { webhookHandler } from '../internal/webhook-handler/webhook-handler';

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
        moderator: 'mod2',
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
    beforeEach(() => {
        jest.clearAllMocks();
    });

    // Webhook timeout payload - base64 encoded JSON
    const webhookTimeoutData = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498240, "username": "webhooktimeoutuser", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "webhooktimeoutuser" },
        "metadata": { "reason": "Timeout reason", "created_at": "2025-09-01T18:11:58+00:00", "expires_at": "2025-09-01T18:16:58+00:00" }
    })).toString('base64');

    const webhookTimeoutPayload: InboundWebhook = {
        kickEventMessageId: "msg-123",
        kickEventSubscriptionId: "sub-456",
        kickEventMessageTimestamp: "1693589518",
        kickEventType: "moderation.banned",
        kickEventVersion: "1",
        rawData: webhookTimeoutData
    };

    // Webhook timeout payload for disabled test - different user to avoid cache conflicts
    const webhookTimeoutDataDisabled = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498237, "username": "timeoutuser4", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "timeoutuser4" },
        "metadata": { "reason": "Timeout reason disabled", "created_at": "2025-09-01T18:11:58+00:00", "expires_at": "2025-09-01T18:16:58+00:00" }
    })).toString('base64');

    const webhookTimeoutPayloadDisabled: InboundWebhook = {
        kickEventMessageId: "msg-123-disabled",
        kickEventSubscriptionId: "sub-456-disabled",
        kickEventMessageTimestamp: "1693589519",
        kickEventType: "moderation.banned",
        kickEventVersion: "1",
        rawData: webhookTimeoutDataDisabled
    };

    // Webhook permanent ban payload - base64 encoded JSON
    const webhookBanData = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498241, "username": "webhookbanuser", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "webhookbanuser" },
        "metadata": { "reason": "Ban reason", "created_at": "2025-09-01T18:11:58+00:00" }
    })).toString('base64');

    const webhookBanPayload: InboundWebhook = {
        kickEventMessageId: "msg-789",
        kickEventSubscriptionId: "sub-101",
        kickEventMessageTimestamp: "1693589518",
        kickEventType: "moderation.banned",
        kickEventVersion: "1",
        rawData: webhookBanData
    };

    // Webhook permanent ban payload for disabled test - different user to avoid cache conflicts
    const webhookBanDataDisabled = Buffer.from(JSON.stringify({
        "broadcaster": { "user_id": 2346570, "username": "thestaticmage", "is_verified": false, "profile_picture": "pic.jpg", "channel_slug": "thestaticmage" },
        "moderator": { "user_id": 2408714, "username": "TheStaticMage", "is_verified": false, "profile_picture": "mod_pic.jpg", "channel_slug": "thestaticmage" },
        "banned_user": { "user_id": 23498238, "username": "timeoutuser5", "is_verified": false, "profile_picture": "user_pic.jpg", "channel_slug": "timeoutuser5" },
        "metadata": { "reason": "Ban reason disabled", "created_at": "2025-09-01T18:11:58+00:00" }
    })).toString('base64');

    const webhookBanPayloadDisabled: InboundWebhook = {
        kickEventMessageId: "msg-789-disabled",
        kickEventSubscriptionId: "sub-101-disabled",
        kickEventMessageTimestamp: "1693589519",
        kickEventType: "moderation.banned",
        kickEventVersion: "1",
        rawData: webhookBanDataDisabled
    };

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
                await expect(webhookHandler.handleWebhook(webhookTimeoutPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(3); // 1 integration + 1 twitch + 1 webhook-received
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
                await expect(webhookHandler.handleWebhook(webhookTimeoutPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2); // 1 integration + 1 webhook-received
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
                await expect(webhookHandler.handleWebhook(webhookBanPayload)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(3); // 1 integration + 1 twitch + 1 webhook-received
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
                await expect(webhookHandler.handleWebhook(webhookBanPayloadDisabled)).resolves.not.toThrow();
                expect(triggerEventMock).toHaveBeenCalledTimes(2); // 1 integration + 1 webhook-received
                expect(triggerEventMock).toHaveBeenCalledWith(IntegrationConstants.INTEGRATION_ID, "banned", expectedWebhookBanMetadataDisabled);
            });
        });
    });
});
