import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot, logger } from "../main";
import { LivestreamStatusUpdated, Webhook } from "../shared/types";
import { KickUsers } from "../internal/user";

export async function handleLivestreamStatusUpdated(webhook: Webhook): Promise<void> {
    if (!webhook.payload) {
        logger.error(`[${IntegrationConstants.INTEGRATION_ID}] No payload found in webhook for event: id=${webhook.eventMessageID}, type=${webhook.eventType}`);
        return;
    }
    const payload = webhook.payload as LivestreamStatusUpdated;
    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Handling livestream status updated event: id=${webhook.eventMessageID}, isLive=${payload.isLive}, title=${payload.title}`);

    const update = integration.kick.channelManager.updateLiveStatus(payload.isLive);
    const userId = KickUsers.kickifyUserId(payload.broadcaster.userId.toString());
    const username = KickUsers.kickifyUsername(payload.broadcaster.username);
    const displayName = payload.broadcaster.username; // Kick does not have display names
    if (update) {
        if (payload.isLive) {
            triggerStreamOnline(username, userId, displayName);
        } else {
            triggerStreamOffline(username, userId, displayName);
        }
    }
}

function triggerStreamOnline(
    username: string,
    userId: string,
    userDisplayName: string
) {
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "stream-online", {
            username: `${username}@kick`,
            userId: `k${userId}`,
            userDisplayName
        });
    }
}

function triggerStreamOffline(
    username: string,
    userId: string,
    userDisplayName: string
) {
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "stream-offline", {
            username: `${username}@kick`,
            userId: `k${userId}`,
            userDisplayName
        });
    }
}
