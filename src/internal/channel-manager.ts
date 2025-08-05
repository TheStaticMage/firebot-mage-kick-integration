import * as NodeCache from 'node-cache';
import { IntegrationConstants } from "../constants";
import { logger } from "../main";
import { CategoryInfo, Channel } from "../shared/types";
import { Kick } from "./kick";
import { parseChannel } from "./parser/parser";

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
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick channel manager started.`);
    }

    stop(): void {
        this.channelRefresherAborter.abort();
        this.stopChannelRefresher();
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Kick channel manager stopped.`);
    }

    async getCategory(categoryId: number): Promise<CategoryInfo> {
        return new Promise((resolve, reject) => {
            const fromCache = this.categoryCache.get(categoryId);
            if (fromCache) {
                resolve(fromCache);
            }

            this.kick.httpCallWithTimeout(`/public/v1/categories/${categoryId}`, "GET")
                .then((response) => {
                    if (!response || !response.data || response.data.length !== 1) {
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Failed to retrieve category from Kick API response. ${JSON.stringify(response)}`);
                        reject(new Error("Failed to retrieve category from Kick API."));
                    }

                    const result: CategoryInfo = response.data[0];
                    this.categoryCache.set(categoryId, result);
                    resolve(result);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    async getChannel(username: string | number = 0): Promise<Channel> {
        return new Promise((resolve, reject) => {
            const formVariables = new URLSearchParams();
            let cacheKey = "";

            if (typeof username === "string" && username.length > 0) {
                formVariables.append("slug", username);
                cacheKey = `u_${username.toLowerCase()}`;
            } else if (typeof username === "number" && username > 0) {
                formVariables.append("broadcaster_user_id", username.toString());
                cacheKey = `b_${username.toString()}`;
            }

            if (cacheKey) {
                const cachedChannel = this.channelCache.get(cacheKey);
                if (cachedChannel) {
                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Returning cached channel for key: ${cacheKey}`);
                    resolve(cachedChannel as Channel);
                    return;
                }
            }

            const uri = `/public/v1/channels${formVariables.toString().length > 0 ? `?${formVariables.toString()}` : ''}`;
            this.kick.httpCallWithTimeout(uri, "GET", "", this.channelRefresherAborter.signal)
                .then((response) => {
                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Successfully retrieved channel status for ${username || '(you)'}`);
                    const channel = parseChannel(response);
                    if (cacheKey) {
                        this.channelCache.set(cacheKey, channel);
                    } else {
                        this.channel = channel;
                    }
                    resolve(channel);
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }

    private refreshChannel(): void {
        this.getChannel()
            .then((channelStatus: Channel) => {
                this.channel = channelStatus;
                logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Channel status updated: isLive=${channelStatus.stream.isLive}, title=${channelStatus.streamTitle || ''}, category=${channelStatus.category.id}, viewers=${channelStatus.stream.viewerCount}`);
            })
            .catch((error) => {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to refresh channel status: ${error}`);
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
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Channel refresher started.`);
    }

    private stopChannelRefresher(): void {
        if (this.channelRefresher) {
            clearInterval(this.channelRefresher);
            this.channelRefresher = null;
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Channel refresher stopped.`);
        }
    }

    async updateCategory(categoryId: number): Promise<boolean> {
        if (!this.channel) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No channel found to update category.`);
            return false;
        }

        try {
            this.channel.category = await this.getCategory(categoryId);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Failed to update channel category: ${error}`);
            return false;
        }

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Category updated to id=${categoryId} name=${this.channel.category.name}.`);
        return true;
    }

    updateTitle(title: string): boolean {
        if (!this.channel) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No channel found to update title.`);
            return false;
        }

        if (!title || title.trim().length === 0) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Invalid stream title. Title cannot be empty.`);
            return false;
        }

        if (title === this.channel.streamTitle) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Title is already set to "${title}". No update needed.`);
            return false;
        }

        this.channel.streamTitle = title;
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Title updated to "${title}".`);
        return true;
    }

    updateLiveStatus(isLive: boolean): boolean {
        if (!this.channel) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No channel found to update live status.`);
            return false;
        }

        if (isLive === this.channel.stream.isLive) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Live status is already set to ${isLive}. No update needed.`);
            return false;
        }

        this.channel.stream.isLive = isLive;
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Live status updated to ${isLive}.`);
        return true;
    }
}
