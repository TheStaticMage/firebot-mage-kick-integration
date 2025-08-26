import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { firebot } from "../main";
import { CategoryInfo, LivestreamMetadataUpdated } from "../shared/types";

export function triggerCategoryChangedEvent(category: CategoryInfo): void {
    const { eventManager } = firebot.modules;
    const metadata = {
        category: category.name,
        categoryId: category.id,
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "category-changed", metadata);

    // Not triggering the Twitch category changed event because the category
    // names and IDs do not match between the platforms.
}

export function triggerTitleChangedEvent(title: string): void {
    const { eventManager } = firebot.modules;
    const metadata = {
        title: title,
        platform: "kick"
    };
    eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "title-changed", metadata);

    // Trigger the Twitch title changed event if enabled via the integration settings
    if (integration.getSettings().triggerTwitchEvents.titleChanged) {
        eventManager.triggerEvent("twitch", "title-changed", metadata);
    }
}

export async function handleLivestreamMetadataUpdatedEvent(event: LivestreamMetadataUpdated): Promise<void> {
    const titleUpdated = integration.kick.channelManager.updateTitle(event.metadata.title);
    if (titleUpdated) {
        triggerTitleChangedEvent(event.metadata.title);
    }
    const categoryUpdated = integration.kick.channelManager.updateCategory(event.metadata.category);
    if (categoryUpdated) {
        triggerCategoryChangedEvent(event.metadata.category);
    }
    if (titleUpdated || categoryUpdated) {
        integration.kick.channelManager.triggerChannelDataUpdatedEvent();
    }
}
