import { integration } from "../integration";
import { logger } from "../main";
import { httpCallWithTimeout } from "./http";
import { handleWebhook } from "./webhook-handler/webhook-handler";

export class Poller {
    private pollAborter = new AbortController();
    private proxyPollKey = "";
    private proxyPollUrl = "";

    connect(proxyPollKey: string): void {
        const proxyPollUrl = integration.getSettings().webhookProxy.webhookProxyUrl.replace(/\/$/, "");
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
        this.startPoller();
        logger.debug(`Poller connected with proxy poll key: ${this.proxyPollKey}`);
    }

    disconnect(proxyPollKey = ''): void {
        // This is to let the proxy know the poller is no longer active. It will
        // help make things cleaner on the server side in case of a reconnect.
        if (this.proxyPollUrl && (proxyPollKey || this.proxyPollKey)) {
            logger.debug(`Disconnecting proxy poller with key: ${proxyPollKey || this.proxyPollKey}`);
            const url = `${this.proxyPollUrl}/${proxyPollKey || this.proxyPollKey}`;
            httpCallWithTimeout(url, "DELETE")
                .then(() => {
                    logger.info("Successfully disconnected proxy poller.");
                })
                .catch((error) => {
                    logger.error(`Error disconnecting proxy poller: ${error}`);
                });
        }

        logger.debug("Aborting any in-progress pollers...");
        this.pollAborter.abort();
    }

    setProxyPollKey(proxyPollKey: string): void {
        this.proxyPollKey = proxyPollKey;
    }

    setProxyPollUrl(proxyPollUrl: string): void {
        this.proxyPollUrl = proxyPollUrl;
    }

    private startPoller(): void {
        // If the proxy key is not set there's no point in starting the poller.
        if (!this.proxyPollKey) {
            logger.warn("Cannot start poller: Missing proxy poll key.");
            this.disconnect();
            return;
        }

        logger.debug("Starting proxy poller...");

        setTimeout(async () => {
            try {
                await this.poll();
                setTimeout(() => {
                    this.startPoller(); // Restart the poller after a successful poll
                }, 0);
            } catch (error) {
                logger.error(`Error occurred while polling: ${error}`);
                if (this.pollAborter.signal.aborted) {
                    return;
                }
                setTimeout(() => {
                    this.startPoller(); // Restart the poller after an error
                }, 5000); // Retry after 5 seconds
            }
        }, 0);
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
                    logger.error(`Error during polling: ${error}`);
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
