import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { StreamHostedEvent } from "../shared/types";

export async function handleStreamHostedEvent(payload: StreamHostedEvent): Promise<void> {
    const userId = kickifyUserId(payload.user.userId.toString());
    const username = kickifyUsername(payload.user.username);
    logger.debug(`Handling stream hosted event for userId=${userId}, username=${username}, numberOfViewers=${payload.numberOfViewers}`);

    // Create the user if they don't exist
    const viewer = await integration.kick.userManager.getOrCreateViewer(payload.user, [], true);

    // Trigger the raid/host event
    const { eventManager } = firebot.modules;
    const metadata = {
        username: username,
        userId: userId,
        userDisplayName: viewer?.displayName || unkickifyUsername(username),
        viewerCount: payload.numberOfViewers,
        platform: "kick"
    };
    logger.debug(`Triggering "${IntegrationConstants.INTEGRATION_ID}:raid" event with metadata: ${JSON.stringify(metadata)}`);
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "raid", metadata);

    // Trigger the Twitch raid event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.raid) {
        logger.debug(`Triggering "twitch:raid" event with metadata: ${JSON.stringify(metadata)}`);
        eventManager.triggerEvent("twitch", "raid", metadata);
    }
}
