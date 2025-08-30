import { IKick } from "./kick-interface";
import { logger } from "../main";

const subscriptionsToRequest = [
    {
        name: "chat.message.sent",
        version: 1
    },
    {
        name: "channel.followed",
        version: 1
    },
    {
        name: "livestream.metadata.updated",
        version: 1
    },
    {
        name: "livestream.status.updated",
        version: 1
    },
    {
        name: "channel.subscription.renewal",
        version: 1
    },
    {
        name: "channel.subscription.gifts",
        version: 1
    },
    {
        name: "channel.subscription.new",
        version: 1
    },
    {
        name: "moderation.banned",
        version: 1
    }
];

export class WebhookSubscriptionManager {
    private kick: IKick;

    constructor(kick: IKick) {
        this.kick = kick;
    }

    async subscribeToEvents(): Promise<void> {
        const reconciliation = this.reconcileSubscriptions(await this.getSubscriptions());
        const promises: Promise<any>[] = [];

        if (reconciliation.create.length > 0) {
            const createPromise = new Promise((resolve, reject) => {
                const createPayload: WebhookSubscriptionCreatePayload = {
                    // eslint-disable-next-line camelcase
                    broadcaster_user_id: this.kick.broadcaster?.userId || 0,
                    events: reconciliation.create,
                    method: "webhook"
                };
                this.kick.httpCallWithTimeout('/public/v1/events/subscriptions', "POST", JSON.stringify(createPayload))
                    .then((response) => {
                        const parsed: SubscriptionResponse = response as SubscriptionResponse;
                        const subscriptionIds = parsed.data.map(sub => sub.subscription_id);
                        logger.debug(`Successfully created Kick event subscriptions: ${JSON.stringify(subscriptionIds)}`);
                        resolve(subscriptionIds);
                    })
                    .catch((error) => {
                        reject(error);
                    });
            });
            promises.push(createPromise);
        }

        if (reconciliation.delete.length > 0) {
            const deletePromises = reconciliation.delete.map((subscriptionId) => {
                const params = new URLSearchParams({ id: subscriptionId });
                logger.debug(`Unsubscribing from event subscription with ID: ${subscriptionId}`);
                return this.kick.httpCallWithTimeout(`/public/v1/events/subscriptions?${params.toString()}`, "DELETE");
            });
            promises.push(...deletePromises);
        }

        return new Promise((resolve, reject) => {
            Promise.all(promises)
                .then(() => {
                    logger.info("Event subscription reconciliation complete.");
                    resolve();
                })
                .catch((error) => {
                    logger.error(`Failed to reconcile event subscriptions: ${error}`);
                    reject(error);
                });
        });
    }

    async unsubscribeFromEvents(): Promise<void> {
        try {
            const subscriptions = await this.getSubscriptions();
            const unsubscribePromises = subscriptions.map((subscription) => {
                const params = new URLSearchParams({ id: subscription.id });
                logger.debug(`Unsubscribing from event subscription with ID: ${subscription.id} (${subscription.event}:${subscription.version})`);
                return this.kick.httpCallWithTimeout(`/public/v1/events/subscriptions?${params.toString()}`, "DELETE");
            });

            await Promise.all(unsubscribePromises);
            logger.info("Successfully deleted existing event subscriptions.");
        } catch (error) {
            logger.error(`Failed to delete existing event subscriptions: ${error}`);
        }
    }

    private async getSubscriptions(): Promise<WebhookSubscription[]> {
        try {
            const response = await this.kick.httpCallWithTimeout('/public/v1/events/subscriptions', "GET");
            return response.data;
        } catch (error) {
            logger.error(`Failed to retrieve event subscriptions: ${error}`);
            return [];
        }
    }

    private reconcileSubscriptions(current: WebhookSubscription[]): WebhookSubscriptionReconcileResponse {
        const create: WebhookSubscriptionToCreate[] = [];
        const deleteSubs: string[] = [];

        for (const subToRequest of subscriptionsToRequest) {
            const matching = current.filter(
                cur => cur.event === subToRequest.name && cur.version === subToRequest.version
            );
            if (matching.length === 0) {
                create.push(subToRequest);
            } else if (matching.length > 1) {
                // Keep one, delete the rest
                deleteSubs.push(
                    ...matching
                        .slice(1)
                        .map(sub => sub.id)
                        .filter((id): id is string => typeof id === "string" && !!id)
                );
            }
        }

        for (const cur of current) {
            const found = subscriptionsToRequest.some(
                req => req.name === cur.event && req.version === cur.version
            );
            if (!found && cur.id) {
                deleteSubs.push(cur.id);
            }
        }

        if (create.length > 0) {
            logger.debug(
                `Subscriptions to create: ${create
                    .map(sub => `${sub.name} (v${sub.version})`)
                    .join(", ")}`
            );
        } else {
            logger.debug("No subscriptions to create.");
        }

        if (deleteSubs.length > 0) {
            logger.debug(
                `Subscriptions to delete: ${current
                    .filter(sub => deleteSubs.includes(sub.id ?? ""))
                    .map(sub => `${sub.id ?? "unknown-id"}: ${sub.event} (v${sub.version})`)
                    .join(", ")}`
            );
        } else {
            logger.debug("No subscriptions to delete.");
        }

        const preserved = current.filter(cur =>
            !deleteSubs.includes(cur.id ?? "") &&
            subscriptionsToRequest.some(req => req.name === cur.event && req.version === cur.version)
        );

        if (preserved.length > 0) {
            logger.debug(
                `Subscriptions preserved: ${preserved
                    .map(sub => `${sub.id ?? "unknown-id"}: ${sub.event} (v${sub.version})`)
                    .join(", ")}`
            );
        } else {
            logger.debug("No subscriptions preserved.");
        }

        return { create, delete: deleteSubs };
    }
}


interface WebhookSubscription {
    app_id: string,
    broadcaster_user_id: string,
    created_at: string,
    event: string,
    id: string,
    method: string,
    updated_at: string,
    version: number
}

interface WebhookSubscriptionCreatePayload {
    broadcaster_user_id: number,
    events: WebhookSubscriptionToCreate[],
    method: string
}

interface WebhookSubscriptionToCreate {
    name: string,
    version: number
}

interface WebhookSubscriptionReconcileResponse {
    create: WebhookSubscriptionToCreate[],
    delete: string[]
}

interface SubscriptionRecord {
    error: string;
    name: string;
    subscription_id: string;
    version: number;
}

interface SubscriptionResponse {
    data: SubscriptionRecord[];
    message: string;
}
