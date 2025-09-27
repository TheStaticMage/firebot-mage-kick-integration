interface InboundWebhook {
    kick_event_message_id: string;
    kick_event_subscription_id: string;
    kick_event_message_timestamp: string;
    kick_event_type: string;
    kick_event_version: string;
    is_test_event?: boolean;
    cursor_id?: number;
    raw_data: string; // Assuming rawData is a base64 encoded JSON string
}
