import { ChannelRewardRedemptionEvent } from "kick-api-types/v1";
jest.mock("path", () => ({
    join: jest.fn(() => "/virtual/channel-rewards.json")
}));

import path from "path";

const processEffectsMock = jest.fn();
const sendMock = jest.fn();
const runRestrictionPredicatesMock = jest.fn();

let managementState: Record<string, any> = {};
let channelRewardsData: Record<string, any> = {};

const JsonDbMock = jest.fn().mockImplementation(() => ({
    // No-op load; we do not touch the filesystem in tests.
    load: jest.fn(),
    // Return our in-memory rewards data rather than reading a real file.
    getData: jest.fn(() => channelRewardsData)
}));

jest.mock("../main", () => ({
    firebot: {
        modules: {
            effectRunner: { processEffects: processEffectsMock },
            frontendCommunicator: { send: sendMock },
            restrictionManager: { runRestrictionPredicates: runRestrictionPredicatesMock },
            JsonDb: JsonDbMock,
            path
        }
    },
    logger: {
        info: jest.fn(),
        debug: jest.fn(),
        error: jest.fn(),
        warn: jest.fn()
    }
}));

jest.mock("../integration-singleton", () => ({
    integration: {
        getKickRewardsState: () => ({
            getAllManagementData: () => managementState
        })
    }
}));

import { rewardRedemptionHandler } from "../internal/webhook-handler/reward-redemption-handler";

// Provide script directory constant expected by handler
(global as any).SCRIPTS_DIR = "/tmp";

