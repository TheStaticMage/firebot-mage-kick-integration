jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { getPlatformFromTrigger } from '../platform-detection';
import { IntegrationConstants } from '../../constants';

describe('getPlatformFromTrigger', () => {
    it('returns platform from eventData.platform', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: { platform: 'customPlatform' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('customPlatform');
    });

    it('returns platform from metadata.platform', () => {
        const trigger = {
            type: 'event',
            metadata: {
                platform: 'metaPlatform',
                eventData: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('metaPlatform');
    });

    it('returns "kick" if eventSource.id matches INTEGRATION_ID', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventSource: { id: IntegrationConstants.INTEGRATION_ID },
                eventData: undefined,
                platform: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns "twitch" if eventSource.id is "twitch"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventSource: { id: 'twitch' },
                eventData: undefined,
                platform: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('twitch');
    });

    it('returns "firebot" if eventSource.id is "firebot"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventSource: { id: 'firebot' },
                eventData: undefined,
                platform: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('firebot');
    });

    it('returns "kick" if chatMessage.userId starts with "k"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                chatMessage: { userId: 'k123' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns "kick" if chatMessage.username ends with "@kick"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                chatMessage: { username: 'user@kick' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns "twitch" if chatMessage has userId or username (not kick)', () => {
        const trigger = {
            type: 'event',
            metadata: {
                chatMessage: { userId: '123' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('twitch');

        const trigger2 = {
            type: 'event',
            metadata: {
                chatMessage: { username: 'user' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger2)).toBe('twitch');
    });

    it('returns "kick" if eventData.userId starts with "k"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: { userId: 'k999' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns "kick" if eventData.username ends with "@kick"', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: { username: 'someone@kick' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns "twitch" if eventData has userId or username (not kick)', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: { userId: '123' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('twitch');

        const trigger2 = {
            type: 'event',
            metadata: {
                eventData: { username: 'someone' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger2)).toBe('twitch');
    });

    it('does not have the bug fixed in PR#21', () => {
        const trigger = {
            type: 'preset',
            metadata: {
                username: "thestaticmage",
                eventSource: { id: "twitch", name: "Twitch" },
                eventData: { userId: "123456789", username: "thestaticmage" },
                chatMessage: {}
            }
        } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('twitch');

        const trigger2 = {
            type: 'event',
            metadata: {
                eventData: { username: 'someone' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(getPlatformFromTrigger(trigger2)).toBe('twitch');
    });

    it('returns "unknown" if no platform can be determined', () => {
        const trigger = { type: 'event', metadata: { eventData: undefined, platform: undefined, eventSource: undefined, chatMessage: undefined } } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('unknown');
    });

    it('returns kick for Kick events manually triggered', () => {
        const trigger = { type: 'manual', metadata: { eventData: undefined, platform: undefined, eventSource: { id: IntegrationConstants.INTEGRATION_ID }, chatMessage: undefined } } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('kick');
    });

    it('returns twitch for Twitch events manually triggered', () => {
        const trigger = { type: 'manual', metadata: { eventData: undefined, platform: undefined, eventSource: { id: 'twitch' }, chatMessage: undefined } } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('twitch');
    });

    it('returns "unknown" if trigger type is not event or manual', () => {
        const trigger = { type: 'other', metadata: { eventData: undefined, platform: undefined, eventSource: undefined, chatMessage: undefined } } as any;
        expect(getPlatformFromTrigger(trigger)).toBe('unknown');
    });

    describe('rate limiter events', () => {
        it('returns "kick" from rate limiter event with Kick chat message userId', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {
                            chatMessage: { userId: 'k123', username: 'user@kick' }
                        },
                        triggerType: 'firebot:chat-message',
                        triggerUsername: 'user@kick',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('kick');
        });

        it('returns "kick" from rate limiter event with Kick chat message username', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {
                            chatMessage: { username: 'user@kick' }
                        },
                        triggerType: 'firebot:chat-message',
                        triggerUsername: 'user@kick',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('kick');
        });

        it('returns "kick" from rate limiter event with Kick eventData userId', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {
                            userId: 'k456',
                            username: 'user@kick'
                        },
                        triggerType: 'firebot:channel-reward-redemption',
                        triggerUsername: 'user@kick',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('kick');
        });

        it('returns "kick" from rate limiter event with explicit platform', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {
                            platform: 'kick'
                        },
                        triggerType: 'firebot:chat-message',
                        triggerUsername: 'user@kick',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('kick');
        });

        it('returns "twitch" from rate limiter event with Twitch chat message', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {
                            chatMessage: { userId: '123', username: 'twitchuser' }
                        },
                        triggerType: 'firebot:chat-message',
                        triggerUsername: 'twitchuser',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('twitch');
        });

        it('returns "twitch" from rate limiter event with malformed/empty triggerMetadata but valid username', () => {
            const trigger = {
                type: 'event',
                metadata: {
                    eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                    eventData: {
                        triggerMetadata: {},
                        triggerType: 'firebot:chat-message',
                        triggerUsername: 'twitchuser',
                        bucketId: 'test-bucket',
                        bucketKey: 'user',
                        tokens: 1,
                        remaining: 0
                    }
                }
            } as any;
            expect(getPlatformFromTrigger(trigger)).toBe('twitch');
        });
    });
});
