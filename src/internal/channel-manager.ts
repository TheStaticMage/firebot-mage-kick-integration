import NodeCache from 'node-cache';
import { IntegrationConstants } from "../constants";
import { triggerCategoryChangedEvent, triggerTitleChangedEvent } from '../events/livestream-metadata-updated';
import { firebot, logger } from "../main";
import { CategoryInfo, Channel } from "../shared/types";
import { Kick } from "./kick";
import { kickifyUserId, kickifyUsername, unkickifyUsername } from './util';
import { parseChannel } from "./webhook-handler/webhook-parsers";

export class KickChannelManager {
    private kick: Kick;
    private categoryCache = new Map<number, CategoryInfo>();
    private channel: Channel | null = null;
    private channelCache = new NodeCache({
        stdTTL: 60, // Cache for 1 minute
        checkperiod: 60 * 30 // Evict old entries every 30 minutes
    });
    private channelRefresher: NodeJS.Timeout | null = null;
    private channelRefresherAborter = new AbortController();
    private channelRefreshInterval = 30000; // 30 seconds
    private channelWrapperCount = 0;

    constructor(kick: Kick) {
        this.kick = kick;
    }

    start(): void {
        this.channelRefresherAborter = new AbortController();
        this.startChannelRefresher();
        this.refreshChannel();
        logger.debug("Kick channel manager started.");
    }

    stop(): void {
        this.channelRefresherAborter.abort();
        this.stopChannelRefresher();
        logger.debug("Kick channel manager stopped.");
    }

    async getCategoryInfo(categoryId: number): Promise<CategoryInfo> {
        const fromCache = this.categoryCache.get(categoryId);
        if (fromCache) {
            return fromCache;
        }

        const response = await this.kick.httpCallWithTimeout(`/public/v1/categories/${categoryId}`, "GET");

        if (!response || !response.data || response.data.length !== 1) {
            logger.debug(`Failed to retrieve category from Kick API response. ${JSON.stringify(response)}`);
            throw new Error("Failed to retrieve category from Kick API.");
        }

        const result: CategoryInfo = response.data[0];
        this.categoryCache.set(categoryId, result);
        return result;
    }

    async getChannel(username: string | number = 0): Promise<Channel> {
        let cacheKey = "";
        let cacheValue: Channel | null | undefined = null;
        if (typeof username === "number" || (typeof username === "string" && username.length > 0 && !isNaN(Number(username)))) {
            const userId = Number(username);
            if (userId === 0 || userId === this.kick.broadcaster?.userId) {
                cacheKey = 'this_channel';
                cacheValue = this.channel;
            } else {
                cacheKey = `b_${userId}`;
                cacheValue = this.channelCache.get(cacheKey);
            }
        } else if (typeof username === "string") {
            if (unkickifyUsername(username).length === 0 || unkickifyUsername(username).toLowerCase() === this.channel?.slug.toLowerCase()) {
                cacheKey = 'this_channel';
                cacheValue = this.channel;
            } else {
                cacheKey = `u_${username.toLowerCase()}`;
                cacheValue = this.channelCache.get(cacheKey);
            }
        }
        if (cacheValue) {
            logger.debug(`Returning cached channel for key=${cacheKey}, username='${username}'`);
            return cacheValue;
        }

        logger.debug(`Retrieving channel for username: '${username}'`);
        try {
            const response = await this.getChannelReal(username);
            if (cacheKey === 'this_channel') {
                this.channel = response;
            } else {
                this.channelCache.set(cacheKey, response);
            }
            return response;
        } catch (error) {
            logger.error(`Error retrieving channel: ${error}`);
            throw error;
        }
    }

