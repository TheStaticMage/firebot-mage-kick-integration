import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
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
    const metadata = {
        username: kickifyUsername(username),
        userId: kickifyUserId(userId),
        userDisplayName: userDisplayName || unkickifyUsername(username),
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "stream-online", metadata);

    if (integration.getSettings().triggerTwitchEvents.streamOnline) {
        eventManager.triggerEvent("twitch", "stream-online", metadata);
    }
}

function triggerStreamOffline(
    username: string,
    userId: string,
    userDisplayName: string
) {
    const { eventManager } = firebot.modules;
    const metadata = {
        username: kickifyUsername(username),
        userId: kickifyUserId(userId),
        userDisplayName: userDisplayName || unkickifyUsername(username),
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "stream-offline", metadata);

    if (integration.getSettings().triggerTwitchEvents.streamOffline) {
        eventManager.triggerEvent("twitch", "stream-offline", metadata);
    }
}
