package server

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

func (s *Server) HandleInject(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		// Extract the key from the URL path
		parts := strings.Split(r.URL.Path, "/")
		if len(parts) < 3 || parts[2] == "" {
			s.log(ctx, r, "Rejecting injection request: missing key in URL")
			http.Error(w, "Bad Request: missing key in URL", http.StatusBadRequest)
			return
		}
		keyID := parts[2]

		// Currently there's one static admin token for the entire site.
		// We can do better if we have to.
		if config.FromContext(ctx).AdminToken == "" {
			s.log(ctx, r, "Rejecting injection request: Admin token is not configured")
			http.Error(w, "This endpoint is restricted", http.StatusForbidden)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer "+config.FromContext(ctx).AdminToken && authHeader != "Token "+config.FromContext(ctx).AdminToken && authHeader != config.FromContext(ctx).AdminToken {
			s.log(ctx, r, "Rejecting injection request: Admin token mismatch")
			http.Error(w, "This endpoint is restricted", http.StatusForbidden)
			return
		}

		// Read the request body
		body, err := io.ReadAll(r.Body)
		if err != nil {
			s.log(ctx, r, "Failed to read request body: %v", err)
			http.Error(w, "Internal Server Error: failed to read body", http.StatusInternalServerError)
			return
		}

		// Parse the body into the injectable struct
		var injectable model.InjectableWebhook
		if err := json.Unmarshal(body, &injectable); err != nil {
			s.log(ctx, r, "Failed to parse request body: %v", err)
			http.Error(w, "Bad Request: invalid JSON body", http.StatusBadRequest)
			return
		}

		// We can default some of these missing fields, but others are required
		if injectable.EventType == "" {
			s.log(ctx, r, "Invalid injection request: missing event type")
			http.Error(w, "Bad Request: missing event type", http.StatusBadRequest)
			return
		}
		if injectable.EventVersion == "" {
			injectable.EventVersion = "1" // Right now most events are version 1
		}
		if injectable.EventMessageID == "" {
			injectable.EventMessageID = strings.ReplaceAll(uuid.New().String(), "-", "")
		}
		if injectable.EventMessageTimestamp == "" {
			injectable.EventMessageTimestamp = time.Now().UTC().Format("2006-01-02T15:04:05Z")
		}
		if injectable.EventSubscriptionID == "" {
			injectable.EventSubscriptionID = strings.ReplaceAll(uuid.New().String(), "-", "")
		}

		// If payload is not given but raw_data is, then we base64-decode raw_data into the payload
		if len(injectable.RawData) > 0 && len(injectable.Payload) == 0 {
			injectable.Payload = make([]byte, base64.StdEncoding.DecodedLen(len(injectable.RawData)))
			n, err := base64.StdEncoding.Decode(injectable.Payload, []byte(injectable.RawData))
			if err != nil {
				s.log(ctx, r, "Failed to decode raw_data: %v", err)
				http.Error(w, "Bad Request: invalid raw_data", http.StatusBadRequest)
				return
			}
			injectable.Payload = injectable.Payload[:n]
		}

		// Convert injectable into webhook
		webhook := model.Webhook{
			WebhookHeaders: model.WebhookHeaders{
				EventMessageID:        injectable.EventMessageID,
				EventSubscriptionID:   injectable.EventSubscriptionID,
				EventMessageTimestamp: injectable.EventMessageTimestamp,
				EventType:             injectable.EventType,
				EventVersion:          injectable.EventVersion,
			},
			RawData: injectable.Payload,
		}

		// Add the webhook to the user's state
		s.log(ctx, r, "Injected webhook! key=%s username=%s eventType=%s eventVersion=%s messageID=%s timestamp=%s",
			keyID, config.FromContext(ctx).IDToKickName[keyID], webhook.EventType, webhook.EventVersion, webhook.EventMessageID, webhook.EventMessageTimestamp)
		s.state.Put(keyID, webhook)

		// Signal any waiters that a webhook has been received
		s.notifyWaiter(keyID)

		// Respond to the request
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"success": true}`))
	}
}
