import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { RaidSentOffEvent } from "../shared/types";

export async function handleRaidSentOffEvent(payload: RaidSentOffEvent): Promise<void> {
    logger.debug(`Handling raid sent off event (sending ${payload.numberOfViewers} viewers to ${payload.targetUser.username})`);

    const { eventManager } = firebot.modules;
    const metadata = {
        raidTargetUsername: kickifyUsername(payload.targetUser.username),
        raidTargetUserId: kickifyUserId(payload.targetUser.userId),
        raidTargetUserDisplayName: payload.targetUser.displayName ? payload.targetUser.displayName : unkickifyUsername(payload.targetUser.username),
        username: kickifyUsername(integration.kick.broadcaster?.name),
        userDisplayName: unkickifyUsername(integration.kick.broadcaster?.name),
        userId: kickifyUserId(integration.kick.broadcaster?.userId.toString()),
        viewerCount: payload.numberOfViewers,
        platform: "kick"
    };
    logger.debug(`Triggering "${IntegrationConstants.INTEGRATION_ID}:raid-sent-off" event with metadata: ${JSON.stringify(metadata)}`);
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "raid-sent-off", metadata);

    // Trigger the Twitch outgoing raid event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.raidSentOff) {
        logger.debug(`Triggering "twitch:raid-sent-off" event with metadata: ${JSON.stringify(metadata)}`);
        eventManager.triggerEvent("twitch", "raid-sent-off", metadata);
    }
}
