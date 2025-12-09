jest.mock("../../main", () => ({
    logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    }
}));

import { isRateLimiterEvent, getEffectiveMetadata } from "../rate-limiter-compat";

describe("rate-limiter-compat", () => {
    describe("isRateLimiterEvent", () => {
        it("returns true for rate limiter event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: {
                        triggerMetadata: { username: "user@kick" },
                        triggerType: "firebot:chat-message",
                        triggerUsername: "user@kick"
                    }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(true);
        });

        it("returns false for normal event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "twitch", name: "Twitch" },
                    eventData: { username: "user" }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(false);
        });

        it("returns false when eventSource.id is not rate-limiter", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "kick", name: "Kick" },
                    eventData: { triggerMetadata: {} }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(false);
        });

        it("returns false when trigger type is not event", () => {
            const trigger = {
                type: "manual",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: { triggerMetadata: {} }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(false);
        });

        it("returns false when triggerMetadata is missing", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: { username: "user" }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(false);
        });

        it("returns false when triggerMetadata is not an object", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: { triggerMetadata: "string" }
                }
            } as any;

            expect(isRateLimiterEvent(trigger)).toBe(false);
        });
    });

    describe("getEffectiveMetadata", () => {
        it("unwraps rate limiter event metadata correctly", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: {
                        triggerMetadata: {
                            username: "user@kick",
                            userId: "k12345",
                            chatMessage: { id: "msg123", text: "hello" }
                        },
                        triggerType: "firebot:chat-message",
                        triggerUsername: "user@kick"
                    }
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.eventData).toEqual({
                username: "user@kick",
                userId: "k12345",
                chatMessage: { id: "msg123", text: "hello" }
            });
            expect(result.chatMessage).toEqual({ id: "msg123", text: "hello" });
            expect(result.username).toBe("user@kick");
            expect(result.eventSource).toEqual({ id: "rate-limiter", name: "Rate Limiter" });
        });

        it("passes through normal event metadata unchanged", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "twitch", name: "Twitch" },
                    eventData: { username: "twitchuser", userId: "123" },
                    username: "twitchuser",
                    chatMessage: { id: "msg456", text: "world" }
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.eventData).toEqual({ username: "twitchuser", userId: "123" });
            expect(result.chatMessage).toEqual({ id: "msg456", text: "world" });
            expect(result.username).toBe("twitchuser");
            expect(result.eventSource).toEqual({ id: "twitch", name: "Twitch" });
        });

        it("handles missing eventData in normal event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "twitch", name: "Twitch" },
                    username: "user"
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.eventData).toBeUndefined();
            expect(result.username).toBe("user");
        });

        it("handles missing username in rate limiter event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: {
                        triggerMetadata: { userId: "k12345" },
                        triggerType: "firebot:chat-message",
                        triggerUsername: undefined
                    }
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.username).toBe("");
        });

        it("handles missing chatMessage in rate limiter event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: {
                        triggerMetadata: { userId: "k12345" },
                        triggerType: "firebot:chat-message",
                        triggerUsername: "user@kick"
                    }
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.chatMessage).toBeUndefined();
        });

        it("handles empty triggerMetadata in rate limiter event", () => {
            const trigger = {
                type: "event",
                metadata: {
                    eventSource: { id: "rate-limiter", name: "Rate Limiter" },
                    eventData: {
                        triggerMetadata: {},
                        triggerType: "firebot:chat-message",
                        triggerUsername: "user@kick"
                    }
                }
            } as any;

            const result = getEffectiveMetadata(trigger);

            expect(result.eventData).toEqual({});
            expect(result.chatMessage).toBeUndefined();
            expect(result.username).toBe("user@kick");
        });
    });
});
