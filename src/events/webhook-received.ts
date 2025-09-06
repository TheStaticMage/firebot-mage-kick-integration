import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { WebhookReceivedEvent } from "../shared/types";

export async function handleWebhookReceivedEvent(payload: WebhookReceivedEvent): Promise<void> {
    const broadcaster = integration.kick.broadcaster;
    let latencyMs = 0;
    if (payload.timestamp) {
        latencyMs = Date.now() - payload.timestamp.getTime();
    }

    const metadata = {
        username: kickifyUsername(broadcaster?.name || "unknown"),
        userId: kickifyUserId(broadcaster?.userId || "0"),
        userDisplayName: unkickifyUsername(broadcaster?.name || "unknown"),
        webhookType: payload.kickEventType,
        webhookVersion: payload.kickEventVersion,
        latencyMs: latencyMs,
        platform: "kick"
    };

    // Trigger the webhook received event
    const { eventManager } = firebot.modules;
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "webhook-received", metadata);
    logger.debug(`handleWebhookReceivedEvent: type=${payload.kickEventType}, version=${payload.kickEventVersion}, latency=${latencyMs}ms`);
}
