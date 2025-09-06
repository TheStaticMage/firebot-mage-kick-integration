import { FirebotChatHelpers } from "../chat-message-sent";
import { KickIdentity } from "../../shared/types";

describe('FirebotChatHelpers', () => {
    let helpers: FirebotChatHelpers;

    beforeEach(() => {
        helpers = new FirebotChatHelpers();
    });

    describe('getTwitchRoles', () => {
        it('returns broadcaster role for broadcaster badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster"]);
        });

        it('returns mod role for moderator badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Moderator", type: "moderator" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["mod"]);
        });

        it('returns vip role for vip badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["vip"]);
        });

        it('returns sub and tier1 roles for subscriber badge', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Subscriber", type: "subscriber" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["sub", "tier1"]);
        });

        it('returns empty array for og badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "OG", type: "og" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns empty array for founder badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Founder", type: "founder" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns empty array for sub_gifter badge (no twitch equivalent)', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Sub Gifter", type: "sub_gifter" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('returns multiple roles for multiple badges', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" },
                    { text: "Subscriber", type: "subscriber" },
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster", "sub", "tier1", "vip"]);
        });

        it('deduplicates roles when multiple badges map to same role', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Subscriber", type: "subscriber" },
                    { text: "Subscriber", type: "subscriber" } // Duplicate subscriber badge
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["sub", "tier1"]);
        });

        it('returns empty array for unknown badge types', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Unknown", type: "unknown_badge_type" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('handles mixed known and unknown badge types', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: [
                    { text: "Broadcaster", type: "broadcaster" },
                    { text: "Unknown", type: "unknown_badge_type" },
                    { text: "VIP", type: "vip" }
                ]
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual(["broadcaster", "vip"]);
        });

        it('returns empty array for empty badges array', () => {
            const identity: KickIdentity = {
                usernameColor: "#000000",
                badges: []
            };

            const result = helpers.getTwitchRoles(identity);
            expect(result).toEqual([]);
        });

        it('throws error when identity is null', () => {
            expect(() => {
                helpers.getTwitchRoles(null as any);
            }).toThrow();
        });

        it('throws error when identity is undefined', () => {
            expect(() => {
                helpers.getTwitchRoles(undefined as any);
            }).toThrow();
        });

        it('throws error when identity.badges is null', () => {
            const identity = {
                usernameColor: "#000000",
                badges: null as any
            };

            expect(() => {
                helpers.getTwitchRoles(identity);
            }).toThrow();
        });

        it('throws error when identity.badges is undefined', () => {
            const identity = {
                usernameColor: "#000000",
                badges: undefined as any
            };

            expect(() => {
                helpers.getTwitchRoles(identity);
            }).toThrow();
        });
    });
});
