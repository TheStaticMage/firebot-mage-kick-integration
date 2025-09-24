package server

import (
	"context"
	"encoding/json"
	"mage-kick-webhook-proxy/pkg/config"
	"net/http"
)

type UserPayload struct {
	Username string `json:"username"`
	UUID     string `json:"uuid"`
}

func (s *Server) HandleUsers(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		// Currently there's one static admin token for the entire site.
		// We can do better if we have to.
		if config.FromContext(ctx).AdminToken == "" {
			s.log(ctx, r, "Rejecting users endpoint request: Admin token is not configured")
			http.Error(w, "This endpoint is restricted", http.StatusForbidden)
			return
		}

		authHeader := r.Header.Get("Authorization")
		if authHeader != "Bearer "+config.FromContext(ctx).AdminToken && authHeader != "Token "+config.FromContext(ctx).AdminToken && authHeader != config.FromContext(ctx).AdminToken {
			s.log(ctx, r, "Rejecting users endpoint request: Admin token mismatch")
			http.Error(w, "This endpoint is restricted", http.StatusForbidden)
			return
		}

		// Handle GET to list users
		if r.Method == http.MethodGet {
			s.handleListUsers(ctx, w, r)
			return
		}

		body := json.NewDecoder(r.Body)
		var userPayload UserPayload
		if err := body.Decode(&userPayload); err != nil {
			http.Error(w, "Bad Request: invalid JSON body", http.StatusBadRequest)
			s.log(ctx, r, "Failed to parse user add request body: %v", err)
			return
		}

		// Handle POST to add a user
		if r.Method == http.MethodPost {
			s.handleAddUser(ctx, w, r, userPayload)
			return
		}

		// Handle DELETE to remove a user
		if r.Method == http.MethodDelete {
			s.handleRemoveUser(ctx, w, r, userPayload)
			return
		}

		s.log(ctx, r, "Rejecting users endpoint request: Unknown method %s", r.Method)
		http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleListUsers(ctx context.Context, w http.ResponseWriter, r *http.Request) {
	users := config.FromContext(ctx).KickNamesToIDs()
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(users); err != nil {
		http.Error(w, "Failed to encode user list", http.StatusInternalServerError)
		s.log(ctx, r, "Failed to encode user list: %v", err)
		return
	}
}

func (s *Server) handleAddUser(ctx context.Context, w http.ResponseWriter, r *http.Request, userPayload UserPayload) {
	config.FromContext(ctx).SetUser(userPayload.Username, userPayload.UUID, false)
	s.log(ctx, r, "Added user: username=%s uuid=%s", userPayload.Username, userPayload.UUID)
	w.WriteHeader(http.StatusCreated)
}

func (s *Server) handleRemoveUser(ctx context.Context, w http.ResponseWriter, r *http.Request, userPayload UserPayload) {
	config.FromContext(ctx).SetUser(userPayload.Username, userPayload.UUID, true)
	s.log(ctx, r, "Removed user: username=%s uuid=%s", userPayload.Username, userPayload.UUID)
	w.WriteHeader(http.StatusNoContent)
}
