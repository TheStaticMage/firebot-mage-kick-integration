import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { ModerationBannedEvent } from "../shared/types";

export async function handleModerationBannedEvent(payload: ModerationBannedEvent): Promise<void> {
    // This event is triggered for bans and timeouts. The difference is that a
    // ban has no expiration time.
    const { frontendCommunicator } = firebot.modules;
    frontendCommunicator.send("twitch:chat:user:delete-messages", kickifyUsername(payload.bannedUser.username));

    const eventName = payload.metadata.expiresAt ? "timeout" : "banned";
    const metadata = {
        username: kickifyUsername(payload.bannedUser.username),
        userId: kickifyUserId(payload.bannedUser.userId.toString()),
        userDisplayName: unkickifyUsername(payload.bannedUser.username),
        moderatorUsername: kickifyUsername(payload.moderator.username),
        moderatorId: kickifyUserId(payload.moderator.userId.toString()),
        moderatorDisplayName: unkickifyUsername(payload.moderator.username),
        modReason: payload.metadata.reason || "",
        moderator: unkickifyUsername(payload.moderator.username),
        timeoutDuration: payload.metadata.expiresAt ? Math.floor((payload.metadata.expiresAt.getTime() - Date.now()) / 1000) : undefined, // Convert to seconds
        platform: "kick"
    };

    const { eventManager } = firebot.modules;
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, eventName, metadata);

    if ((eventName === "timeout" && integration.getSettings().triggerTwitchEvents.viewerTimeout) || (eventName === "banned" && integration.getSettings().triggerTwitchEvents.viewerBanned)) {
        eventManager.triggerEvent("twitch", eventName, metadata);
    }
}
