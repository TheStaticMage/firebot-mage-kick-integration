package server

import (
	"context"
	"encoding/json"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	"mage-kick-webhook-proxy/pkg/model"
	"mage-kick-webhook-proxy/pkg/state"
	"net/http"
	"strconv"
	"sync"
	"time"
)

func (s *Server) HandleClose(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := config.FromContext(ctx)

		// Look up the UUID from the URL path in the users map
		uuid := r.URL.Path[len("/poll/"):]
		_, exists := cfg.IDToKickName(uuid)
		if !exists {
			http.Error(w, "User not found", http.StatusNotFound)
			s.log(ctx, r, "Received poll request: user not found (uuid=%s)", uuid)
			return
		}

		// Close the waiter for this UUID (if there is one)
		s.closeWaiter(uuid)

		// Respond with success
		w.WriteHeader(http.StatusNoContent)
	}
}

func (s *Server) HandlePoll(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := config.FromContext(ctx)
		log := logger.FromContext(ctx).WithField("component", "poll")

		// Look up the UUID from the URL path in the users map
		uuid := r.URL.Path[len("/poll/"):]
		_, exists := cfg.IDToKickName(uuid)
		if !exists {
			http.Error(w, "User not found", http.StatusNotFound)
			s.log(ctx, r, "Received poll request: user not found (uuid=%s)", uuid)
			return
		}
		log = log.WithField("uuid", uuid)

		// Get client's last received webhook ID
		var lastID int64 = 0
		lastIDStr := r.Header.Get("X-Cursor-ID")
		if lastIDStr == "" {
			// Old client
			log.Trace("Old client - no X-Cursor-ID header")
			s.lastIDsMu.Lock()
			if id, exists := s.lastIDs[uuid]; exists {
				lastID = id
			} else {
				lastID = time.Now().UnixMicro()
				s.lastIDs[uuid] = lastID
			}
			s.lastIDsMu.Unlock()
		} else {
			// New client - replay webhooks since last check-in
			parsed, err := strconv.ParseInt(lastIDStr, 10, 64)
			if err != nil {
				http.Error(w, "Bad Request: invalid X-Cursor-ID header", http.StatusBadRequest)
				s.log(ctx, r, "Received poll request: invalid X-Cursor-ID header (uuid=%s, header=%s)", uuid, lastIDStr)
				return
			}
			lastID = parsed
		}

		// Get all webhooks since last ID
		webhooks, err := s.state.GetWebhooksSince(ctx, uuid, lastID)
		if err != nil {
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			s.log(ctx, r, "Error getting webhooks for user (uuid=%s): %v", uuid, err)
			return
		}

		// If we have webhooks, send them immediately
		if len(webhooks) > 0 {
			s.sendWebhooksWithSequence(ctx, w, r, webhooks, uuid)
			return
		}

		// No stored webhooks - enter wait mode
		s.log(ctx, r, "Received poll request: Waiting (uuid=%s, lastID=%d)", uuid, lastID)

		// Add new waiter for this UUID (this closes any existing one)
		waiterObj := s.addWaiter(uuid)
		defer waiterObj.cleanup()

		select {
		case <-ctx.Done():
			http.Error(w, "Request cancelled", http.StatusBadGateway)
			s.log(ctx, r, "Poll request cancelled (uuid=%s)", uuid)
		case <-time.After(30 * time.Second):
			// Return empty response with current cursor
			s.sendEmptyResponse(w, lastID)
			s.log(ctx, r, "Poll request expired (uuid=%s)", uuid)
		case <-waiterObj.closeChan:
			http.Error(w, "Request closed", http.StatusConflict)
			s.log(ctx, r, "Poll request closed (uuid=%s)", uuid)
		case <-waiterObj.resolveChan:
			// New webhooks arrived - get them and send
			newWebhooks, err := s.state.GetWebhooksSince(ctx, uuid, lastID)
			if err != nil {
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				s.log(ctx, r, "Error getting webhooks for user (uuid=%s): %v", uuid, err)
				return
			}
			s.sendWebhooksWithSequence(ctx, w, r, newWebhooks, uuid)
			s.log(ctx, r, "Poll request fulfilled (uuid=%s, hooksCount=%d)", uuid, len(newWebhooks))
		}
	}
}

func (s *Server) addWaiter(uuid string) *waiter {
	s.waitersMu.Lock()
	defer s.waitersMu.Unlock()

	if w, exists := s.waiters[uuid]; exists {
		w.cleanup()
	}

	s.waiters[uuid] = newWaiter()
	return s.waiters[uuid]
}

func (s *Server) closeWaiter(uuid string) {
	s.waitersMu.Lock()
	defer s.waitersMu.Unlock()

	if w, exists := s.waiters[uuid]; exists {
		w.closer.Do(func() { close(w.closeChan) })
	}
}

func (s *Server) notifyWaiter(uuid string) {
	s.waitersMu.Lock()
	defer s.waitersMu.Unlock()

	if w, exists := s.waiters[uuid]; exists {
		w.resolver.Do(func() { close(w.resolveChan) })
	}
}

func newWaiter() *waiter {
	return &waiter{
		closer:      sync.Once{},
		closeChan:   make(chan struct{}),
		resolver:    sync.Once{},
		resolveChan: make(chan struct{}),
	}
}

func (w *waiter) cleanup() {
	w.closer.Do(func() { close(w.closeChan) })
	w.resolver.Do(func() { close(w.resolveChan) })
}

func (s *Server) sendWebhooksWithSequence(ctx context.Context, w http.ResponseWriter, r *http.Request, webhooks []state.WebhookWithSequence, uuid string) {
	if len(webhooks) == 0 {
		s.sendEmptyResponse(w, 0)
		s.log(ctx, r, "Sent 0 webhooks (uuid=%s)", uuid)
		return
	}

	hooks := make([]model.Webhook, len(webhooks))
	for i, wh := range webhooks {
		hooks[i] = wh.Webhook
	}

	response := model.WebhookResponse{
		Success:  true,
		Webhooks: hooks,
		CursorID: webhooks[len(webhooks)-1].SequenceID,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		s.log(ctx, nil, "Failed to encode webhooks for uuid=%s: %v", uuid, err)
		return
	}

	s.log(ctx, r, "Sent %d webhooks (uuid=%s)", len(webhooks), uuid)

	s.lastIDsMu.Lock()
	s.lastIDs[uuid] = webhooks[len(webhooks)-1].SequenceID
	s.lastIDsMu.Unlock()
}

func (s *Server) sendEmptyResponse(w http.ResponseWriter, lastID int64) {
	response := model.WebhookResponse{
		Success:  true,
		Webhooks: []model.Webhook{},
		CursorID: lastID,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}
