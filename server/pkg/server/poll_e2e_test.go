package server

import (
	"context"
	"encoding/json"
	"fmt"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// pollResponse represents the expected response structure
type pollResponse struct {
	Success  bool            `json:"success"`
	Webhooks []model.Webhook `json:"webhooks"`
	CursorID int64           `json:"cursor_id"`
}

// createTestServer creates a server with memory state and test configuration
func createTestServer(t *testing.T, ctx context.Context) (*httptest.Server, *Server, state.State) {
	memState := state.New(ctx)
	s := New(memState)

	// Create a mux with the same routing as the real server
	mux := http.NewServeMux()

	mux.HandleFunc("/poll/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			s.HandleClose(ctx)(w, r)
			return
		}

		if r.Method == http.MethodGet {
			s.HandlePoll(ctx)(w, r)
			return
		}

		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	})

	srv := httptest.NewServer(mux)
	return srv, s, memState
}

// createTestWebhook creates a test webhook
func createTestWebhook() model.Webhook {
	return model.Webhook{
		WebhookHeaders: model.WebhookHeaders{
			EventMessageID:        "msg-123",
			EventSubscriptionID:   "sub-456",
			EventMessageTimestamp: "2025-09-26T10:30:00Z",
			EventType:             "chat.message.sent",
			EventVersion:          "1",
		},
		IsTestEvent: false,
		RawData:     []byte(`{"message": "Hello World"}`),
	}
}

func TestPollHandler_OldClient_WebhookDelivery(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.New()
	cfg.SetUser("test-kick-name", "test-uuid-123", false)
	ctx = config.WithConfig(ctx, cfg)

	httptestServer, server, _ := createTestServer(t, ctx)
	defer httptestServer.Close()

	// Test old client behavior (no X-Cursor-ID header)
	t.Run("old client receives webhook", func(t *testing.T) {
		// Step 1: Client connects (no webhooks available, should wait)
		client := &http.Client{Timeout: 2 * time.Second}

		// Start the poll request in a goroutine since it will wait
		done := make(chan *http.Response, 1)
		errorChan := make(chan error, 1)
		go func() {
			resp, err := client.Get(httptestServer.URL + "/poll/test-uuid-123")
			if err != nil {
				errorChan <- err
				return
			}
			done <- resp
		}()

		// Give a moment for the poll to start waiting
		time.Sleep(10 * time.Millisecond)

		// Step 2: Add a webhook to state
		webhook := createTestWebhook()
		seqID, err := server.state.AppendWebhook(ctx, "test-uuid-123", webhook)
		require.NoError(t, err)
		assert.Greater(t, seqID, int64(0))

		// Step 3: Notify the waiter that a webhook arrived
		server.notifyWaiter("test-uuid-123")

		// Wait for the poll request to complete
		select {
		case resp := <-done:
			defer resp.Body.Close()

			// Step 4: Verify the response
			assert.Equal(t, http.StatusOK, resp.StatusCode)

			var response pollResponse
			err = json.NewDecoder(resp.Body).Decode(&response)
			require.NoError(t, err)

			assert.True(t, response.Success)
			assert.Len(t, response.Webhooks, 1)
			assert.Greater(t, response.CursorID, int64(0))
			assert.Equal(t, webhook.EventMessageID, response.Webhooks[0].EventMessageID)

		case err := <-errorChan:
			t.Fatalf("Poll request failed: %v", err)
		case <-time.After(3 * time.Second):
			t.Fatal("Poll request timed out")
		}

		// Step 5: Client reconnects (old client still doesn't send header)
		// This should timeout quickly since there are no new webhooks
		shortClient := &http.Client{Timeout: 500 * time.Millisecond}
		resp2, err := shortClient.Get(httptestServer.URL + "/poll/test-uuid-123")

		// We expect this to timeout since there are no new webhooks
		if err != nil {
			// Timeout is expected behavior when no webhooks are available
			t.Logf("Second poll timed out as expected (no new webhooks): %v", err)
			// Close any pending waiters to clean up
			server.closeWaiter("test-uuid-123")
			return
		}

		defer resp2.Body.Close()
		assert.Equal(t, http.StatusOK, resp2.StatusCode)

		var response2 pollResponse
		err = json.NewDecoder(resp2.Body).Decode(&response2)
		require.NoError(t, err)

		assert.True(t, response2.Success)
		assert.Len(t, response2.Webhooks, 0)            // No new webhooks since they were cleaned up
		assert.Greater(t, response2.CursorID, int64(0)) // Cursor should be stored from last response
	})
}

