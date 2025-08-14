import { integration } from "../integration";
import { kickifyUserId, kickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { ModerationBannedEvent } from "../shared/types";

export async function handleModerationBannedEvent(payload: ModerationBannedEvent): Promise<void> {
    // This event is triggered for bans and timeouts. The difference is that a
    // ban has no expiration time.
    const { frontendCommunicator } = firebot.modules;
    frontendCommunicator.send("twitch:chat:user:delete-messages", kickifyUsername(payload.bannedUser.username));

    if (payload.metadata.expiresAt) {
        // If there is an expiration time, this is a timeout, not a ban.
        triggerTimedOut(
            payload.bannedUser.username,
            payload.bannedUser.userId.toString(),
            payload.bannedUser.username, // Kick does not have display names
            payload.moderator.username,
            payload.moderator.userId.toString(),
            payload.moderator.username, // Kick does not have display names
            payload.metadata.reason || "",
            payload.metadata.expiresAt
        );
        return;
    }

    triggerBanned(
        payload.bannedUser.username,
        payload.bannedUser.userId.toString(),
        payload.bannedUser.username, // Kick does not have display names
        payload.moderator.username,
        payload.moderator.userId.toString(),
        payload.moderator.username, // Kick does not have display names
        payload.metadata.reason || ""
    );
}

function triggerBanned(
    username: string,
    userId: string,
    userDisplayName: string,
    moderatorUsername: string,
    moderatorId: string,
    moderatorDisplayName: string,
    modReason: string
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
            moderator: moderatorDisplayName // For compatibility with Twitch `$moderator` variable
        });
    }
}

function triggerTimedOut(
    username: string,
    userId: string,
    userDisplayName: string,
    moderatorUsername: string,
    moderatorId: string,
    moderatorDisplayName: string,
    modReason: string,
    expiresAt: Date
): void {
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "timeout", {
            username: kickifyUsername(username),
            userId: kickifyUserId(userId),
            userDisplayName,
            moderatorUsername: kickifyUsername(moderatorUsername),
            moderatorId: kickifyUserId(moderatorId),
            moderatorDisplayName,
            modReason,
            timeoutDuration: Math.floor((expiresAt.getTime() - Date.now()) / 1000), // Convert to seconds
            moderator: moderatorDisplayName // For compatibility with Twitch `$moderator` variable
        });
    }
}
