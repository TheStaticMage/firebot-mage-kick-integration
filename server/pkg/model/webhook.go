package model

import "encoding/json"

type WebhookHeaders struct {
	EventMessageID        string `json:"kick_event_message_id"`
	EventSubscriptionID   string `json:"kick_event_subscription_id"`
	EventMessageTimestamp string `json:"kick_event_message_timestamp"`
	EventType             string `json:"kick_event_type"`
	EventVersion          string `json:"kick_event_version"`
}

type Webhook struct {
	WebhookHeaders
	RawData []byte `json:"raw_data"`
}

type InjectableWebhook struct {
	WebhookHeaders
	RawData string          `json:"raw_data"`
	Payload json.RawMessage `json:"payload"`
}

type WebhookBroadcaster struct {
	IsAnonymous    bool   `json:"is_anonymous"`
	UserID         int64  `json:"user_id"`
	UserName       string `json:"username"`
	IsVerified     bool   `json:"is_verified"`
	ProfilePicture string `json:"profile_picture"`
	ChannelSlug    string `json:"channel_slug"`
}

type WebhookResponse struct {
	Success  bool      `json:"success"`
	Webhooks []Webhook `json:"webhooks"`
}