func TestPollHandler_NewClient_WebhookDelivery(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.New()
	cfg.SetUser("test-kick-name", "test-uuid-456", false)
	ctx = config.WithConfig(ctx, cfg)

	httptestServer, server, _ := createTestServer(t, ctx)
	defer httptestServer.Close()

	// Test new client behavior (with X-Cursor-ID header)
	t.Run("new client with cursor ID receives webhook", func(t *testing.T) {
		client := &http.Client{Timeout: 2 * time.Second} // Step 1: Add a webhook first
		webhook := createTestWebhook()
		seqID, err := server.state.AppendWebhook(ctx, "test-uuid-456", webhook)
		require.NoError(t, err)
		assert.Greater(t, seqID, int64(0))

		// Step 2: Client connects with cursor ID 0 (should get the webhook immediately)
		req, err := http.NewRequest("GET", httptestServer.URL+"/poll/test-uuid-456", nil)
		require.NoError(t, err)
		req.Header.Set("X-Cursor-ID", "0")

		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify response
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var response pollResponse
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		assert.True(t, response.Success)
		assert.Len(t, response.Webhooks, 1)
		assert.Equal(t, seqID, response.CursorID)
		assert.Equal(t, webhook.EventMessageID, response.Webhooks[0].EventMessageID)

		// Step 3: Client reconnects with the returned cursor ID (should get no new webhooks)
		req2, err := http.NewRequest("GET", httptestServer.URL+"/poll/test-uuid-456", nil)
		require.NoError(t, err)
		req2.Header.Set("X-Cursor-ID", fmt.Sprintf("%d", response.CursorID))

		// Use a short timeout client to test that polling waits appropriately
		shortClient := &http.Client{Timeout: 500 * time.Millisecond}
		resp2, err := shortClient.Do(req2)

		if err != nil {
			// Timeout is expected since no new webhooks
			t.Logf("Second poll with cursor ID timed out as expected: %v", err)
			server.closeWaiter("test-uuid-456")
			return
		}

		defer resp2.Body.Close()
		assert.Equal(t, http.StatusOK, resp2.StatusCode)

		var response2 pollResponse
		err = json.NewDecoder(resp2.Body).Decode(&response2)
		require.NoError(t, err)

		assert.True(t, response2.Success)
		assert.Len(t, response2.Webhooks, 0)       // No new webhooks
		assert.Equal(t, seqID, response2.CursorID) // Same cursor ID since no new webhooks
	})
}

func TestPollHandler_NewClient_StoredWebhooks(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	cfg := config.New()
	cfg.SetUser("test-kick-name", "test-uuid-789", false)
	ctx = config.WithConfig(ctx, cfg)

	httptestServer, server, _ := createTestServer(t, ctx)
	defer httptestServer.Close()

	t.Run("new client receives stored webhooks within TTL", func(t *testing.T) {
		now := time.Now()

		// Create 3 test webhooks with different timestamps
		webhook1 := createTestWebhookWithID("msg-1", "6 minutes ago")
		webhook2 := createTestWebhookWithID("msg-2", "4 minutes ago")
		webhook3 := createTestWebhookWithID("msg-3", "2 minutes ago")

		// Add webhooks to state with specific timestamps
		// Webhook 1: 6 minutes ago (should be excluded due to TTL)
		seq1, err := server.state.AppendWebhook(ctx, "test-uuid-789", webhook1)
		require.NoError(t, err)

		// Manually set the timestamp to 6 minutes ago (older than 5 minute TTL)
		server.state.(*state.MemoryState).SetWebhookTimestamp("test-uuid-789", seq1, now.Add(-6*time.Minute))

		// Webhook 2: 4 minutes ago (should be included)
		seq2, err := server.state.AppendWebhook(ctx, "test-uuid-789", webhook2)
		require.NoError(t, err)
		server.state.(*state.MemoryState).SetWebhookTimestamp("test-uuid-789", seq2, now.Add(-4*time.Minute))

		// Webhook 3: 2 minutes ago (should be included)
		seq3, err := server.state.AppendWebhook(ctx, "test-uuid-789", webhook3)
		require.NoError(t, err)
		server.state.(*state.MemoryState).SetWebhookTimestamp("test-uuid-789", seq3, now.Add(-2*time.Minute))

		// Make request with X-Cursor-ID = 0 to get all stored webhooks
		req, err := http.NewRequest("GET", httptestServer.URL+"/poll/test-uuid-789", nil)
		require.NoError(t, err)
		req.Header.Set("X-Cursor-ID", "0")

		client := &http.Client{Timeout: 2 * time.Second}
		resp, err := client.Do(req)
		require.NoError(t, err)
		defer resp.Body.Close()

		// Verify response
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		var response pollResponse
		err = json.NewDecoder(resp.Body).Decode(&response)
		require.NoError(t, err)

		// Should receive only the webhooks within TTL (4 and 2 minutes ago)
		assert.True(t, response.Success)
		assert.Len(t, response.Webhooks, 2)
		assert.Greater(t, response.CursorID, int64(0))

		// Verify the correct webhooks were returned (should be msg-2 and msg-3)
		webhookIDs := make([]string, len(response.Webhooks))
		for i, wh := range response.Webhooks {
			webhookIDs[i] = wh.EventMessageID
		}

		// Should contain webhooks within TTL (4 and 2 minutes ago)
		assert.Contains(t, webhookIDs, "msg-2", "Should contain 4-minute-old webhook")
		assert.Contains(t, webhookIDs, "msg-3", "Should contain 2-minute-old webhook")

		// Should NOT contain webhook outside TTL (6 minutes ago)
		assert.NotContains(t, webhookIDs, "msg-1", "Should exclude 6-minute-old webhook due to TTL")

		// Verify the cursor ID is set to the last webhook's sequence ID
		assert.Equal(t, seq3, response.CursorID, "Cursor ID should be set to the last webhook's sequence ID")
	})
}

// Helper function to create a test webhook with a specific ID and description
func createTestWebhookWithID(messageID, description string) model.Webhook {
	return model.Webhook{
		WebhookHeaders: model.WebhookHeaders{
			EventMessageID:        messageID,
			EventSubscriptionID:   "sub-456",
			EventMessageTimestamp: "2025-09-26T10:30:00Z",
			EventType:             "chat.message.sent",
			EventVersion:          "1",
		},
		IsTestEvent: false,
		RawData:     []byte(fmt.Sprintf(`{"message": "Test webhook %s"}`, description)),
	}
}
