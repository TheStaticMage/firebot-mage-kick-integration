import { integration } from "../integration";
import { kickifyUserId, kickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { LivestreamStatusUpdated } from "../shared/types";

export async function handleLivestreamStatusUpdatedEvent(payload: LivestreamStatusUpdated): Promise<void> {
    const update = integration.kick.channelManager.updateLiveStatus(payload.isLive);
    const userId = kickifyUserId(payload.broadcaster.userId.toString());
    const username = kickifyUsername(payload.broadcaster.username);
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
