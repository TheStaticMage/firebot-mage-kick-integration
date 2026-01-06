import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from "../internal/util";
import { firebot, logger } from "../main";
import { ChannelGiftSubscription, ChannelSubscription } from "../shared/types";
import NodeCache from "node-cache";

// Cache for deduplicating gift subscription events (12 hour TTL)
export const giftSubCache = new NodeCache({ stdTTL: 12 * 60 * 60 });

export async function handleChannelSubscriptionEvent(payload: ChannelSubscription): Promise<void> {
    const userId = kickifyUserId(payload.subscriber.userId.toString());
    const username = kickifyUsername(payload.subscriber.username);

    await integration.kick.userManager.getOrCreateViewer(payload.subscriber, [], true);
    await integration.kick.userManager.updateLastSeen(payload.subscriber.userId);
    await integration.kick.userManager.recordSubscription(
        userId,
        payload.createdAt,
        payload.expiresAt ?? plusThirtyDays(payload.createdAt)
    );

    // Trigger the subscriber event
    const { eventManager } = firebot.modules;
    const metadata = {
        username,
        userId,
        userDisplayName: payload.subscriber.displayName || unkickifyUsername(payload.subscriber.username),
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
    // Filter out duplicate gifter-giftee pairs while preserving non-duplicates
    const gifterUsername = payload.gifter.isAnonymous ? "" : payload.gifter.username.toLowerCase();
    const uniqueGiftees = payload.giftees.filter((giftee) => {
        const gifteeUsername = giftee.username.toLowerCase();
        const dedupeKey = `${gifterUsername}|${gifteeUsername}`;

        if (giftSubCache.has(dedupeKey)) {
            logger.debug(`Duplicate gift subscription pair detected (gifter=${gifterUsername}, giftee=${gifteeUsername}), skipping this pair.`);
            return false; // Skip this giftee
        }

        giftSubCache.set(dedupeKey, true);
        return true; // Keep this giftee
    });

    // If all giftees were duplicates, exit early
    if (uniqueGiftees.length === 0) {
        logger.debug(`All gift subscription pairs were duplicates, skipping entire event.`);
        return;
    }

    // Update payload to only contain unique giftees for the rest of the processing
    const processedPayload = { ...payload, giftees: uniqueGiftees };

    // Kick doesn't really have the concept of community subscriptions versus
    // normal gifted subscriptions, so we'll treat any gift of multiple
    // subscriptions as a community gift, and any gift of a single subscription
    // as a normal gift.
    if (processedPayload.gifter.isAnonymous || processedPayload.gifter.userId === '') {
        logger.debug("Skipping anonymous gifter for Kick gift subscription event.");
    } else {
        await integration.kick.userManager.getOrCreateViewer(processedPayload.gifter, [], true);
        await integration.kick.userManager.updateLastSeen(processedPayload.gifter.userId);
    }

    for (const giftee of processedPayload.giftees) {
        if (giftee.userId !== '') {
            await integration.kick.userManager.getOrCreateViewer(giftee, [], true);
            await integration.kick.userManager.updateLastSeen(giftee.userId);
            await integration.kick.userManager.recordSubscription(
                giftee.userId,
                processedPayload.createdAt,
                processedPayload.expiresAt ?? plusThirtyDays(processedPayload.createdAt)
            );
        }
        if (!processedPayload.gifter.isAnonymous && processedPayload.gifter.userId !== '') {
            await integration.kick.userManager.recordGift(
                processedPayload.gifter.userId,
                giftee.userId,
                processedPayload.createdAt,
                processedPayload.expiresAt ?? plusThirtyDays(processedPayload.createdAt)
            );
        }
    }

    // Trigger the community subs event if giftee count > 1
    const { eventManager } = firebot.modules;

    if (processedPayload.giftees.length > 1) {
        const metadata = {
            gifterUsername: processedPayload.gifter.isAnonymous ? "Anonymous" : kickifyUsername(processedPayload.gifter.username),
            gifterUserId: processedPayload.gifter.isAnonymous ? "" : kickifyUserId(processedPayload.gifter.userId.toString()),
            gifterUserDisplayName: processedPayload.gifter.isAnonymous ? "Anonymous" : processedPayload.gifter.displayName || unkickifyUsername(processedPayload.gifter.username),
            isAnonymous: processedPayload.gifter.isAnonymous,
            subCount: processedPayload.giftees.length,
            subPlan: "kickDefault", // Not a thing on Kick, so invent our own metadata consistent with Twitch
            giftReceivers: processedPayload.giftees.map(giftee => ({
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
    if (processedPayload.giftees.length === 1 || !firebot.firebot.settings.getSetting("IgnoreSubsequentSubEventsAfterCommunitySub")) {
        for (const giftee of processedPayload.giftees) {
            const metadata = {
                gifterUsername: processedPayload.gifter.isAnonymous ? "Anonymous@kick" : kickifyUsername(processedPayload.gifter.username),
                gifterUserId: processedPayload.gifter.isAnonymous ? "" : kickifyUserId(processedPayload.gifter.userId.toString()),
                gifterUserDisplayName: processedPayload.gifter.isAnonymous ? "Anonymous" : processedPayload.gifter.displayName || unkickifyUsername(processedPayload.gifter.username),
                isAnonymous: processedPayload.gifter.isAnonymous,
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

function plusThirtyDays(date: Date): Date {
    const newDate = new Date(date);
    newDate.setDate(newDate.getDate() + 30);
    return newDate;
}
