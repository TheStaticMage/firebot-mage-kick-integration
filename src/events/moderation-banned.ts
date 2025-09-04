import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { ModerationBannedEvent } from "../shared/types";
import NodeCache from "node-cache";

export class ModerationBannedEventHandler {
    private banTimeoutCache = new NodeCache({ stdTTL: 5 * 60 });

    public async handleModerationBannedEvent(payload: ModerationBannedEvent): Promise<void> {
    // This event is triggered for bans and timeouts. The difference is that a
    // ban has no expiration time.
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

        // Since this is reported by pusher and webhook, avoid processing duplicates
        // for a while. (Set to 5 minutes to accommodate webhook delays, balanced
        // with reasonableness.) Create metadata for key computation using expiresAt
        // instead of timeoutDuration and removing the moderatorId which is not
        // correctly reported in the Pusher payload.
        const crypto = await import("crypto");
        const metadataForKey = {
            ...metadata,
            expiresAt: payload.metadata.expiresAt ? payload.metadata.expiresAt.toISOString() : undefined,
            timeoutDuration: undefined, // Remove timeoutDuration from key computation
            moderatorId: "", // Remove moderatorId from key computation because it's unreliable in Pusher
            modReason: "" // Remove modReason from key computation because it's not reported in Pusher
        };
        delete metadataForKey.timeoutDuration;

        const metadataKey = `${eventName}|${crypto.createHash("sha256").update(JSON.stringify(metadataForKey)).digest("hex")}`;
        if (this.banTimeoutCache.has(metadataKey)) {
            logger.debug(`Duplicate ${eventName} event detected (username=${metadata.username}), ignoring.`);
            return; // Duplicate event detected, ignore
        }
        this.banTimeoutCache.set(metadataKey, true);

        // Clear messages posted by the banned user from the chat feed.
        const { frontendCommunicator } = firebot.modules;
        frontendCommunicator.send("twitch:chat:user:delete-messages", kickifyUsername(payload.bannedUser.username));

        // Actually send the event.
        const { eventManager } = firebot.modules;
        eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, eventName, metadata);

        if ((eventName === "timeout" && integration.getSettings().triggerTwitchEvents.viewerTimeout) || (eventName === "banned" && integration.getSettings().triggerTwitchEvents.viewerBanned)) {
            eventManager.triggerEvent("twitch", eventName, metadata);
        }
    }
}

export const moderationBannedEventHandler = new ModerationBannedEventHandler();
