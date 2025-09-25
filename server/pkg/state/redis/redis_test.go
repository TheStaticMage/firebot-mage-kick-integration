package redis

import (
	"context"
	"mage-kick-webhook-proxy/pkg/model"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRedisWebhookStore_NonBlocking(t *testing.T) {
	// Skip if Redis is not available
	redisURL := "redis://localhost:6379"
	store, err := NewRedisWebhookStore(redisURL)
	if err != nil {
		t.Skipf("Redis not available: %v", err)
	}
	defer store.Close()

	ctx := context.Background()

	t.Run("StoreWebhookNonBlocking", func(t *testing.T) {
		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID:        "test-message-nonblocking",
				EventSubscriptionID:   "test-sub-456",
				EventMessageTimestamp: "2024-01-01T12:00:00Z",
				EventType:             "channel.follow",
				EventVersion:          "1.0",
			},
			IsTestEvent: false,
			RawData:     []byte(`{"test": "nonblocking"}`),
		}

		// Measure time - should be very fast since it's non-blocking
		start := time.Now()
		err := store.StoreWebhook(ctx, "testuser", webhook)
		elapsed := time.Since(start)

		require.NoError(t, err)
		assert.Less(t, elapsed, 10*time.Millisecond, "StoreWebhook should be non-blocking and complete in <10ms")

		// Give background worker time to process
		time.Sleep(100 * time.Millisecond)

		// Verify webhook was actually stored
		webhooks, err := store.LoadWebhooksForUser(ctx, "testuser")
		require.NoError(t, err)

		found := false
		for _, w := range webhooks {
			if w.EventMessageID == "test-message-nonblocking" {
				found = true
				break
			}
		}
		assert.True(t, found, "Webhook should have been stored by background worker")
	})

	t.Run("ExpireWebhookNonBlocking", func(t *testing.T) {
		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID:        "test-message-expire-nonblocking",
				EventSubscriptionID:   "test-sub-456",
				EventMessageTimestamp: "2024-01-01T12:00:00Z",
				EventType:             "channel.follow",
				EventVersion:          "1.0",
			},
			IsTestEvent: false,
			RawData:     []byte(`{"test": "expire-nonblocking"}`),
		}

		// Store webhook first
		err := store.StoreWebhook(ctx, "testuser", webhook)
		require.NoError(t, err)

		// Give background worker time to process storage
		time.Sleep(100 * time.Millisecond)

		// Measure time for expiration - should be very fast since it's non-blocking
		start := time.Now()
		err = store.ExpireWebhook(ctx, "testuser", webhook)
		elapsed := time.Since(start)

		require.NoError(t, err)
		assert.Less(t, elapsed, 10*time.Millisecond, "ExpireWebhook should be non-blocking and complete in <10ms")

		// Give background worker time to process expiration
		time.Sleep(100 * time.Millisecond)

		// Verify webhook was actually expired
		webhooks, err := store.LoadWebhooksForUser(ctx, "testuser")
		require.NoError(t, err)

		found := false
		for _, w := range webhooks {
			if w.EventMessageID == "test-message-expire-nonblocking" {
				found = true
				break
			}
		}
		assert.False(t, found, "Webhook should have been expired by background worker")
	})

	t.Run("QueueFullHandling", func(t *testing.T) {
		// Create a store with a very small buffer
		smallStore := &RedisWebhookStore{
			client:    store.client,
			opChannel: make(chan webhookOperation, 1), // Very small buffer
			ctx:       store.ctx,
			cancel:    store.cancel,
		}

		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID: "queue-full-test",
				EventType:      "channel.follow",
				EventVersion:   "1.0",
			},
			RawData: []byte(`{"test": "queue-full"}`),
		}

		// Fill the queue
		err := smallStore.StoreWebhook(context.Background(), "testuser", webhook)
		require.NoError(t, err)

		// This should fail because queue is full
		webhook.EventMessageID = "queue-full-test-2"
		err = smallStore.StoreWebhook(context.Background(), "testuser", webhook)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "queue is full")
	})

	t.Run("ContextCancellation", func(t *testing.T) {
		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID: "context-cancel-test",
				EventType:      "channel.follow",
				EventVersion:   "1.0",
			},
			RawData: []byte(`{"test": "context-cancel"}`),
		}

		// Create a canceled context
		canceledCtx, cancel := context.WithCancel(context.Background())
		cancel() // Cancel immediately

		err = store.ExpireWebhook(canceledCtx, "testuser", webhook)
		assert.Error(t, err)
		assert.Equal(t, context.Canceled, err)
	})
}
