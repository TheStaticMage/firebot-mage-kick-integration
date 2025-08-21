import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { StreamHostedEvent } from "../shared/types";

export async function handleStreamHostedEvent(payload: StreamHostedEvent): Promise<void> {
    const userId = kickifyUserId(payload.user.userId.toString());
    const username = kickifyUsername(payload.user.username);

    // Create the user if they don't exist
    let viewer = await integration.kick.userManager.getViewerById(userId);
    if (!viewer) {
        viewer = await integration.kick.userManager.createNewViewer(payload.user, [], true);
        if (!viewer) {
            logger.warn(`Failed to create new viewer for userId=${userId}`);
        }
    }

    // Trigger the follow event
    const { eventManager } = firebot.modules;
    const metadata = {
        username: username,
        userId: userId,
        userDisplayName: viewer && viewer.displayName ? viewer.displayName : unkickifyUsername(username),
        viewerCount: payload.numberOfViewers,
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "raid", metadata);

    // Trigger the Twitch raid event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.raid) {
        eventManager.triggerEvent("twitch", "raid", metadata);
    }
}
