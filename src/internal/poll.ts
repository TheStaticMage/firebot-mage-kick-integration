import { integration } from "../integration";
import { logger } from "../main";
import { httpCallWithTimeout } from "./http";
import { handleWebhook } from "./webhook-handler/webhook-handler";

export class Poller {
    private isDisconnecting = false;
    private pollAborter = new AbortController();
    private pollTimeout: NodeJS.Timeout | null = null;
    private proxyPollKey = "";
    private proxyPollUrl = "";

    async connect(proxyPollKey: string): Promise<void> {
        this.isDisconnecting = false;

        const proxyPollUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/+$/, "");
        if (!proxyPollUrl) {
            logger.warn("Cannot start poller: Missing proxy poll URL. (Configure in the integration settings.)");
            return;
        }
        if (!proxyPollKey) {
            logger.warn("Cannot start poller: Missing proxy poll key.");
            return;
        }

        this.proxyPollKey = proxyPollKey;
        this.proxyPollUrl = `${proxyPollUrl}/poll`;
        this.pollAborter = new AbortController();
        const started = this.startPoller();
        if (!started) {
            logger.warn("Failed to start poller.");
            await this.disconnect(proxyPollKey);
            return;
        }
        logger.debug(`Poller connected with proxy poll key: ${this.proxyPollKey}`);
    }

    async disconnect(proxyPollKey = ''): Promise<void> {
        // This is to let the proxy know the poller is no longer active. It will
        // help make things cleaner on the server side in case of a reconnect.
        this.isDisconnecting = true;
        if (this.proxyPollUrl && (proxyPollKey || this.proxyPollKey)) {
            logger.debug(`Disconnecting proxy poller with key: ${proxyPollKey || this.proxyPollKey}`);
            const url = `${this.proxyPollUrl}/${proxyPollKey || this.proxyPollKey}`;
            try {
                await httpCallWithTimeout(url, "DELETE");
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

        logger.debug("Starting proxy poller...");

        setTimeout(async () => {
            try {
                await this.poll();
                setTimeout(() => {
                    this.startPoller(); // Restart the poller after a successful poll
                }, 0);
            } catch (error) {
                if (this.isDisconnecting) {
                    logger.debug(`Poller is disconnecting, ignoring error during polling. Error was: ${error}.`);
                    return false;
                }

                logger.error(`Error occurred while polling: ${error}`);
                this.pollTimeout = setTimeout(() => {
                    this.pollTimeout = null;
                    this.startPoller(); // Restart the poller after an error
                }, 5000); // Retry after 5 seconds
            }
        }, 0);

        return true;
    }

    private async poll(): Promise<void> {
        const url = `${this.proxyPollUrl}/${this.proxyPollKey}`;
        return new Promise((resolve, reject) => {
            httpCallWithTimeout(url, "GET", '', '', this.pollAborter.signal, 0)
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
