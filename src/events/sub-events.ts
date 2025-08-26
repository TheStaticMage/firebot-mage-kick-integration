import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { ChannelSubscription, ChannelGiftSubscription } from "../shared/types";

export async function handleChannelSubscriptionEvent(payload: ChannelSubscription): Promise<void> {
    const userId = kickifyUserId(payload.subscriber.userId.toString());
    const username = kickifyUsername(payload.subscriber.username);

    // Create the user if they don't exist
    let viewer = await integration.kick.userManager.getViewerById(userId);
    if (!viewer) {
        viewer = await integration.kick.userManager.createNewViewer(payload.subscriber, [], true);
        if (!viewer) {
            logger.warn(`Failed to create new viewer for userId=${userId}`);
        }
    }

    // Trigger the subscriber event
    const { eventManager } = firebot.modules;
    const metadata = {
        username,
        userId,
        userDisplayName: viewer && viewer.displayName ? viewer.displayName : unkickifyUsername(username),
        subPlan: "kickDefault", // Not a thing on Kick, so invent our own metadata consistent with Twitch
        totalMonths: payload.duration || 1,
        subMessage: "", // Not set on Kick
        streak: payload.duration || 1, // Not set on Kick
        isPrime: false, // Does not exist on Kick
        isResub: payload.isResub,
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "sub", metadata);

    // Trigger the equivalent Twitch event if enabled
    if (integration.getSettings().triggerTwitchEvents.sub) {
        eventManager.triggerEvent("twitch", "sub", metadata);
    }
}

export async function handleChannelSubscriptionGiftsEvent(payload: ChannelGiftSubscription): Promise<void> {
    // Kick doesn't really have the concept of community subscriptions versus
    // normal gifted subscriptions, so we'll treat any gift of multiple
    // subscriptions as a community gift, and any gift of a single subscription
    // as a normal gift.
    if (payload.gifter.isAnonymous) {
        logger.debug("Skipping anonymous gifter for Kick gift subscription event.");
    } else {
        // Create the gifter user if they don't exist
        const gifterId = kickifyUserId(payload.gifter.userId.toString());
        let viewer = await integration.kick.userManager.getViewerById(gifterId);
        if (!viewer) {
            viewer = await integration.kick.userManager.createNewViewer(payload.gifter, [], true);
            if (!viewer) {
                logger.warn(`Failed to create new viewer for gifter: userId=${gifterId}`);
            }
        }
    }

    // Create each giftee user if they don't exist
    for (const giftee of payload.giftees) {
        const gifteeId = kickifyUserId(giftee.userId.toString());
        let viewer = await integration.kick.userManager.getViewerById(gifteeId);
        if (!viewer) {
            viewer = await integration.kick.userManager.createNewViewer(giftee, [], true);
            if (!viewer) {
                logger.warn(`Failed to create new viewer for giftee: userId=${gifteeId}`);
            }
        }
    }

    // Trigger the community subs event if giftee count > 1
    const { eventManager } = firebot.modules;

    if (payload.giftees.length > 1) {
        const metadata = {
            gifterUsername: payload.gifter.isAnonymous ? "Anonymous" : kickifyUsername(payload.gifter.username),
            gifterUserId: payload.gifter.isAnonymous ? "" : kickifyUserId(payload.gifter.userId.toString()),
            gifterUserDisplayName: payload.gifter.isAnonymous ? "Anonymous" : payload.gifter.displayName || unkickifyUsername(payload.gifter.username),
            isAnonymous: payload.gifter.isAnonymous,
            subCount: payload.giftees.length,
            subPlan: "kickDefault", // Not a thing on Kick, so invent our own metadata consistent with Twitch
            giftReceivers: payload.giftees.map(giftee => ({
                gifteeUsername: kickifyUsername(giftee.username),
                gifteeUserId: kickifyUserId(giftee.userId.toString()),
                gifteeUserDisplayName: giftee.displayName || unkickifyUsername(giftee.username),
                giftSubMonths: 1
            })),
            platform: "kick"
        };
        eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "community-subs-gifted", metadata);
    }

    // Trigger individual gift events for each sub, except skip this if the
    // option to ignore subsequent Gift Sub events after a Community Gift Sub
    // event is enabled.
    if (payload.giftees.length === 1 || !firebot.firebot.settings.getSetting("IgnoreSubsequentSubEventsAfterCommunitySub")) {
        for (const giftee of payload.giftees) {
            const metadata = {
                gifterUsername: payload.gifter.isAnonymous ? "Anonymous" : kickifyUsername(payload.gifter.username),
                gifterUserId: payload.gifter.isAnonymous ? "" : kickifyUserId(payload.gifter.userId.toString()),
                gifterUserDisplayName: payload.gifter.isAnonymous ? "Anonymous" : payload.gifter.displayName || unkickifyUsername(payload.gifter.username),
                isAnonymous: payload.gifter.isAnonymous,
                subPlan: "kickDefault", // Not a thing on Kick, so invent our own metadata consistent with Twitch
                giftSubMonths: 1,
                giftSubDuration: 1,
                gifteeUsername: kickifyUsername(giftee.username),
                gifteeUserId: kickifyUserId(giftee.userId.toString()),
                gifteeUserDisplayName: giftee.displayName || unkickifyUsername(giftee.username),
                platform: "kick"
            };
            eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "subs-gifted", metadata);

            // Trigger the equivalent Twitch event if enabled
            if (integration.getSettings().triggerTwitchEvents.subGift) {
                eventManager.triggerEvent("twitch", "subs-gifted", metadata);
            }
        }
    }
}
