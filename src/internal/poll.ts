import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger, scriptVersion } from "../main";
import { HttpCallRequest, httpCallWithTimeout } from "./http";
import { handleWebhook } from "./webhook-handler/webhook-handler";

export class Poller {
    private isConnected = false;
    private isDisconnecting = false;
    private pollAborter = new AbortController();
    private pollTimeout: NodeJS.Timeout | null = null;
    private proxyPollKey = "";
    private proxyPollUrl = "";
    private instanceId = "";
    private isPolling = false;

    async connect(proxyPollKey: string): Promise<void> {
        if (this.isDisconnecting || this.isConnected) {
            logger.warn(`Called connect() in a weird state: isDisconnecting=${this.isDisconnecting}, isConnected=${this.isConnected}.`);
            integration.sendCriticalErrorNotification(`The webhook proxy poller has become confused. Please reconnect the Kick integration from the Connections dialog.`);
            return;
        }

        const proxyPollUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/+$/, "");
        if (!proxyPollUrl) {
            logger.debug("Cannot start poller: Missing proxy poll URL.");
            return;
        }
        if (!proxyPollKey) {
            logger.error("Cannot start poller: Missing proxy poll key.");
            integration.sendCriticalErrorNotification(`Failed to start the proxy poller. You probably need to re-authorize the streamer account in Settings > Integrations > ${IntegrationConstants.INTEGRATION_NAME}.`);
            return;
        }

        this.proxyPollKey = proxyPollKey;
        this.proxyPollUrl = `${proxyPollUrl}/poll`;
        this.pollAborter = new AbortController();
        this.instanceId = crypto.randomUUID();

        const started = this.startPoller();
        if (!started) {
            logger.warn("Failed to start poller.");
            await this.disconnect(proxyPollKey);
            return;
        }

        logger.debug(`Poller connected with proxy poll key: ${this.proxyPollKey}`);
        this.isConnected = true;
    }

    async disconnect(proxyPollKey = ''): Promise<void> {
        // This is to let the proxy know the poller is no longer active. It will
        // help make things cleaner on the server side in case of a reconnect.
        this.isDisconnecting = true;
        if (this.proxyPollUrl && (proxyPollKey || this.proxyPollKey)) {
            logger.debug(`Disconnecting proxy poller with key: ${proxyPollKey || this.proxyPollKey}`);
            const url = `${this.proxyPollUrl}/${proxyPollKey || this.proxyPollKey}`;
            const req: HttpCallRequest = {
                url,
                method: "DELETE"
            };
            try {
                await httpCallWithTimeout(req);
                logger.info("Successfully disconnected proxy poller.");
            } catch (error) {
                logger.error(`Error disconnecting proxy poller: ${error}`);
            }
        }

        logger.debug("Aborting any in-progress pollers...");
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = null;
        }
        this.pollAborter.abort();

        logger.debug("Poller disconnected.");
        this.isDisconnecting = false;
        this.isConnected = false;
    }

    setProxyPollKey(proxyPollKey: string): void {
        this.proxyPollKey = proxyPollKey;
    }

    setProxyPollUrl(proxyPollUrl: string): void {
        this.proxyPollUrl = proxyPollUrl;
    }

    private startPoller(): boolean {
        // If the proxy key is not set there's no point in starting the poller.
        if (!this.proxyPollKey) {
            logger.warn("Cannot start poller: Missing proxy poll key.");
            return false;
        }

        // Check if we're disconnecting before starting
        if (this.isDisconnecting) {
            logger.debug("Poller is disconnecting, not starting new poll cycle.");
            return false;
        }

        // Check if already polling to prevent concurrent polling
        if (this.isPolling) {
            logger.debug("Poller is already running, not starting new poll cycle.");
            return false;
        }

        logger.debug("Starting proxy poller...");

        setTimeout(async () => {
            try {
                await this.poll();
                setTimeout(() => {
                    this.startPoller(); // Restart the poller after a successful poll
                }, 250);
            } catch (error) {
                if (this.isDisconnecting) {
                    logger.debug(`Poller is disconnecting, ignoring error during polling. Error was: ${error}.`);
                    return; // Just return from callback, don't restart
                }
                logger.debug(`startPoller will be retried in 5 seconds due to error: ${error}`);
                this.pollTimeout = setTimeout(() => {
                    this.pollTimeout = null;
                    this.startPoller(); // Restart the poller after an error
                }, 5000); // Retry after 5 seconds
            }
        }, 0);

        return true;
    }

    private poll(): Promise<void> {
        const url = `${this.proxyPollUrl}/${this.proxyPollKey}`;
        return new Promise((resolve, reject) => {
            if (this.isPolling) {
                reject("Poller is already polling. Skipping this polling request.");
                return; // Prevent further execution and rescheduling
            }
            this.isPolling = true;

            const req: HttpCallRequest = {
                url,
                method: "GET",
                signal: this.pollAborter.signal,
                timeout: 45000, // Sanity check since poller should be redirected after 30 sec
                headers: {
                    "X-Broadcaster-Username": integration.kick.broadcaster?.name || "unknown",
                    "X-Instance-ID": this.instanceId,
                    "X-Request-ID": crypto.randomUUID()
                },
                userAgent: `firebot-mage-kick-integration/${scriptVersion} (+https://github.com/TheStaticMage/firebot-mage-kick-integration)`,
                maxRedirects: 1000
            };
            httpCallWithTimeout(req)
                .then((response): InboundWebhook[] => {
                    if (!response || !response.webhooks) {
                        logger.debug("No webhooks received from proxy poll.");
                        resolve();
                    }
                    return response.webhooks as InboundWebhook[];
                })
                .then(async (webhooks: InboundWebhook[]) => {
                    logger.debug(`Received ${webhooks.length} webhooks from proxy poll.`);
                    for (const webhook of webhooks) {
                        await this.handleResponse(webhook);
                    }
                    resolve();
                })
                .catch((error) => {
                    if (this.isDisconnecting) {
                        logger.debug(`Poller is disconnecting, skipping error handling. Error was: ${error}.`);
                    } else {
                        logger.error(`Error during polling: ${error}`);
                    }
                    reject(error);
                })
                .finally(() => {
                    this.isPolling = false;
                });
        });
    }

    private async handleResponse(response: InboundWebhook): Promise<void> {
        try {
            await handleWebhook(response);
        } catch (error) {
            logger.error(`Error parsing webhook: ${error}`);
            return;
        }
    }
}
