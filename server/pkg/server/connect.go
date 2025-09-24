package server

import (
	"context"
	"mage-kick-webhook-proxy/pkg/config"
	"net/http"
)

func (s *Server) HandleConnect(ctx context.Context) func(w http.ResponseWriter, r *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		cfg := config.FromContext(ctx)

		// Look up the UUID from the URL path in the users map
		uuid := r.URL.Path[len("/connect/"):]
		kickID, exists := cfg.IDToKickName(uuid)
		if !exists {
			http.Error(w, "User not found", http.StatusNotFound)
			s.log(ctx, r, "Received connect request: user not found (uuid=%s)", uuid)
			return
		}

		// If there's information for this user, return that right away.
		w.Header().Set("Content-type", "application/json")
		w.Write([]byte(`{"success":true}`))
		s.log(ctx, r, "Received connect request (uuid=%s, kickID=%s)", uuid, kickID)
	}
}
