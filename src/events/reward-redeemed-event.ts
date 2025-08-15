import * as crypto from 'crypto';
import { IntegrationConstants } from "../constants";
import { kickifyUserId, kickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { RewardRedeemedEvent } from "../shared/types";

export async function handleRewardRedeemedEvent(payload: RewardRedeemedEvent): Promise<void> {
    const redemptionId = crypto.randomUUID(); // Generate a unique ID for the redemption
    const rewardId = crypto.createHash('sha256').update(payload.rewardTitle).digest('hex');

    const { frontendCommunicator } = firebot.modules;
    frontendCommunicator.send("twitch:chat:rewardredemption", {
        id: redemptionId,
        queued: false,
        messageText: payload.userInput,
        user: {
            id: kickifyUserId(payload.userId),
            username: kickifyUsername(payload.username),
            displayName: payload.username
        },
        reward: {
            id: rewardId, // Simulate a reward ID based on the title
            name: payload.rewardTitle,
            cost: 0, // Cost is not provided in the event
            imageUrl: "" // Image URL is not provided in the event
        }
    });

    // This event is so different from Twitch's reward redeemed event that we
    // cannot use the same function.
    const { eventManager } = firebot.modules;
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "channel-reward-redemption", {
        username: kickifyUsername(payload.username),
        userId: kickifyUserId(payload.userId),
        userDisplayName: payload.username,
        messageText: payload.userInput,
        args: (payload.userInput || "").split(" "),
        rewardId: rewardId,
        rewardImage: "",
        rewardName: payload.rewardTitle,
        rewardDescription: payload.rewardTitle, // No description provided
        rewardCost: 0, // No cost provided
        rewardBackgroundColor: payload.rewardBackgroundColor || "#FFFFFF" // Default to white if not provided
    });
}
