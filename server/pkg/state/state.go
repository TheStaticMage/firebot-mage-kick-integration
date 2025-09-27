package state

import (
	"context"
	"mage-kick-webhook-proxy/pkg/model"
	"time"
)

type WebhookWithSequence struct {
	SequenceID int64         `json:"sequence_id"`
	Webhook    model.Webhook `json:"webhook"`
	Timestamp  time.Time     `json:"timestamp"`
}

type State interface {
	// Append webhook to log and return its sequence ID
	AppendWebhook(ctx context.Context, user string, webhook model.Webhook) (int64, error)

	// Get all webhooks since the given sequence ID
	GetWebhooksSince(ctx context.Context, user string, sinceID int64) ([]WebhookWithSequence, error)
}
