package server

import (
	"context"
	"mage-kick-webhook-proxy/pkg/config"
	"mage-kick-webhook-proxy/pkg/logger"
	pkgstate "mage-kick-webhook-proxy/pkg/state"
	"net/http"
	"sync"

	"github.com/sirupsen/logrus"
)

type Server struct {
	server    *http.Server
	state     pkgstate.State
	waiters   map[string]*waiter
	waitersMu sync.RWMutex
	auths     map[string]string
	authsMu   sync.RWMutex
}

type waiter struct {
	closer      sync.Once
	closeChan   chan struct{}
	resolver    sync.Once
	resolveChan chan struct{}
}

func New(s pkgstate.State) *Server {
	return &Server{
		state:   s,
		waiters: make(map[string]*waiter),
		auths:   make(map[string]string),
	}
}

func (s *Server) Start(ctx context.Context, wg *sync.WaitGroup) {
	wg.Add(1)
	go s.main(ctx, wg)
}

func (s *Server) main(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	l := logger.FromContext(ctx)
	cfg := config.FromContext(ctx)

	s.server = &http.Server{
		Addr: ":" + cfg.HTTPPort,
	}

	http.HandleFunc("/auth/authorize", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleAuthorizationRequest(ctx)(w, r)
	})

	http.HandleFunc("/auth/token", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleToken(ctx)(w, r)
	})

	http.HandleFunc("/auth/callback", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleCallback(ctx)(w, r)
	})

	http.HandleFunc("/connect/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleConnect(ctx)(w, r)
	})

	http.HandleFunc("/poll/", func(w http.ResponseWriter, r *http.Request) {
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

	http.HandleFunc("/webhook", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleWebHook(ctx)(w, r)
	})

	http.HandleFunc("/admin/users", func(w http.ResponseWriter, r *http.Request) {
		s.HandleUsers(ctx)(w, r)
	})

	http.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok"}`))
	})

	http.HandleFunc("/inject/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method Not Allowed", http.StatusMethodNotAllowed)
			return
		}
		s.HandleInject(ctx)(w, r)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "Not Found", http.StatusNotFound)
	})

	go func() {
		<-ctx.Done()
		l.Info("Context canceled, shutting down server...")
		_ = s.server.Shutdown(context.Background())
	}()

	l.Infof("Starting HTTP server: address=%s", s.server.Addr)
	if err := s.server.ListenAndServe(); err != http.ErrServerClosed {
		l.Error("HTTP server error", "error", err)
	}
}

func (s *Server) log(ctx context.Context, r *http.Request, msg string, args ...interface{}) {
	l := logger.FromContext(ctx)
	var e *logrus.Entry
	if r != nil {
		f := logrus.Fields{}
		f["method"] = r.Method
		f["rndr-id"] = r.Header.Get("Rndr-Id")
		f["url"] = r.URL.String()
		xForwardedFor := r.Header.Get("X-Forwarded-For")
		if xForwardedFor != "" {
			f["remote_addr"] = xForwardedFor
		} else {
			f["remote_addr"] = r.RemoteAddr
		}
		xBroadcasterUsername := r.Header.Get("X-Broadcaster-Username")
		if xBroadcasterUsername != "" {
			f["x_broadcaster_username"] = xBroadcasterUsername
		}
		xInstanceID := r.Header.Get("X-Instance-ID")
		if xInstanceID != "" {
			f["x_instance_id"] = xInstanceID
		}
		xRequestID := r.Header.Get("X-Request-ID")
		if xRequestID != "" {
			f["x_request_id"] = xRequestID
		}
		userAgent := r.Header.Get("User-Agent")
		if userAgent != "" {
			f["user_agent"] = userAgent
		}
		e = l.WithFields(f)
	} else {
		e = l.WithField("request", "nil")
	}
	e.Infof(msg, args...)
}
