package state

import (
	"context"
	"mage-kick-webhook-proxy/pkg/model"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func createTestWebhook(id string) model.Webhook {
	return model.Webhook{
		WebhookHeaders: model.WebhookHeaders{
			EventMessageID:        id,
			EventSubscriptionID:   "sub-123",
			EventMessageTimestamp: time.Now().Format(time.RFC3339),
			EventType:             "chat.message.sent",
			EventVersion:          "1",
		},
		IsTestEvent: false,
		RawData:     []byte(`{"message": "test"}`),
	}
}

func TestMemoryState_BackgroundCleanup_WithSynctest(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Create memory state with background cleanup
		state := New(ctx)

		// Add some webhooks
		webhook1 := createTestWebhook("msg-1")
		webhook2 := createTestWebhook("msg-2")
		webhook3 := createTestWebhook("msg-3")

		_, err := state.AppendWebhook(ctx, "test-user", webhook1)
		require.NoError(t, err)

		_, err = state.AppendWebhook(ctx, "test-user", webhook2)
		require.NoError(t, err)

		seqID3, err := state.AppendWebhook(ctx, "test-user", webhook3)
		require.NoError(t, err)

		// Verify all webhooks are present
		webhooks, err := state.GetWebhooksSince(ctx, "test-user", 0)
		require.NoError(t, err)
		assert.Len(t, webhooks, 3)

		// Advance time by 30 seconds - should trigger first cleanup, but webhooks are still fresh
		time.Sleep(30 * time.Second)
		synctest.Wait() // Wait for cleanup to process

		// Webhooks should still be there (they're only 30s old)
		webhooks, err = state.GetWebhooksSince(ctx, "test-user", 0)
		require.NoError(t, err)
		assert.Len(t, webhooks, 3)

		// Advance time by another 275 seconds (total 305s) - should trigger cleanup and remove old webhooks
		time.Sleep(275 * time.Second)
		synctest.Wait() // Wait for cleanup to process

		// Now webhooks should be cleaned up (they're 305s old, beyond 300s threshold)
		webhooks, err = state.GetWebhooksSince(ctx, "test-user", 0)
		require.NoError(t, err)
		assert.Len(t, webhooks, 0, "Webhooks older than 60 seconds should be cleaned up")

		// Add a new webhook after cleanup
		webhook4 := createTestWebhook("msg-4")
		seqID4, err := state.AppendWebhook(ctx, "test-user", webhook4)
		require.NoError(t, err)
		assert.Greater(t, seqID4, seqID3, "New sequence ID should be higher")

		// Verify new webhook is present
		webhooks, err = state.GetWebhooksSince(ctx, "test-user", 0)
		require.NoError(t, err)
		assert.Len(t, webhooks, 1)
		assert.Equal(t, "msg-4", webhooks[0].Webhook.EventMessageID)

		// Cancel context to stop cleanup goroutine
		cancel()
		synctest.Wait() // Wait for goroutine to exit

		t.Log("Background cleanup test completed successfully")
	})
}

func TestMemoryState_BackgroundCleanup_MultipleUsers_WithSynctest(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Create memory state with background cleanup
		state := New(ctx)

		// Add webhooks for multiple users
		webhook1 := createTestWebhook("user1-msg-1")
		webhook2 := createTestWebhook("user2-msg-1")
		webhook3 := createTestWebhook("user1-msg-2")

		_, err := state.AppendWebhook(ctx, "user1", webhook1)
		require.NoError(t, err)

		_, err = state.AppendWebhook(ctx, "user2", webhook2)
		require.NoError(t, err)

		_, err = state.AppendWebhook(ctx, "user1", webhook3)
		require.NoError(t, err)

		// Verify initial state
		user1Webhooks, err := state.GetWebhooksSince(ctx, "user1", 0)
		require.NoError(t, err)
		assert.Len(t, user1Webhooks, 2)

		user2Webhooks, err := state.GetWebhooksSince(ctx, "user2", 0)
		require.NoError(t, err)
		assert.Len(t, user2Webhooks, 1)

		// Advance time beyond cleanup threshold
		time.Sleep(305 * time.Second)
		synctest.Wait() // Wait for cleanup to process

		// All old webhooks should be cleaned up
		user1Webhooks, err = state.GetWebhooksSince(ctx, "user1", 0)
		require.NoError(t, err)
		assert.Len(t, user1Webhooks, 0)

		user2Webhooks, err = state.GetWebhooksSince(ctx, "user2", 0)
		require.NoError(t, err)
		assert.Len(t, user2Webhooks, 0)

		// Add new webhooks for both users
		newWebhook1 := createTestWebhook("user1-new-msg")
		newWebhook2 := createTestWebhook("user2-new-msg")

		_, err = state.AppendWebhook(ctx, "user1", newWebhook1)
		require.NoError(t, err)

		_, err = state.AppendWebhook(ctx, "user2", newWebhook2)
		require.NoError(t, err)

		// Verify new webhooks are present
		user1Webhooks, err = state.GetWebhooksSince(ctx, "user1", 0)
		require.NoError(t, err)
		assert.Len(t, user1Webhooks, 1)
		assert.Equal(t, "user1-new-msg", user1Webhooks[0].Webhook.EventMessageID)

		user2Webhooks, err = state.GetWebhooksSince(ctx, "user2", 0)
		require.NoError(t, err)
		assert.Len(t, user2Webhooks, 1)
		assert.Equal(t, "user2-new-msg", user2Webhooks[0].Webhook.EventMessageID)

		// Cancel context to stop cleanup goroutine
		cancel()
		synctest.Wait() // Wait for goroutine to exit

		t.Log("Multi-user background cleanup test completed successfully")
	})
}
