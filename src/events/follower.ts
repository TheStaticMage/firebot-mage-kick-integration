import { integration } from "../integration";
import { firebot } from "../main";
import { KickFollower } from "../shared/types";

export async function handleFollowerEvent(payload: KickFollower): Promise<void> {
    // Create the user if they don't exist
    const viewer = await integration.kick.userManager.getViewer(payload.follower);

    // Trigger the follow event
    const { eventManager } = firebot.modules;
    for (const source of integration.getEventSources()) {
        eventManager.triggerEvent(source, "follow", {
            username: viewer.username,
            userId: viewer._id,
            userDisplayName: viewer.displayName,
            profilePicture: viewer.profilePicUrl
        });
    }
}
