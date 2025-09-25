package redis

import (
	"context"
	"mage-kick-webhook-proxy/pkg/model"
)

// WebhookStore defines the interface for webhook persistence
type WebhookStore interface {
	// StoreWebhook stores a webhook for persistent delivery guarantee (non-blocking)
	StoreWebhook(ctx context.Context, user string, webhook model.Webhook) error

	// ExpireWebhook removes one or more webhooks after successful delivery (non-blocking)
	ExpireWebhook(ctx context.Context, user string, webhooks ...model.Webhook) error

	// LoadWebhooksForUser retrieves all stored webhooks for a user
	LoadWebhooksForUser(ctx context.Context, user string) ([]model.Webhook, error)

	// LoadAllWebhooks retrieves all stored webhooks for startup pre-population
	LoadAllWebhooks(ctx context.Context) (map[string][]model.Webhook, error)

	// Close closes the webhook store and cleans up resources
	Close() error
}
