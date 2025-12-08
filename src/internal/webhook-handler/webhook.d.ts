export interface InboundWebhook {
    kickEventMessageId: string;
    kickEventSubscriptionId: string;
    kickEventMessageTimestamp: string;
    kickEventType: string;
    kickEventVersion: string;
    cursorId?: number;
    rawData: string;
    isTestEvent?: boolean;
}