    private async getChannelReal(username: string | number = 0): Promise<Channel> {
        const formVariables = new URLSearchParams();
        if (typeof username === "string" && username.length > 0) {
            formVariables.append("slug", username);
        } else if (typeof username === "number" && username > 0) {
            formVariables.append("broadcaster_user_id", username.toString());
        }

        const uri = `/public/v1/channels${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
        const response = await this.kick.httpCallWithTimeout(uri, "GET", "", this.channelRefresherAborter.signal);

        logger.debug(`Successfully retrieved channel status for ${username || '(you)'}`);
        const channel = parseChannel(response);
        return channel;
    }

    private refreshChannel(): void {
        this.getChannelReal()
            .then((channelStatus: Channel) => {
                this.channel = channelStatus;
                if (this.updateCategory(channelStatus.category)) {
                    triggerCategoryChangedEvent(channelStatus.category);
                }
                if (this.updateTitle(channelStatus.streamTitle || "")) {
                    triggerTitleChangedEvent(channelStatus.streamTitle);
                }
                this.triggerChannelDataUpdatedEvent();
                logger.debug(`Channel status updated: isLive=${channelStatus.stream.isLive}, title=${channelStatus.streamTitle || ''}, category=${channelStatus.category.id}, viewers=${channelStatus.stream.viewerCount}`);
            })
            .catch((error) => {
                logger.error(`Failed to refresh channel status: ${error}`);
            });
    }

    private refreshChannelWrapper(): void {
        // Refresh less frequently if we are not live
        this.channelWrapperCount++;
        if (this.channel && !this.channel.stream.isLive && (this.channelWrapperCount % 3 !== 0)) {
            return;
        }

        this.refreshChannel();
    }

    private startChannelRefresher(): void {
        if (this.channelRefresher) {
            clearInterval(this.channelRefresher);
        }
        this.channelRefresher = setInterval(() => {
            this.refreshChannelWrapper();
        }, this.channelRefreshInterval);

        this.channelRefresherAborter = new AbortController();
        this.refreshChannel();
        logger.debug("Channel refresher started.");
    }

    private stopChannelRefresher(): void {
        if (this.channelRefresher) {
            clearInterval(this.channelRefresher);
            this.channelRefresher = null;
            logger.debug("Channel refresher stopped.");
        }
    }

    getCategory(): CategoryInfo | null {
        return this.channel ? this.channel.category : null;
    }

    updateCategory(category: CategoryInfo): boolean {
        if (!this.channel) {
            logger.debug("No channel found to update category.");
            return false;
        }

        if (category.id === 0) {
            logger.debug("Invalid category ID. Category update failed.");
            return false;
        }

        if (this.channel.category.id === category.id) {
            logger.debug(`Category is already set to id=${category.id} name=${this.channel.category.name}. No update needed.`);
            return false;
        }

        const categoryWasEmpty = this.channel.category.id === 0;
        this.channel.category = category;
        logger.debug(`Category updated to id=${category.id} name=${this.channel.category.name}.`);
        return !categoryWasEmpty;
    }

    updateTitle(title: string): boolean {
        if (!this.channel) {
            logger.debug("No channel found to update title.");
            return false;
        }

        if (!title || title.trim().length === 0) {
            logger.debug("Invalid stream title. Title cannot be empty.");
            return false;
        }

        if (title === this.channel.streamTitle) {
            logger.debug(`Title is already set to "${title}". No update needed.`);
            return false;
        }

        const titleWasEmpty = this.channel.streamTitle === '';
        this.channel.streamTitle = title;
        logger.debug(`Title ${titleWasEmpty ? 'initially set' : 'updated'} to "${title}".`);
        return !titleWasEmpty;
    }

    updateLiveStatus(isLive: boolean): boolean {
        if (!this.channel) {
            logger.debug("No channel found to update live status.");
            return false;
        }

        if (isLive === this.channel.stream.isLive) {
            logger.debug(`Live status is already set to ${isLive}. No update needed.`);
            return false;
        }

        this.channel.stream.isLive = isLive;
        logger.debug(`Live status updated to ${isLive}.`);
        return true;
    }

    triggerChannelDataUpdatedEvent(): void {
        if (!this.channel) {
            return;
        }

        const { eventManager } = firebot.modules;
        eventManager.triggerEvent(IntegrationConstants.INTEGRATION_ID, "channel-data-updated", {
            username: kickifyUsername(this.kick.broadcaster?.name || ""),
            userDisplayName: this.kick.broadcaster?.name || "",
            userId: kickifyUserId(this.kick.broadcaster?.userId || ""),
            isLive: this.channel.stream.isLive,
            title: this.channel.streamTitle || "",
            categoryId: this.channel.category.id,
            categoryName: this.channel.category.name,
            viewers: this.channel.stream.viewerCount || 0
        });
    }
}
