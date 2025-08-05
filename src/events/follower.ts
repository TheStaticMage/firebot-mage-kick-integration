import { IntegrationConstants } from "../constants";
import { kickUsers } from "../internal/user";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { KickFollower, Webhook } from "../shared/types";

export async function handleFollower(webhook: Webhook): Promise<void> {
    if (!webhook.payload) {
        logger.error(`[${IntegrationConstants.INTEGRATION_ID}] No payload found in webhook for event: id=${webhook.eventMessageID}, type=${webhook.eventType}`);
        return;
    }

    const payload = webhook.payload as KickFollower;
    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Handling follower event: id=${webhook.eventMessageID}, followerUsername=${payload.follower.username}`);

    // Create the user if they don't exist
    const viewer = await kickUsers.getViewer(payload.follower);

    // Trigger the follow event
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "follow", {
            username: viewer.username,
            userId: viewer._id,
            userDisplayName: viewer.displayName,
            profilePicture: viewer.profilePicUrl
        });
    }
}
