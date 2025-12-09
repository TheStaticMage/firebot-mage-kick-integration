jest.mock('../../main', () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { platformVariable } from '../platform';

describe('platformVariable', () => {
    it('delegates to getPlatformFromTrigger utility', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: { platform: 'customPlatform' },
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('customPlatform');
    });

    it('returns kick for Kick events', () => {
        const trigger = {
            type: 'event',
            metadata: {
                chatMessage: { userId: 'k123' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('kick');
    });

    it('returns twitch for Twitch events', () => {
        const trigger = {
            type: 'event',
            metadata: {
                chatMessage: { userId: '123' },
                eventData: undefined,
                platform: undefined,
                eventSource: undefined
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('twitch');
    });

    it('returns unknown when platform cannot be determined', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventData: undefined,
                platform: undefined,
                eventSource: undefined,
                chatMessage: undefined
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('unknown');
    });

    it('handles rate limiter events with Kick metadata', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                eventData: {
                    triggerMetadata: {
                        chatMessage: { userId: 'k123', username: 'user@kick' }
                    },
                    triggerType: 'firebot:chat-message',
                    triggerUsername: 'user@kick'
                }
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('kick');
    });

    it('handles rate limiter events with Twitch metadata', () => {
        const trigger = {
            type: 'event',
            metadata: {
                eventSource: { id: 'rate-limiter', name: 'Rate Limiter' },
                eventData: {
                    triggerMetadata: {
                        chatMessage: { userId: '123', username: 'twitchuser' }
                    },
                    triggerType: 'firebot:chat-message',
                    triggerUsername: 'twitchuser'
                }
            }
        } as any;
        expect(platformVariable.evaluator(trigger)).toBe('twitch');
    });
});
