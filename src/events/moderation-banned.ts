import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { KickUsers } from "../internal/user";
import { firebot, logger } from "../main";
import { ModerationBannedEvent, Webhook } from "../shared/types";

export async function handleModerationBanned(webhook: Webhook): Promise<void> {
    if (!webhook.payload) {
        logger.error(`[${IntegrationConstants.INTEGRATION_ID}] No payload found in webhook for event: id=${webhook.eventMessageID}, type=${webhook.eventType}`);
        return;
    }
    const payload = webhook.payload as ModerationBannedEvent;
    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Handling moderation banned event: id=${webhook.eventMessageID}, bannedUser=${payload.bannedUser.username}`);

    const { frontendCommunicator } = firebot.modules;
    frontendCommunicator.send("twitch:chat:user:delete-messages", KickUsers.kickifyUsername(payload.bannedUser.username));

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
            username: KickUsers.kickifyUsername(username),
            userId: KickUsers.kickifyUserId(userId),
            userDisplayName,
            moderatorUsername: KickUsers.kickifyUsername(moderatorUsername),
            moderatorId: KickUsers.kickifyUserId(moderatorId),
            moderatorDisplayName,
            modReason,
            expiresAt, // Note: Twitch event handler does not set this metadata
            moderator: moderatorDisplayName // For compatibility with Twitch `$moderator` variable
        });
    }
}
