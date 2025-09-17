import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { ModerationUnbannedEvent } from "../shared/types";

// This event is triggered for un-bans and un-timeouts. Firebot currently does
// not distinguish between unban and un-timeout for Twitch users so for
// consistency, we won't either.

export async function handleModerationUnbannedEvent(payload: ModerationUnbannedEvent): Promise<void> {
    const metadata = {
        username: kickifyUsername(payload.user.username),
        userId: kickifyUserId(payload.user.userId.toString()),
        userDisplayName: payload.user.displayName || unkickifyUsername(payload.user.username),
        moderatorUsername: kickifyUsername(payload.moderator.username),
        moderatorId: kickifyUserId(payload.moderator.userId.toString()),
        moderatorDisplayName: payload.moderator.displayName || unkickifyUsername(payload.moderator.username),
        moderator: unkickifyUsername(payload.moderator.username),
        banType: payload.banType,
        platform: "kick"
    };

    const { eventManager } = firebot.modules;
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "unbanned", metadata);
    if (integration.getSettings().triggerTwitchEvents.viewerUnbanned) {
        eventManager.triggerEvent("twitch", "unbanned", metadata);
    }
}
