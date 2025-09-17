import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot } from "../main";
import { KicksGiftedEvent } from "../shared/types";

class KicksHandler {
    async handleKicksGiftedEvent(payload: KicksGiftedEvent): Promise<void> {
        this.triggerKicksGiftedEvent(payload);
    }

    private triggerKicksGiftedEvent(data: KicksGiftedEvent): void {
        const { eventManager } = firebot.modules;
        const metadata = {
            userId: kickifyUserId(data.gifter.userId),
            username: kickifyUsername(data.gifter.username),
            userDisplayName: data.gifter.displayName || unkickifyUsername(data.gifter.username),
            amount: data.kicks,
            bits: data.kicks, // Map to bits for Twitch compatibility
            cheerMessage: data.message,
            giftId: data.giftId,
            giftName: data.giftName,
            giftType: data.giftType,
            giftTier: data.giftTier,
            characterLimit: data.characterLimit,
            pinnedTime: data.pinnedTime,
            platform: "kick"
        };
        eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "kicks-gifted", metadata);

        if (integration.getSettings().triggerTwitchEvents.cheer) {
            eventManager.triggerEvent("twitch", "cheer", metadata);
        }
    }
}

export const kicksHandler = new KicksHandler();
