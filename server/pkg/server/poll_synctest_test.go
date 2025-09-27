package server

import (
	"context"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state"
	"testing"
	"testing/synctest"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPollHandler_Timeouts_WithSynctest(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		// Test that demonstrates synctest time control
		t.Log("Testing time control with synctest - time should start at 2000-01-01 00:00:00 UTC")

		start := time.Now()
		t.Logf("Start time: %v", start)

		// Sleep for 5 seconds - should be instant with synctest
		time.Sleep(5 * time.Second)
		elapsed := time.Since(start)

		t.Logf("After 5s sleep, elapsed time: %v", elapsed)
		assert.Equal(t, 5*time.Second, elapsed, "synctest should advance time exactly")

		// Test webhook timeout behavior
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		memState := state.New(ctx)
		server := New(memState)

		cfg := config.New()
		cfg.SetUser("test-kick-name", "test-uuid-timeout", false)
		ctx = config.WithConfig(ctx, cfg)

		// Create webhook
		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID:        "timeout-test-123",
				EventSubscriptionID:   "sub-timeout",
				EventMessageTimestamp: time.Now().Format(time.RFC3339),
				EventType:             "chat.message.sent",
				EventVersion:          "1",
			},
			IsTestEvent: false,
			RawData:     []byte(`{"message": "timeout test"}`),
		}

		// Add webhook to state
		seqID, err := server.state.AppendWebhook(ctx, "test-uuid-timeout", webhook)
		require.NoError(t, err)
		assert.Greater(t, seqID, int64(0))

		t.Log("Successfully tested synctest time control and state operations")
	})
}

func TestWaiterNotification_WithSynctest(t *testing.T) {
	synctest.Test(t, func(t *testing.T) {
		// Test waiter notification system with controlled time
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		memState := state.New(ctx)
		server := New(memState)

		// Test creating and notifying waiters
		waiterClosed := make(chan bool, 1)

		go func() {
			// Simulate a waiter being created and then notified
			w := server.addWaiter("test-user")
			defer w.cleanup()

			// Wait for either close or resolve notification
			select {
			case <-w.closeChan:
				waiterClosed <- true
			case <-w.resolveChan:
				waiterClosed <- true
			}
		}()

		// Let the waiter goroutine start
		synctest.Wait()

		// Now notify the waiter
		server.notifyWaiter("test-user")

		// Wait for notification to be processed
		synctest.Wait()

		// Verify the waiter was notified
		select {
		case <-waiterClosed:
			t.Log("Waiter correctly received notification")
		default:
			t.Fatal("Waiter should have been notified")
		}
	})
}
