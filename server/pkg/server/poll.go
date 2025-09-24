package server

import (
	"context"
	"encoding/json"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/model"
	"net/http"
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

		// Look up the UUID from the URL path in the users map
		uuid := r.URL.Path[len("/poll/"):]
		_, exists := cfg.IDToKickName(uuid)
		if !exists {
			http.Error(w, "User not found", http.StatusNotFound)
			s.log(ctx, r, "Received poll request: user not found (uuid=%s)", uuid)
			return
		}

		// If there's information for this user, return that right away.
		h := s.state.GetAndClear(uuid)
		if len(h) > 0 {
			s.sendHooks(ctx, w, r, h, uuid)
			return
		}

		// If no information is available, wait for it to be added.
		s.log(ctx, r, "Received poll request: Waiting (uuid=%s)", uuid)

		// Add new waiter for this UUID (this closes any existing one)
		waiterObj := s.addWaiter(uuid)
		defer waiterObj.cleanup()

		select {
		case <-ctx.Done():
			http.Error(w, "Request cancelled", http.StatusBadGateway)
			s.log(ctx, r, "Poll request cancelled (uuid=%s)", uuid)
		case <-time.After(30 * time.Second):
			http.Redirect(w, r, r.RequestURI, http.StatusMovedPermanently)
			s.log(ctx, r, "Poll request expired (uuid=%s)", uuid)
		case <-waiterObj.closeChan:
			http.Error(w, "Request closed", http.StatusConflict)
			s.log(ctx, r, "Poll request closed (uuid=%s)", uuid)
		case <-waiterObj.resolveChan:
			hooks := s.state.GetAndClear(uuid)
			s.sendHooks(ctx, w, r, hooks, uuid)
			s.log(ctx, r, "Poll request fulfilled (uuid=%s, hooksCount=%d)", uuid, len(hooks))
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

func (s *Server) sendHooks(ctx context.Context, w http.ResponseWriter, r *http.Request, hooks []model.Webhook, uuid string) {
	response := model.WebhookResponse{
		Success:  true,
		Webhooks: hooks,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		s.log(ctx, nil, "Failed to encode hooks for uuid=%s: %v", uuid, err)
		return
	}
	s.log(ctx, r, "Sent hooks (uuid=%s, count=%d)", uuid, len(hooks))
}
