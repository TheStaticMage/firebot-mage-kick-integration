import { IntegrationConstants } from "../constants";
import { integration } from "../integration";
import { logger } from "../main";
import { httpCallWithTimeout } from "./http";
import { handleWebhook } from "./webhook-handler/webhook-handler";

export class Poller {
    private pollAborter = new AbortController();
    private proxyPollKey = "";
    private proxyPollUrl = "";

    connect(proxyPollKey: string): void {
        this.proxyPollKey = proxyPollKey;
        this.proxyPollUrl = `${integration.getSettings().webhookProxy.webhookProxyUrl}/poll`;
        this.pollAborter = new AbortController();

        if (!this.proxyPollKey || !this.proxyPollUrl) {
            logger.warn(`[${IntegrationConstants.INTEGRATION_ID}] Cannot start poller: Missing proxy poll key or URL.`);
            return;
        }

        this.startPoller();
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Poller connected with proxy poll key: ${this.proxyPollKey}`);
    }

    disconnect(proxyPollKey = ''): void {
        // This is to let the proxy know the poller is no longer active. It will
        // help make things cleaner on the server side in case of a reconnect.
        if (this.proxyPollUrl && (proxyPollKey || this.proxyPollKey)) {
            logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Disconnecting proxy poller with key: ${proxyPollKey || this.proxyPollKey}`);
            const url = `${this.proxyPollUrl}/${proxyPollKey || this.proxyPollKey}`;
            httpCallWithTimeout(url, "DELETE")
                .then(() => {
                    logger.info(`[${IntegrationConstants.INTEGRATION_ID}] Successfully disconnected proxy poller.`);
                })
                .catch((error) => {
                    logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error disconnecting proxy poller: ${error}`);
                });
        }

        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Aborting any in-progress pollers...`);
        this.pollAborter.abort();
    }

    private startPoller(): void {
        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Starting proxy poller...`);

        setTimeout(async () => {
            try {
                await this.poll();
                setTimeout(() => {
                    this.startPoller(); // Restart the poller after a successful poll
                }, 0);
            } catch (error) {
                logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error occurred while polling: ${error}`);
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
                        logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] No webhooks received from proxy poll.`);
                        resolve();
                    }
                    return response.webhooks as InboundWebhook[];
                })
                .then(async (webhooks: InboundWebhook[]) => {
                    logger.debug(`[${IntegrationConstants.INTEGRATION_ID}] Received ${webhooks.length} webhooks from proxy poll.`);
                    for (const webhook of webhooks) {
                        await this.handleResponse(webhook);
                    }
                    resolve();
                })
                .catch((error) => {
                    logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error during polling: ${error}`);
                    reject(error);
                });
        });
    }

    private async handleResponse(response: InboundWebhook): Promise<void> {
        try {
            await handleWebhook(response);
        } catch (error) {
            logger.error(`[${IntegrationConstants.INTEGRATION_ID}] Error parsing webhook: ${error}`);
            return;
        }
    }
}
