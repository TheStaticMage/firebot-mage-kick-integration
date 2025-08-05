package server

import (
	"context"
	"encoding/json"
	"io"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"net/http"
	"strings"
)

func (s *Server) HandleWebHook(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	// Note: Any non-OK error response will cause Kick to stop sending webhooks
	// for a while, so even if there is an error, we tell Kick that we
	// successfully received the webhook.
	return func(w http.ResponseWriter, r *http.Request) {
		// Get headers
		messageID := r.Header.Get("Kick-Event-Message-ID")
		timestamp := r.Header.Get("Kick-Event-Message-Timestamp")
		inputSignature := r.Header.Get("Kick-Event-Signature")
		eventType := r.Header.Get("Kick-Event-Type")
		eventVersion := r.Header.Get("Kick-Event-Version")

		if messageID == "" || timestamp == "" || inputSignature == "" || eventType == "" || eventVersion == "" {
			s.log(ctx, r, "Rejecting message with missing headers")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
			return
		}

		// Get the request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.log(ctx, r, "Failed to read request body: %v", err)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
			return
		}

		// Verify the webhook signature
		if err := verifyWebhook(messageID, timestamp, string(body), inputSignature); err != nil {
			s.log(ctx, r, "Invalid webhook signature: %v", err)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
			return
		}

		// Parse the JSON body into the portion of a Webhook struct that we care about
		type ParsedWebhook struct {
			Broadcaster model.WebhookBroadcaster `json:"broadcaster"`
		}

		var parsedWebhook ParsedWebhook
		if err := json.Unmarshal(body, &parsedWebhook); err != nil {
			s.log(ctx, r, "Failed to parse webhook body: %v", err)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
			return
		}

		// Match the webhook request to a user
		keyID, exists := config.FromContext(ctx).KickNameToID[strings.ToLower(parsedWebhook.Broadcaster.UserName)]
		if !exists {
			s.log(ctx, r, "Rejected webhook for unregistered kick user! username=%s eventType=%s eventVersion=%s",
				parsedWebhook.Broadcaster.UserName, eventType, eventVersion)
			w.WriteHeader(http.StatusOK)
			w.Write([]byte(`{"success": true}`))
			return
		}

		// Construct the Webhook object
		webhook := model.Webhook{
			EventMessageID:        messageID,
			EventSubscriptionID:   r.Header.Get("Kick-Event-Subscription-ID"),
			EventMessageTimestamp: timestamp,
			EventType:             eventType,
			EventVersion:          eventVersion,
			RawData:               body,
		}

		// Add the webhook to the user's state
		s.log(ctx, r, "Received webhook! key=%s username=%s eventType=%s eventVersion=%s messageID=%s timestamp=%s",
			keyID, parsedWebhook.Broadcaster.UserName, eventType, eventVersion, messageID, timestamp)
		s.state.Put(keyID, webhook)

		// Signal any waiters that a webhook has been received
		s.notifyWaiter(keyID)

		// Respond to the webhook
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}
}
