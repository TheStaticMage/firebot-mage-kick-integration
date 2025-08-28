import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { KickFollower } from "../shared/types";

export async function handleFollowerEvent(payload: KickFollower): Promise<void> {
    // Create the user if they don't exist
    const viewer = await integration.kick.userManager.getOrCreateViewer(payload.follower, [], true);

    // Trigger the follow event
    const { eventManager } = firebot.modules;
    const metadata = {
        username: kickifyUsername(payload.follower.username),
        userId: kickifyUserId(payload.follower.userId),
        userDisplayName: viewer && viewer.displayName ? viewer.displayName : unkickifyUsername(payload.follower.username),
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "follow", metadata);

    // Trigger the Twitch follow event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.follower) {
        eventManager.triggerEvent("twitch", "follow", metadata);
    }
}
