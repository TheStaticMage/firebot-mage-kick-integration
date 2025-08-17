import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { KickFollower } from "../shared/types";

export async function handleFollowerEvent(payload: KickFollower): Promise<void> {
    // Create the user if they don't exist
    let viewer = await integration.kick.userManager.getViewerById(payload.follower.userId);
    if (!viewer) {
        viewer = await integration.kick.userManager.createNewViewer(payload.follower, [], true);
        if (!viewer) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to create new viewer for userId=${payload.follower.userId}`);
            return;
        }
    }

    // Trigger the follow event
    const { eventManager } = firebot.modules;
    const metadata = {
        username: viewer.username,
        userId: viewer._id,
        userDisplayName: viewer.displayName,
        profilePicture: viewer.profilePicUrl,
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "follow", metadata);

    // Trigger the Twitch follow event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.follower) {
        eventManager.triggerEvent("twitch", "follow", metadata);
    }
}