describe("channel reward redemption handler (direct)", () => {
    /* eslint-disable camelcase */
    const webhookPayload: ChannelRewardRedemptionEvent = {
        eventType: "channel.reward.redemption.updated",
        eventVersion: "1",
        id: "redemption-id",
        user_input: "test message",
        status: "accepted",
        redeemed_at: "2025-12-07T03:49:10.481Z",
        reward: {
            id: "kick-reward-ulid",
            title: "Test Reward",
            cost: 100,
            description: "Test"
        },
        redeemer: {
            user_id: 123456,
            username: "TestUser",
            is_verified: false,
            profile_picture: "",
            channel_slug: "testuser"
        },
        broadcaster: {
            user_id: 789012,
            username: "Broadcaster",
            is_verified: false,
            profile_picture: "",
            channel_slug: "broadcaster"
        }
    };
    /* eslint-enable camelcase */

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();
        managementState = {
            "firebot-reward-uuid": {
                managedOnKick: true,
                kickRewardId: "kick-reward-ulid",
                firebotRewardTitle: "Test Reward",
                overrides: { enabled: true }
            }
        };
        channelRewardsData = {
            "firebot-reward-uuid": {
                id: "firebot-reward-uuid",
                twitchData: {
                    id: "firebot-reward-uuid",
                    title: "Test Reward",
                    cost: 100,
                    defaultImage: { url1x: "" }
                },
                manageable: true,
                effects: { list: [{ type: "test-effect" }] }
            }
        };
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    it("sends chat feed and processes effects for managed reward", async () => {
        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(sendMock).toHaveBeenCalledWith("twitch:chat:rewardredemption", {
            id: "redemption-id",
            queued: false,
            messageText: "test message",
            user: {
                id: "k123456",
                username: "TestUser@kick",
                displayName: "TestUser"
            },
            reward: {
                id: "firebot-reward-uuid",
                name: "Test Reward",
                cost: 100,
                imageUrl: ""
            }
        });

        expect(processEffectsMock).toHaveBeenCalledWith({
            trigger: {
                type: "channel_reward",
                metadata: expect.objectContaining({
                    username: "TestUser@kick",
                    userId: "k123456",
                    userDisplayName: "TestUser",
                    messageText: "test message",
                    args: ["test", "message"],
                    redemptionId: "redemption-id",
                    rewardId: "firebot-reward-uuid",
                    rewardName: "Test Reward",
                    rewardCost: 100,
                    platform: "kick"
                })
            },
            effects: { list: [{ type: "test-effect" }] }
        });
    });

    it("ignores unmanaged reward", async () => {
        managementState = {};
        channelRewardsData = {};

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(sendMock).not.toHaveBeenCalled();
        expect(processEffectsMock).not.toHaveBeenCalled();
    });

    it("reward redemption with Firebot reward disabled should not process effects", async () => {
        // Setup: reward exists and is managed, but disabled in Firebot
        managementState["firebot-reward-uuid"] = {
            managedOnKick: true,
            kickRewardId: "kick-reward-ulid",
            firebotRewardTitle: "Disabled Reward",
            overrides: { enabled: true }
        };

        channelRewardsData["firebot-reward-uuid"] = {
            id: "firebot-reward-uuid",
            twitchData: {
                id: "firebot-reward-uuid",
                title: "Test Reward",
                cost: 100,
                defaultImage: { url1x: "" },
                isEnabled: false,
                isPaused: false
            },
            manageable: true,
            effects: { list: [{ type: "test-effect" }] }
        };

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        // Verify effects were NOT processed
        expect(processEffectsMock).not.toHaveBeenCalled();

        // Verify warning was logged
        expect((jest.mocked(require("../main").logger)).warn).toHaveBeenCalledWith(
            expect.stringContaining("Firebot channel reward is disabled")
        );
    });

    it("reward redemption with Firebot reward paused should not process effects", async () => {
        // Setup: reward exists and is managed, but paused in Firebot
        managementState["firebot-reward-uuid"] = {
            managedOnKick: true,
            kickRewardId: "kick-reward-ulid",
            firebotRewardTitle: "Paused Reward",
            overrides: { enabled: true }
        };

        channelRewardsData["firebot-reward-uuid"] = {
            id: "firebot-reward-uuid",
            twitchData: {
                id: "firebot-reward-uuid",
                title: "Test Reward",
                cost: 100,
                defaultImage: { url1x: "" },
                isEnabled: true,
                isPaused: true
            },
            manageable: true,
            effects: { list: [{ type: "test-effect" }] }
        };

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        // Verify effects were NOT processed
        expect(processEffectsMock).not.toHaveBeenCalled();

        // Verify warning was logged
        expect((jest.mocked(require("../main").logger)).warn).toHaveBeenCalledWith(
            expect.stringContaining("Firebot channel reward is paused")
        );
    });

    it("reward redemption with integration override disabled should not process effects", async () => {
        // Setup: reward exists and Firebot state is fine, but integration override is disabled
        managementState["firebot-reward-uuid"] = {
            managedOnKick: true,
            kickRewardId: "kick-reward-ulid",
            firebotRewardTitle: "Override Disabled",
            overrides: { enabled: false }
        };

        channelRewardsData["firebot-reward-uuid"] = {
            id: "firebot-reward-uuid",
            twitchData: {
                id: "firebot-reward-uuid",
                title: "Test Reward",
                cost: 100,
                defaultImage: { url1x: "" },
                isEnabled: true,
                isPaused: false
            },
            manageable: true,
            effects: { list: [{ type: "test-effect" }] }
        };

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        // Verify effects were NOT processed
        expect(processEffectsMock).not.toHaveBeenCalled();

        // Verify debug log was called (this uses debug level, not warn)
        expect((jest.mocked(require("../main").logger)).debug).toHaveBeenCalledWith(
            expect.stringContaining("disabled reward")
        );
    });

    it("handles restriction check failures", async () => {
        channelRewardsData["firebot-reward-uuid"].restrictionData = {
            restrictions: [],
            mode: "all"
        };
        runRestrictionPredicatesMock.mockRejectedValue(["User does not meet requirements"]);

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(runRestrictionPredicatesMock).toHaveBeenCalled();
        expect(processEffectsMock).not.toHaveBeenCalled();
    });

    it("handles empty user input", async () => {
        /* eslint-disable camelcase */
        const payload = { ...webhookPayload, user_input: "" };
        /* eslint-enable camelcase */

        await rewardRedemptionHandler.handleRewardRedemptionEvent(payload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(processEffectsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({
                    metadata: expect.objectContaining({
                        messageText: "",
                        args: [""]
                    })
                })
            })
        );
    });

    it("handles multi-word user input", async () => {
        /* eslint-disable camelcase */
        const payload = { ...webhookPayload, user_input: "hello world from kick" };
        /* eslint-enable camelcase */

        await rewardRedemptionHandler.handleRewardRedemptionEvent(payload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(processEffectsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({
                    metadata: expect.objectContaining({
                        messageText: "hello world from kick",
                        args: ["hello", "world", "from", "kick"]
                    })
                })
            })
        );
    });

    it("handles user input with special characters", async () => {
        /* eslint-disable camelcase */
        const payload = { ...webhookPayload, user_input: "test@#$%^&*()" };
        /* eslint-enable camelcase */

        await rewardRedemptionHandler.handleRewardRedemptionEvent(payload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(processEffectsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({
                    metadata: expect.objectContaining({
                        messageText: "test@#$%^&*()",
                        args: ["test@#$%^&*()"]
                    })
                })
            })
        );
    });

    it("handles missing effects in reward", async () => {
        channelRewardsData["firebot-reward-uuid"] = {
            id: "firebot-reward-uuid",
            twitchData: {
                id: "firebot-reward-uuid",
                title: "Test Reward",
                cost: 100,
                defaultImage: { url1x: "" }
            },
            manageable: true
        };

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(sendMock).toHaveBeenCalled();
        expect(processEffectsMock).not.toHaveBeenCalled();
    });

    it("handles reward not found in database", async () => {
        channelRewardsData = {};

        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(sendMock).toHaveBeenCalled();
        expect(processEffectsMock).not.toHaveBeenCalled();
    });

    it("handles JsonDB getData failure", async () => {
        const JsonDbFailMock = jest.fn().mockImplementation(() => ({
            load: jest.fn(),
            getData: jest.fn(() => {
                throw new Error("Database error");
            })
        }));

        jest.resetModules();
        jest.doMock("../main", () => ({
            firebot: {
                modules: {
                    effectRunner: { processEffects: processEffectsMock },
                    frontendCommunicator: { send: sendMock },
                    restrictionManager: { runRestrictionPredicates: runRestrictionPredicatesMock },
                    JsonDb: JsonDbFailMock,
                    path
                }
            },
            logger: {
                info: jest.fn(),
                debug: jest.fn(),
                error: jest.fn(),
                warn: jest.fn()
            }
        }));

        const { rewardRedemptionHandler: failHandler } = require("../internal/webhook-handler/reward-redemption-handler");

        await failHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(sendMock).toHaveBeenCalled();
        expect(processEffectsMock).not.toHaveBeenCalled();
    });

    it("handles null user_input", async () => {
        /* eslint-disable camelcase */
        const payload = { ...webhookPayload, user_input: null } as any;
        /* eslint-enable camelcase */

        await rewardRedemptionHandler.handleRewardRedemptionEvent(payload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(processEffectsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: expect.objectContaining({
                    metadata: expect.objectContaining({
                        messageText: "",
                        args: [""]
                    })
                })
            })
        );
    });

    it("constructs correct metadata for all fields", async () => {
        await rewardRedemptionHandler.handleRewardRedemptionEvent(webhookPayload);
        jest.advanceTimersByTime(150);
        await Promise.resolve();

        expect(processEffectsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                trigger: {
                    type: "channel_reward",
                    metadata: {
                        username: "TestUser@kick",
                        userId: "k123456",
                        userDisplayName: "TestUser",
                        messageText: "test message",
                        args: ["test", "message"],
                        redemptionId: "redemption-id",
                        rewardId: "firebot-reward-uuid",
                        rewardName: "Test Reward",
                        rewardDescription: "Test",
                        rewardImage: "",
                        rewardCost: 100,
                        platform: "kick"
                    }
                }
            })
        );
    });
});
