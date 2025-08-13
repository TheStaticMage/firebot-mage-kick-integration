import { integration } from "../integration";
import { kickifyUserId, kickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { ModerationBannedEvent } from "../shared/types";

export async function handleModerationBannedEvent(payload: ModerationBannedEvent): Promise<void> {
    const { frontendCommunicator } = firebot.modules;
    frontendCommunicator.send("twitch:chat:user:delete-messages", kickifyUsername(payload.bannedUser.username));

    triggerBanned(
        payload.bannedUser.username,
        payload.bannedUser.userId.toString(),
        payload.bannedUser.username, // Kick does not have display names
        payload.moderator.username,
        payload.moderator.userId.toString(),
        payload.moderator.username, // Kick does not have display names
        payload.metadata.reason || "",
        payload.metadata.expiresAt // Note: Twitch event handler does not set this metadata
    );
}

function triggerBanned(
    username: string,
    userId: string,
    userDisplayName: string,
    moderatorUsername: string,
    moderatorId: string,
    moderatorDisplayName: string,
    modReason: string,
    expiresAt: Date | undefined
): void {
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "banned", {
            username: kickifyUsername(username),
            userId: kickifyUserId(userId),
            userDisplayName,
            moderatorUsername: kickifyUsername(moderatorUsername),
            moderatorId: kickifyUserId(moderatorId),
            moderatorDisplayName,
            modReason,
            expiresAt, // Note: Twitch event handler does not set this metadata
            moderator: moderatorDisplayName // For compatibility with Twitch `$moderator` variable
        });
    }
}
