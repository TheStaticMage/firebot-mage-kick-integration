import { IKick } from "./kick-interface";
import { logger } from "../main";
import { integration } from "../integration";

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
    private kickIsBroken = false;
    private isInitialized = false;
    private checker: NodeJS.Timeout | null = null;

    constructor(kick: IKick) {
        this.kick = kick;
    }

    async initialize(): Promise<void> {
        const subscriptions = await this.getSubscriptions();
        this.kickIsBroken = this.isKickBroken(subscriptions, subscriptionsToRequest);

        const reconciliation = this.reconcileSubscriptions(subscriptions);
        await this.subscribeToEvents(reconciliation);

        this.checker = setTimeout(() => {
            this.checkSubscriptions().catch((error) => {
                logger.error(`Error during scheduled checkSubscriptions: ${error}`);
            });
        }, 5000);

        this.isInitialized = true;
    }

    shutdown(): void {
        if (this.checker) {
            clearTimeout(this.checker);
            this.checker = null;
        }
        this.isInitialized = false;
    }

    async resetWebhookSubscriptions(): Promise<void> {
        logger.debug("Resetting webhook subscriptions...");
        const subscriptions = await this.getSubscriptions();
        const req: WebhookSubscriptionReconcileResponse = {
            delete: subscriptions.map(sub => sub.id),
            create: [] // We are just deleting, not creating. That can get done upon reconnection.
        };
        await this.subscribeToEvents(req);
        logger.debug("Webhook subscriptions reset.");
    }

    private async checkSubscriptions(): Promise<void> {
        if (!this.isInitialized) {
            return;
        }

        let mismatch = false;
        const currentSubs = await this.getSubscriptions();
        for (const subToRequest of subscriptionsToRequest) {
            const exists = currentSubs.some(
                sub => sub.event === subToRequest.name && sub.version === subToRequest.version
            );
            if (!exists) {
                mismatch = true;
                logger.warn(`Missing subscription for event "${subToRequest.name}" (v${subToRequest.version})`);
            }
        }

        if (currentSubs.length !== subscriptionsToRequest.length || mismatch) {
            logger.warn(`Post-reconciliation webhook subscription mismatch: ${currentSubs.length} found, expected ${subscriptionsToRequest.length}`);
            integration.sendChatFeedErrorNotification(`Webhook subscriptions are not being created or updated correctly on Kick. This can happen when Kick is under heavy load or having problems, and unfortunately there's not anything you can do about it. Parts of the integration will remain functional, but events that depend on webhooks may be delayed or unreliable until this is resolved. Sometimes this will clear up on its own. You can also try disconnecting and reconnecting the integration in a few minutes to see if that clears things up.`);
            return;
        }

        logger.debug("Webhook subscriptions verified as correct.");
    }

    private isKickBroken(subscriptions: WebhookSubscription[], referenceSubscriptions: { name: string; version: number; }[]): boolean {
        // Check for duplicates
        const eventVersionMap = new Map<string, number>();
        for (const sub of subscriptions) {
            const key = `${sub.event}|${sub.version}`;
            eventVersionMap.set(key, (eventVersionMap.get(key) || 0) + 1);
        }
        for (const [key, count] of eventVersionMap.entries()) {
            if (count > 1) {
                logger.debug(`Duplicate subscription found for event "${key}"`);
                return true;
            }
        }

        // Check for unknown subscriptions
        const validEvents = new Set(referenceSubscriptions.map(s => `${s.name}|${s.version}`));
        for (const sub of subscriptions) {
            const key = `${sub.event}|${sub.version}`;
            if (!validEvents.has(key)) {
                logger.debug(`Unknown subscription found for event "${key}"`);
                return true;
            }
        }

        logger.debug(`Webhook subscription validation complete. Checked ${subscriptions.length} subscriptions.`);
        return false;
    }

    private async subscribeToEvents(reconciliation: WebhookSubscriptionReconcileResponse): Promise<void> {
        try {
            // Delete subscriptions
            if (reconciliation.delete.length > 0) {
                const params = new URLSearchParams();
                for (const id of reconciliation.delete) {
                    params.append('id', id);
                }
                try {
                    await this.kick.httpCallWithTimeout(`/public/v1/events/subscriptions?${params.toString()}`, "DELETE");
                } catch (error) {
                    logger.warn(`Failed to unsubscribe from event subscription with ID: ${reconciliation.delete.join(', ')}. Error: ${error}`);
                }
            }

            // Pause between calls
            if (reconciliation.delete.length > 0 && reconciliation.create.length > 0) {
                await new Promise(res => setTimeout(res, 100));
            }

            // Create subscriptions
            if (reconciliation.create.length > 0) {
                if (!this.kick.broadcaster) {
                    throw new Error("Broadcaster information is missing");
                }

                const createPayload: WebhookSubscriptionCreatePayload = {
                    // eslint-disable-next-line camelcase
                    broadcaster_user_id: this.kick.broadcaster.userId,
                    events: reconciliation.create,
                    method: "webhook"
                };
                await this.kick.httpCallWithTimeout('/public/v1/events/subscriptions', "POST", JSON.stringify(createPayload));
            }
            logger.info("Event subscription reconciliation complete.");
        } catch (error) {
            logger.error(`Failed to reconcile event subscriptions: ${error}`);
            throw error;
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

        if (this.kickIsBroken) {
            logger.warn(`Kick is broken, not reconciling subscriptions.`);
            return {
                create: subscriptionsToRequest.map(sub => ({ name: sub.name, version: sub.version })),
                delete: current.map(sub => sub.id).filter((id): id is string => !!id)
            };
        }

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
